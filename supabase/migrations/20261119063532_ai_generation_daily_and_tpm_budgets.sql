create table if not exists private.ai_provider_daily_usage (
  usage_date date not null, scope_key text not null,
  requests bigint not null default 0 check (requests >= 0),
  tokens bigint not null default 0 check (tokens >= 0),
  primary key (usage_date, scope_key)
);
create table if not exists private.ai_provider_minute_usage (
  window_start timestamptz not null, scope_key text not null,
  tokens bigint not null default 0 check (tokens >= 0),
  primary key (window_start, scope_key)
);
create table if not exists private.ai_provider_reservations (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null, window_start timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('groq','gemini')),
  estimated_tokens integer not null check (estimated_tokens > 0),
  released boolean not null default false,
  created_at timestamptz not null default now()
);
alter table private.ai_provider_daily_usage enable row level security;
alter table private.ai_provider_minute_usage enable row level security;
alter table private.ai_provider_reservations enable row level security;
revoke all on private.ai_provider_daily_usage, private.ai_provider_minute_usage, private.ai_provider_reservations from public, anon, authenticated;

create or replace function public.reserve_ai_generation(
  p_provider text, p_estimated_tokens integer, p_daily_request_limit integer default 900,
  p_daily_token_limit integer default 180000, p_minute_token_limit integer default 7000,
  p_user_daily_request_limit integer default 100
)
returns table (allowed boolean, reservation_id uuid, used_daily_requests bigint, used_daily_tokens bigint, used_minute_tokens bigint)
language plpgsql security definer set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_global_scope text;
  v_user_scope text;
  v_daily_requests bigint;
  v_daily_tokens bigint;
  v_minute_tokens bigint;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_provider not in ('groq','gemini') or p_estimated_tokens is null or p_estimated_tokens < 1
    or p_daily_request_limit < 1 or p_daily_token_limit < 1 or p_minute_token_limit < 1 or p_user_daily_request_limit < 1 then
    raise exception 'Invalid AI generation reservation' using errcode = '22023';
  end if;
  v_global_scope := p_provider || ':global';
  v_user_scope := p_provider || ':user:' || v_user_id::text;
  perform pg_advisory_xact_lock(hashtextextended('ai-generation:' || p_provider || ':' || v_day::text || ':' || v_window::text, 0));
  insert into private.ai_provider_daily_usage (usage_date, scope_key)
    values (v_day, v_global_scope), (v_day, v_user_scope) on conflict (usage_date, scope_key) do nothing;
  insert into private.ai_provider_minute_usage (window_start, scope_key)
    values (v_window, v_global_scope), (v_window, v_user_scope) on conflict (window_start, scope_key) do nothing;
  select requests, tokens into v_daily_requests, v_daily_tokens from private.ai_provider_daily_usage
    where usage_date = v_day and scope_key = v_global_scope for update;
  select tokens into v_minute_tokens from private.ai_provider_minute_usage
    where window_start = v_window and scope_key = v_global_scope for update;
  if v_daily_requests + 1 > p_daily_request_limit or v_daily_tokens + p_estimated_tokens > p_daily_token_limit
    or v_minute_tokens + p_estimated_tokens > p_minute_token_limit then
    return query select false, null::uuid, v_daily_requests, v_daily_tokens, v_minute_tokens;
    return;
  end if;
  perform 1 from private.ai_provider_daily_usage where usage_date = v_day and scope_key = v_user_scope for update;
  if (select requests from private.ai_provider_daily_usage where usage_date=v_day and scope_key=v_user_scope) + 1 > p_user_daily_request_limit then
    return query select false, null::uuid, v_daily_requests, v_daily_tokens, v_minute_tokens;
    return;
  end if;
  update private.ai_provider_daily_usage set requests=requests+1, tokens=tokens+p_estimated_tokens
    where usage_date=v_day and scope_key in (v_global_scope,v_user_scope);
  update private.ai_provider_minute_usage set tokens=tokens+p_estimated_tokens
    where window_start=v_window and scope_key in (v_global_scope,v_user_scope);
  insert into private.ai_provider_reservations(usage_date,window_start,user_id,provider,estimated_tokens)
    values(v_day,v_window,v_user_id,p_provider,p_estimated_tokens) returning id into v_id;
  return query select true,v_id,v_daily_requests+1,v_daily_tokens+p_estimated_tokens,v_minute_tokens+p_estimated_tokens;
end;
$$;

create or replace function public.release_ai_generation(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_res private.ai_provider_reservations%rowtype;
  v_global_scope text;
  v_user_scope text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_res from private.ai_provider_reservations
    where id=p_reservation_id and user_id=v_user_id and released=false for update;
  if not found then return false; end if;
  v_global_scope := v_res.provider || ':global';
  v_user_scope := v_res.provider || ':user:' || v_user_id::text;
  perform pg_advisory_xact_lock(hashtextextended('ai-generation:' || v_res.provider || ':' || v_res.usage_date::text || ':' || v_res.window_start::text, 0));
  update private.ai_provider_daily_usage set requests=greatest(0,requests-1),tokens=greatest(0,tokens-v_res.estimated_tokens)
    where usage_date=v_res.usage_date and scope_key in (v_global_scope,v_user_scope);
  update private.ai_provider_minute_usage set tokens=greatest(0,tokens-v_res.estimated_tokens)
    where window_start=v_res.window_start and scope_key in (v_global_scope,v_user_scope);
  update private.ai_provider_reservations set released=true where id=v_res.id;
  return true;
end;
$$;
revoke all on function public.reserve_ai_generation(text,integer,integer,integer,integer,integer) from public,anon;
revoke all on function public.release_ai_generation(uuid) from public,anon;
grant execute on function public.reserve_ai_generation(text,integer,integer,integer,integer,integer) to authenticated;
grant execute on function public.release_ai_generation(uuid) to authenticated;