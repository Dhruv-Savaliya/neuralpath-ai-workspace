begin;

-- Existing states remain valid. in_progress identifies a resumable AI generation.
alter table public.learning_paths drop constraint learning_paths_status_check,
  add constraint learning_paths_status_check check (status in
    ('draft','in_progress','active','paused','completed','archived'));

create function public.save_curriculum_batch(
  p_goal_id uuid, p_path_id uuid, p_expected_count integer,
  p_title text, p_description text, p_items jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  path public.learning_paths%rowtype;
  old_count integer;
  new_count integer;
begin
  perform 1 from public.learning_goals where id = p_goal_id and user_id = owner_id for update;
  if not found then raise exception 'Goal unavailable' using errcode = '42501'; end if;
  select * into path from public.learning_paths
    where user_id = owner_id and goal_id = p_goal_id order by created_at desc, id desc limit 1 for update;
  if path.id is distinct from p_path_id then
    raise exception 'Roadmap changed' using errcode = '40001';
  end if;
  select count(*) into old_count from public.learning_path_items where path_id = path.id;
  new_count := jsonb_array_length(p_items);
  if old_count is distinct from p_expected_count then
    raise exception 'Roadmap changed' using errcode = '40001';
  end if;
  if new_count is null or old_count + new_count > 180 or new_count % 4 <> 0
    or (new_count = 0 and old_count <> 180)
    or exists (select from jsonb_array_elements(p_items) with ordinality as t(item, n)
               where (item->>'position')::integer is distinct from old_count + n - 1)
  then raise exception 'Invalid curriculum positions' using errcode = '22023'; end if;
  if path.id is null then
    insert into public.learning_paths (user_id, goal_id, title, description, status)
      values (owner_id, p_goal_id, p_title, p_description, 'in_progress') returning * into path;
  end if;
  insert into public.learning_path_items (user_id,path_id,title,description,item_type,position)
    select owner_id, path.id, item.title, item.description, item.item_type, item.position
      from jsonb_to_recordset(p_items) as item(title text, description text, item_type text, position integer);
  update public.learning_paths set status = case when old_count + new_count = 180 then 'active' else 'in_progress' end
    where id = path.id returning * into path;
  return to_jsonb(path) || jsonb_build_object('items',
    (select jsonb_agg(to_jsonb(i) order by i.position) from public.learning_path_items i where i.path_id = path.id));
end;
$$;
revoke all on function public.save_curriculum_batch(uuid,uuid,integer,text,text,jsonb) from public, anon;
grant execute on function public.save_curriculum_batch(uuid,uuid,integer,text,text,jsonb) to authenticated;

commit;
