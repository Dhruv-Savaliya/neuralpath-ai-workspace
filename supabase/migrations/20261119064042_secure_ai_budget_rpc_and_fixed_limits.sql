drop function if exists public.reserve_cloudflare_neurons(integer);
drop function if exists public.release_cloudflare_neurons(uuid);
drop function if exists public.complete_cloudflare_neurons(uuid);
drop function if exists public.reserve_ai_generation(text,integer,integer,integer,integer,integer,integer);
drop function if exists public.reserve_ai_generation(text,integer,integer,integer,integer,integer);
drop function if exists public.release_ai_generation(uuid);
drop function if exists public.complete_ai_generation(uuid);

create or replace function private.reserve_cloudflare_neurons_internal(p_estimated_neurons integer)
returns table (allowed boolean, reservation_id uuid, used_neurons bigint, remaining_neurons bigint)
language plpgsql security definer set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_global bigint;
  v_user bigint;
  v_reservation uuid;
  v_user_scope text;
  v_global_limit constant bigint := 9000;
  v_user_limit constant bigint := 1000;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_estimated_neurons is null or p_estimated_neurons < 1 or p_estimated_neurons > v_global_limit then
    raise exception 'Invalid neuron reservation' using errcode='22023';
  end if;
  v_user_scope := 'user:' || v_user_id::text;
  perform pg_advisory_xact_lock(hashtextextended('cloudflare-neurons:' || v_day::text, 0));
  insert into private.ai_daily_usage(usage_date,scope_key)
    values(v_day,'global'),(v_day,v_user_scope) on conflict(usage_date,scope_key) do nothing;
  select neurons into v_global from private.ai_daily_usage where usage_date=v_day and scope_key='global' for update;
  select neurons into v_user from private.ai_daily_usage where usage_date=v_day and scope_key=v_user_scope for update;
  if v_global+p_estimated_neurons>v_global_limit or v_user+p_estimated_neurons>v_user_limit then
    return query select false,null::uuid,v_global,greatest(0,v_global_limit-v_global);
    return;
  end if;
  update private.ai_daily_usage set neurons=neurons+p_estimated_neurons,request_count=request_count+1
    where usage_date=v_day and scope_key in ('global',v_user_scope);
  insert into private.ai_neuron_reservations(usage_date,user_id,neurons)
    values(v_day,v_user_id,p_estimated_neurons) returning id into v_reservation;
  return query select true,v_reservation,v_global+p_estimated_neurons,greatest(0,v_global_limit-v_global-p_estimated_neurons);
end;
$$;

create or replace function private.release_cloudflare_neurons_internal(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,private,auth
as $$
declare v_user_id uuid:=auth.uid(); v_res private.ai_neuron_reservations%rowtype; v_scope text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_res from private.ai_neuron_reservations where id=p_reservation_id and user_id=v_user_id and released=false for update;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('cloudflare-neurons:'||v_res.usage_date::text,0));
  v_scope:='user:'||v_user_id::text;
  update private.ai_daily_usage set neurons=greatest(0,neurons-v_res.neurons),request_count=greatest(0,request_count-1)
    where usage_date=v_res.usage_date and scope_key in ('global',v_scope);
  update private.ai_neuron_reservations set released=true where id=v_res.id;
  return true;
end;
$$;

