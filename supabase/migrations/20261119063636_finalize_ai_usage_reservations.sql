drop function if exists public.reserve_ai_generation(text,integer,integer,integer,integer,integer);

create or replace function public.complete_ai_generation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update private.ai_provider_reservations
    set released=true
    where id=p_reservation_id and user_id=v_user_id and released=false
    returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.complete_cloudflare_neurons(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update private.ai_neuron_reservations
    set released=true
    where id=p_reservation_id and user_id=v_user_id and released=false
    returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function public.complete_ai_generation(uuid) from public,anon;
revoke all on function public.complete_cloudflare_neurons(uuid) from public,anon;
grant execute on function public.complete_ai_generation(uuid) to authenticated;
grant execute on function public.complete_cloudflare_neurons(uuid) to authenticated;