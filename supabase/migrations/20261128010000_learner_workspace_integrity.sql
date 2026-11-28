begin;

create or replace function public.complete_onboarding(
  p_profession text,
  p_experience_level text,
  p_interests text[],
  p_timezone text,
  p_learning_formats text[],
  p_learning_pace text,
  p_weekly_minutes integer,
  p_goals jsonb,
  p_display_name text default ''
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_goal jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_profession not in ('student','employed','freelancer','founder','career_changer','creator','exploring','other')
    or p_experience_level not in ('beginner','some_experience','intermediate','advanced')
    or p_learning_pace not in ('relaxed','balanced','intensive')
    or p_weekly_minutes not between 15 and 3000
    or coalesce(array_length(p_interests,1),0) not between 1 and 20
    or coalesce(array_length(p_learning_formats,1),0)>10
    or exists(select 1 from unnest(coalesce(p_interests,'{}'::text[])) as x where char_length(x) not between 1 and 40)
    or exists(select 1 from unnest(coalesce(p_learning_formats,'{}'::text[])) as x where x not in ('reading','video','hands_on_projects','exercises','audio','guided_explanations'))
    or char_length(coalesce(p_timezone,'Asia/Kolkata'))>80
    or jsonb_typeof(p_goals) is distinct from 'array'
    or jsonb_array_length(p_goals) not between 1 and 10
  then raise exception 'invalid onboarding data' using errcode='22023'; end if;

  update public.profiles set
    display_name=left(coalesce(p_display_name,''),80),
    profession=p_profession,
    experience_level=p_experience_level,
    interests=p_interests,
    timezone=left(coalesce(p_timezone,'Asia/Kolkata'),80),
    onboarding_completed=false,
    onboarding_version=1
  where id=v_uid;

  insert into public.learner_preferences(user_id,learning_formats,learning_pace,weekly_minutes)
  values(v_uid,p_learning_formats,p_learning_pace,p_weekly_minutes)
  on conflict(user_id) do update set learning_formats=excluded.learning_formats,
    learning_pace=excluded.learning_pace,weekly_minutes=excluded.weekly_minutes;

  for v_goal in select value from jsonb_array_elements(p_goals)
  loop
    if char_length(coalesce(v_goal->>'title','')) not between 3 and 120 then
      raise exception 'invalid goal title' using errcode='22023';
    end if;
    insert into public.learning_goals(id,user_id,title,category,desired_outcome,current_level,target_date,weekly_minutes)
    values(
      coalesce((v_goal->>'id')::uuid, gen_random_uuid()), v_uid,
      left(v_goal->>'title',120),
      left(coalesce(v_goal->>'category','general'),60),
      left(coalesce(v_goal->>'desired_outcome',''),1000),
      case when v_goal->>'current_level' in ('beginner','some_experience','intermediate','advanced') then v_goal->>'current_level' else p_experience_level end,
      case when coalesce(v_goal->>'target_date','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_goal->>'target_date')::date else null end,
      p_weekly_minutes
    ) on conflict (id) do update set
      title = excluded.title, category = excluded.category,
      desired_outcome = excluded.desired_outcome, current_level = excluded.current_level,
      target_date = excluded.target_date, weekly_minutes = excluded.weekly_minutes
    where learning_goals.user_id = v_uid;
    if not found then raise exception 'goal unavailable' using errcode='42501'; end if;
  end loop;

  update public.profiles set onboarding_completed=true where id=v_uid;
end;
$$;

-- Keep the original completion date when a client retries a saved mutation.
create function public.preserve_completion_date() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'completed' and new.status = 'completed' then
    new.completed_at := coalesce(old.completed_at, new.completed_at);
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_completion_date() from public;
create trigger preserve_completion_date before update on public.learning_progress
for each row execute function public.preserve_completion_date();

commit;