create or replace function private.complete_cloudflare_neurons_internal(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,private,auth
as $$
declare v_user_id uuid:=auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update private.ai_neuron_reservations set released=true
    where id=p_reservation_id and user_id=v_user_id and released=false returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function private.reserve_ai_generation_internal(p_provider text,p_estimated_tokens integer)
returns table (allowed boolean,reservation_id uuid,used_daily_requests bigint,used_daily_tokens bigint,used_minute_tokens bigint)
language plpgsql security definer set search_path=pg_catalog,private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_day date:=(clock_timestamp() at time zone 'UTC')::date;
  v_window timestamptz:=date_trunc('minute',clock_timestamp());
  v_global text; v_user text;
  v_daily_requests bigint; v_daily_tokens bigint; v_minute_tokens bigint; v_minute_requests bigint; v_user_requests bigint;
  v_daily_request_limit integer; v_daily_token_limit integer; v_minute_token_limit integer; v_user_request_limit integer; v_minute_request_limit integer;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_estimated_tokens is null or p_estimated_tokens<1 then raise exception 'Invalid token reservation' using errcode='22023'; end if;
  if p_provider='groq' then
    v_daily_request_limit:=900; v_daily_token_limit:=180000; v_minute_token_limit:=7000; v_user_request_limit:=100; v_minute_request_limit:=25;
  elsif p_provider='gemini' then
    v_daily_request_limit:=18; v_daily_token_limit:=100000; v_minute_token_limit:=6000; v_user_request_limit:=10; v_minute_request_limit:=10;
  else raise exception 'Unsupported AI provider' using errcode='22023';
  end if;
  v_global:=p_provider||':global'; v_user:=p_provider||':user:'||v_user_id::text;
  perform pg_advisory_xact_lock(hashtextextended('ai-generation:'||p_provider||':'||v_day::text||':'||v_window::text,0));
  insert into private.ai_provider_daily_usage(usage_date,scope_key) values(v_day,v_global),(v_day,v_user)
    on conflict(usage_date,scope_key) do nothing;
  insert into private.ai_provider_minute_usage(window_start,scope_key) values(v_window,v_global),(v_window,v_user)
    on conflict(window_start,scope_key) do nothing;
  select requests,tokens into v_daily_requests,v_daily_tokens from private.ai_provider_daily_usage
    where usage_date=v_day and scope_key=v_global for update;
  select tokens,requests into v_minute_tokens,v_minute_requests from private.ai_provider_minute_usage
    where window_start=v_window and scope_key=v_global for update;
  select requests into v_user_requests from private.ai_provider_daily_usage
    where usage_date=v_day and scope_key=v_user for update;
  if v_daily_requests+1>v_daily_request_limit or v_daily_tokens+p_estimated_tokens>v_daily_token_limit
    or v_minute_tokens+p_estimated_tokens>v_minute_token_limit or v_minute_requests+1>v_minute_request_limit
    or v_user_requests+1>v_user_request_limit then
    return query select false,null::uuid,v_daily_requests,v_daily_tokens,v_minute_tokens;
    return;
  end if;
  update private.ai_provider_daily_usage set requests=requests+1,tokens=tokens+p_estimated_tokens
    where usage_date=v_day and scope_key in(v_global,v_user);
  update private.ai_provider_minute_usage set tokens=tokens+p_estimated_tokens,requests=requests+1
    where window_start=v_window and scope_key in(v_global,v_user);
  insert into private.ai_provider_reservations(usage_date,window_start,user_id,provider,estimated_tokens)
    values(v_day,v_window,v_user_id,p_provider,p_estimated_tokens) returning id into v_id;
  return query select true,v_id,v_daily_requests+1,v_daily_tokens+p_estimated_tokens,v_minute_tokens+p_estimated_tokens;
end;
$$;

create or replace function private.complete_ai_generation_internal(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,private,auth
as $$
declare v_user_id uuid:=auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update private.ai_provider_reservations set released=true
    where id=p_reservation_id and user_id=v_user_id and released=false returning id into v_id;
  return v_id is not null;
end;
$$;

grant usage on schema private to authenticated;
revoke all on function private.reserve_cloudflare_neurons_internal(integer) from public,anon;
revoke all on function private.release_cloudflare_neurons_internal(uuid) from public,anon;
revoke all on function private.complete_cloudflare_neurons_internal(uuid) from public,anon;
revoke all on function private.reserve_ai_generation_internal(text,integer) from public,anon;
revoke all on function private.complete_ai_generation_internal(uuid) from public,anon;
grant execute on function private.reserve_cloudflare_neurons_internal(integer) to authenticated;
grant execute on function private.release_cloudflare_neurons_internal(uuid) to authenticated;
grant execute on function private.complete_cloudflare_neurons_internal(uuid) to authenticated;
grant execute on function private.reserve_ai_generation_internal(text,integer) to authenticated;
grant execute on function private.complete_ai_generation_internal(uuid) to authenticated;

create or replace function public.reserve_cloudflare_neurons(p_estimated_neurons integer)
returns table(allowed boolean,reservation_id uuid,used_neurons bigint,remaining_neurons bigint)
language sql security invoker set search_path=pg_catalog,public,private
as $$ select * from private.reserve_cloudflare_neurons_internal(p_estimated_neurons); $$;
create or replace function public.release_cloudflare_neurons(p_reservation_id uuid)
returns boolean language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.release_cloudflare_neurons_internal(p_reservation_id); $$;
create or replace function public.complete_cloudflare_neurons(p_reservation_id uuid)
returns boolean language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.complete_cloudflare_neurons_internal(p_reservation_id); $$;
create or replace function public.reserve_ai_generation(p_provider text,p_estimated_tokens integer)
returns table(allowed boolean,reservation_id uuid,used_daily_requests bigint,used_daily_tokens bigint,used_minute_tokens bigint)
language sql security invoker set search_path=pg_catalog,public,private
as $$ select * from private.reserve_ai_generation_internal(p_provider,p_estimated_tokens); $$;
create or replace function public.complete_ai_generation(p_reservation_id uuid)
returns boolean language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.complete_ai_generation_internal(p_reservation_id); $$;

revoke all on function public.reserve_cloudflare_neurons(integer) from public,anon;
revoke all on function public.release_cloudflare_neurons(uuid) from public,anon;
revoke all on function public.complete_cloudflare_neurons(uuid) from public,anon;
revoke all on function public.reserve_ai_generation(text,integer) from public,anon;
revoke all on function public.complete_ai_generation(uuid) from public,anon;
grant execute on function public.reserve_cloudflare_neurons(integer) to authenticated;
grant execute on function public.release_cloudflare_neurons(uuid) to authenticated;
grant execute on function public.complete_cloudflare_neurons(uuid) to authenticated;
grant execute on function public.reserve_ai_generation(text,integer) to authenticated;
grant execute on function public.complete_ai_generation(uuid) to authenticated;