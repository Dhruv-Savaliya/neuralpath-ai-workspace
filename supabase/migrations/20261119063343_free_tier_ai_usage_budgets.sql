create schema if not exists private;

create table if not exists private.ai_daily_usage (
  usage_date date not null,
  scope_key text not null,
  neurons bigint not null default 0 check (neurons >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  primary key (usage_date, scope_key)
);

create table if not exists private.ai_neuron_reservations (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  neurons bigint not null check (neurons > 0),
  released boolean not null default false,
  created_at timestamptz not null default now()
);

alter table private.ai_daily_usage enable row level security;
alter table private.ai_neuron_reservations enable row level security;
revoke all on private.ai_daily_usage from public, anon, authenticated;
revoke all on private.ai_neuron_reservations from public, anon, authenticated;

create table if not exists public.ai_embedding_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  embedding_model text not null default '@cf/baai/bge-m3',
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  embedding vector(1024) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, embedding_model, content_hash)
);

alter table public.ai_embedding_cache enable row level security;
drop policy if exists "Users can read their own embedding cache" on public.ai_embedding_cache;
create policy "Users can read their own embedding cache" on public.ai_embedding_cache for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own embedding cache" on public.ai_embedding_cache;
create policy "Users can insert their own embedding cache" on public.ai_embedding_cache for insert to authenticated
with check ((select auth.uid()) = user_id);
grant select, insert on public.ai_embedding_cache to authenticated;

create or replace function public.reserve_cloudflare_neurons(p_estimated_neurons integer)
returns table (allowed boolean, reservation_id uuid, used_neurons bigint, remaining_neurons bigint)
language plpgsql security definer set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_global bigint;
  v_user bigint;
  v_reservation uuid;
  v_global_scope text := 'global';
  v_user_scope text;
  v_global_limit constant bigint := 9000;
  v_user_limit constant bigint := 1000;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_estimated_neurons is null or p_estimated_neurons < 1 or p_estimated_neurons > v_global_limit then
    raise exception 'Invalid neuron reservation' using errcode = '22023';
  end if;
  v_user_scope := 'user:' || v_user_id::text;
  perform pg_advisory_xact_lock(hashtextextended('cloudflare-neurons:' || v_day::text, 0));
  insert into private.ai_daily_usage (usage_date, scope_key)
    values (v_day, v_global_scope), (v_day, v_user_scope) on conflict (usage_date, scope_key) do nothing;
  select neurons into v_global from private.ai_daily_usage
    where usage_date = v_day and scope_key = v_global_scope for update;
  select neurons into v_user from private.ai_daily_usage
    where usage_date = v_day and scope_key = v_user_scope for update;
  if v_global + p_estimated_neurons > v_global_limit or v_user + p_estimated_neurons > v_user_limit then
    return query select false, null::uuid, v_global, greatest(0, v_global_limit - v_global);
    return;
  end if;
  update private.ai_daily_usage set neurons = neurons + p_estimated_neurons, request_count = request_count + 1
    where usage_date = v_day and scope_key in (v_global_scope, v_user_scope);
  insert into private.ai_neuron_reservations (usage_date, user_id, neurons)
    values (v_day, v_user_id, p_estimated_neurons) returning id into v_reservation;
  return query select true, v_reservation, v_global + p_estimated_neurons,
    greatest(0, v_global_limit - v_global - p_estimated_neurons);
end;
$$;

create or replace function public.release_cloudflare_neurons(p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation private.ai_neuron_reservations%rowtype;
  v_user_scope text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_reservation from private.ai_neuron_reservations
    where id = p_reservation_id and user_id = v_user_id and released = false for update;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('cloudflare-neurons:' || v_reservation.usage_date::text, 0));
  v_user_scope := 'user:' || v_user_id::text;
  update private.ai_daily_usage set neurons = greatest(0, neurons - v_reservation.neurons),
    request_count = greatest(0, request_count - 1)
    where usage_date = v_reservation.usage_date and scope_key in ('global', v_user_scope);
  update private.ai_neuron_reservations set released = true where id = v_reservation.id;
  return true;
end;
$$;

revoke all on function public.reserve_cloudflare_neurons(integer) from public, anon;
revoke all on function public.release_cloudflare_neurons(uuid) from public, anon;
grant execute on function public.reserve_cloudflare_neurons(integer) to authenticated;
grant execute on function public.release_cloudflare_neurons(uuid) to authenticated;