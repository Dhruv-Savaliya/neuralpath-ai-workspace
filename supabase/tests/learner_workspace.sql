-- Run in a disposable Supabase database with the learner migrations installed.
begin;
insert into auth.users (id) values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $$
declare
  goal uuid := gen_random_uuid();
  path uuid;
  items jsonb;
  result jsonb;
  first_completion timestamptz := now() - interval '2 days';
begin
  for i in 1..2 loop
    perform public.complete_onboarding('student','beginner',array['Math'],'UTC',array['reading'],'balanced',150,
      jsonb_build_array(jsonb_build_object('id',goal,'title','Study algebra ' || i)));
  end loop;
  if (select count(*) from public.learning_goals) <> 1 or
    (select title from public.learning_goals where id = goal) <> 'Study algebra 2' then
    raise exception 'Onboarding retry did not preserve goal identity';
  end if;
  select jsonb_agg(jsonb_build_object('position',n,'title','Task','description','Read','item_type','lesson') order by n)
    into items from generate_series(0,179) n;
  result := public.save_curriculum_batch(goal,null,0,'My path','Algebra',jsonb_path_query_array(items,'$[0 to 3]'));
  path := (result->>'id')::uuid;
  if result->>'status' <> 'in_progress' then raise exception 'Expected resumable path'; end if;
  begin
    perform public.save_curriculum_batch(goal,null,0,'Old request','Algebra',items);
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.save_curriculum_batch(goal,path,4,'My path','Algebra',
      jsonb_set(jsonb_path_query_array(items,'$[4 to 7]'),'{2,item_type}','"invalid"'));
    raise exception 'Invalid task was accepted';
  exception when check_violation then null;
  end;
  if (select count(*) from public.learning_path_items where path_id=path) <> 4 then
    raise exception 'Failed write did not roll back';
  end if;
  result := public.save_curriculum_batch(goal,path,4,'My path','Algebra',jsonb_path_query_array(items,'$[4 to last]'));
  if result->>'status' <> 'active' or jsonb_array_length(result->'items') <> 180 then
    raise exception 'Roadmap did not resume and activate';
  end if;
  insert into public.learning_progress(user_id,path_item_id,status,reflection,completed_at)
    values(auth.uid(),(result#>>'{items,0,id}')::uuid,'completed','My notes',first_completion);
  insert into public.learning_progress(user_id,path_item_id,status,completed_at)
    values(auth.uid(),(result#>>'{items,0,id}')::uuid,'completed',now())
    on conflict(user_id,path_item_id) do update set status=excluded.status,completed_at=excluded.completed_at;
  if not exists(select from public.learning_progress where completed_at=first_completion and reflection='My notes') then
    raise exception 'Status retry changed learning history';
  end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$
begin
  if exists(select from public.learning_goals) or exists(select from public.learning_paths)
    or exists(select from public.learning_path_items) or exists(select from public.learning_progress)
    then raise exception 'Learner rows visible outside their owner'; end if;
end $$;
rollback;
