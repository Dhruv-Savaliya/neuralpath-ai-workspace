begin;

alter table public.ai_messages
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.ai_messages
  drop constraint if exists ai_messages_sources_array_check;
alter table public.ai_messages
  add constraint ai_messages_sources_array_check
  check (jsonb_typeof(sources) = 'array');

drop function if exists public.save_ai_exchange(uuid, text, text);

create function public.save_ai_exchange(
  p_conversation_id uuid,
  p_question text,
  p_answer text,
  p_sources jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_sources jsonb := coalesce(p_sources, '[]'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_question is null or char_length(trim(p_question)) < 2 or char_length(p_question) > 2000 then
    raise exception 'Invalid question' using errcode = '22023';
  end if;
  if p_answer is null or char_length(trim(p_answer)) < 1 or char_length(p_answer) > 24000 then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  if jsonb_typeof(v_sources) <> 'array' then
    raise exception 'Invalid sources' using errcode = '22023';
  end if;

  if p_conversation_id is null then
    insert into public.ai_conversations(user_id, title)
    values (v_user_id, left(trim(p_question), 100))
    returning id into v_conversation_id;
  else
    update public.ai_conversations
       set updated_at = now()
     where id = p_conversation_id
       and user_id = v_user_id
     returning id into v_conversation_id;

    if v_conversation_id is null then
      raise exception 'Conversation not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.ai_messages(conversation_id, user_id, role, content, sources)
  values
    (v_conversation_id, v_user_id, 'user', trim(p_question), '[]'::jsonb),
    (v_conversation_id, v_user_id, 'assistant', trim(p_answer), v_sources);

  return v_conversation_id;
end;
$$;

revoke all on function public.save_ai_exchange(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_ai_exchange(uuid, text, text, jsonb) to authenticated;

commit;
