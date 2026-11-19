-- Refund only provider requests that were explicitly rejected with HTTP 429.
-- Network timeouts and 5xx responses remain charged because provider processing
-- may have started before the connection failed.
create or replace function private.release_ai_generation_internal(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_res record;
  v_released record;
  v_global_scope text;
  v_user_scope text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select usage_date, window_start, user_id, provider, estimated_tokens
    into v_res
    from private.ai_provider_reservations
    where id = p_reservation_id and user_id = v_user_id;

  if not found then return false; end if;

  -- Serialize the refund with reservations in the same provider/minute bucket.
  perform pg_advisory_xact_lock(hashtextextended(
    'ai-generation:' || v_res.provider || ':' || v_res.usage_date::text || ':' || v_res.window_start::text,
    0
  ));

  update private.ai_provider_reservations
    set released = true
    where id = p_reservation_id
      and user_id = v_user_id
      and released = false
    returning usage_date, window_start, user_id, provider, estimated_tokens
      into v_released;

  if not found then return false; end if;

  v_global_scope := v_released.provider || ':global';
  v_user_scope := v_released.provider || ':user:' || v_released.user_id::text;

  update private.ai_provider_daily_usage
    set requests = greatest(0, requests - 1),
        tokens = greatest(0, tokens - v_released.estimated_tokens)
    where usage_date = v_released.usage_date
      and scope_key in (v_global_scope, v_user_scope);

  update private.ai_provider_minute_usage
    set requests = greatest(0, requests - 1),
        tokens = greatest(0, tokens - v_released.estimated_tokens)
    where window_start = v_released.window_start
      and scope_key in (v_global_scope, v_user_scope);

  return true;
end;
$$;

revoke all on function private.release_ai_generation_internal(uuid) from public, anon;
grant execute on function private.release_ai_generation_internal(uuid) to authenticated;

create or replace function public.release_ai_generation(p_reservation_id uuid)
returns boolean
language sql
security invoker
set search_path = pg_catalog, public, private
as $function$
  select private.release_ai_generation_internal(p_reservation_id);
$function$;

revoke all on function public.release_ai_generation(uuid) from public, anon;
grant execute on function public.release_ai_generation(uuid) to authenticated;
