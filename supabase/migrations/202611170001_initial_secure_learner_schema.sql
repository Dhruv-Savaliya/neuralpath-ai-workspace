begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  profession text not null default 'exploring' check (profession in ('student','employed','freelancer','founder','career_changer','creator','exploring','other')),
  experience_level text not null default 'beginner' check (experience_level in ('beginner','some_experience','intermediate','advanced')),
  interests text[] not null default '{}'::text[] check (cardinality(interests) <= 20),
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) <= 80),
  onboarding_completed boolean not null default false,
  onboarding_version integer not null default 1 check (onboarding_version between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  learning_formats text[] not null default '{}'::text[] check (cardinality(learning_formats) <= 10),
  learning_pace text not null default 'balanced' check (learning_pace in ('relaxed','balanced','intensive')),
  weekly_minutes integer not null default 150 check (weekly_minutes between 15 and 3000),
  language_code text not null default 'en' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  preferred_days smallint[] not null default '{}'::smallint[] check (cardinality(preferred_days) <= 7 and preferred_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text not null default 'general' check (char_length(category) <= 60),
  desired_outcome text not null default '' check (char_length(desired_outcome) <= 1000),
  current_level text not null default 'beginner' check (current_level in ('beginner','some_experience','intermediate','advanced')),
  target_date date,
  weekly_minutes integer not null default 150 check (weekly_minutes between 15 and 3000),
  priority smallint not null default 2 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_goals_user_status_idx on public.learning_goals(user_id,status,priority);

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.learning_goals(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_paths_user_idx on public.learning_paths(user_id);

create table if not exists public.learning_path_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  item_type text not null default 'lesson' check (item_type in ('lesson','exercise','project','milestone','resource')),
  position integer not null default 0 check (position >= 0),
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_path_items_owner_path_idx on public.learning_path_items(user_id,path_id,position);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_item_id uuid not null references public.learning_path_items(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  reflection text not null default '' check (char_length(reflection) <= 4000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,path_item_id)
);
create index if not exists learning_progress_owner_idx on public.learning_progress(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,left(coalesce(new.raw_user_meta_data ->> 'display_name',''),80))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

do $$
declare t text;
begin
  foreach t in array array['profiles','learner_preferences','learning_goals','learning_paths','learning_path_items','learning_progress']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',t);
  end loop;
end $$;

-- Prevent a child row from pointing to another user's parent record.
create or replace function public.assert_learning_path_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists(select 1 from public.learning_goals g where g.id=new.goal_id and g.user_id=new.user_id) then
    raise exception 'goal ownership mismatch' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists assert_learning_path_owner on public.learning_paths;
create trigger assert_learning_path_owner before insert or update on public.learning_paths
for each row execute procedure public.assert_learning_path_owner();

create or replace function public.assert_path_item_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists(select 1 from public.learning_paths p where p.id=new.path_id and p.user_id=new.user_id) then
    raise exception 'path ownership mismatch' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists assert_path_item_owner on public.learning_path_items;
create trigger assert_path_item_owner before insert or update on public.learning_path_items
for each row execute procedure public.assert_path_item_owner();

create or replace function public.assert_progress_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists(select 1 from public.learning_path_items i where i.id=new.path_item_id and i.user_id=new.user_id) then
    raise exception 'path item ownership mismatch' using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists assert_progress_owner on public.learning_progress;
create trigger assert_progress_owner before insert or update on public.learning_progress
for each row execute procedure public.assert_progress_owner();

alter table public.profiles enable row level security;
alter table public.learner_preferences enable row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_items enable row level security;
alter table public.learning_progress enable row level security;

revoke all on public.profiles,public.learner_preferences,public.learning_goals,public.learning_paths,public.learning_path_items,public.learning_progress from anon,authenticated;

grant select on public.profiles to authenticated;
grant update(display_name,profession,experience_level,interests,timezone) on public.profiles to authenticated;
grant select,insert,update,delete on public.learner_preferences,public.learning_goals,public.learning_paths,public.learning_path_items,public.learning_progress to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

-- Users can only mutate rows whose owner is their own authenticated identity.
do $$
declare t text;
begin
  foreach t in array array['learner_preferences','learning_goals','learning_paths','learning_path_items','learning_progress']
  loop
    execute format('drop policy if exists %I on public.%I',t||'_select_own',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid())=user_id)',t||'_select_own',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert_own',t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t||'_insert_own',t);
    execute format('drop policy if exists %I on public.%I',t||'_update_own',t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t||'_update_own',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete_own',t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t||'_delete_own',t);
  end loop;
end $$;

-- Atomic onboarding completion. Auth identity is read from auth.uid(), never from request data.
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
security definer
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
    or jsonb_typeof(p_goals)<>'array'
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
    insert into public.learning_goals(user_id,title,category,desired_outcome,current_level,target_date,weekly_minutes)
    values(
      v_uid,
      left(v_goal->>'title',120),
      left(coalesce(v_goal->>'category','general'),60),
      left(coalesce(v_goal->>'desired_outcome',''),1000),
      case when v_goal->>'current_level' in ('beginner','some_experience','intermediate','advanced') then v_goal->>'current_level' else p_experience_level end,
      case when coalesce(v_goal->>'target_date','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_goal->>'target_date')::date else null end,
      p_weekly_minutes
    );
  end loop;

  update public.profiles set onboarding_completed=true where id=v_uid;
end;
$$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.set_updated_at() from public,anon,authenticated;
revoke all on function public.assert_learning_path_owner() from public,anon,authenticated;
revoke all on function public.assert_path_item_owner() from public,anon,authenticated;
revoke all on function public.assert_progress_owner() from public,anon,authenticated;
revoke all on function public.complete_onboarding(text,text,text[],text,text[],text,integer,jsonb,text) from public,anon;
grant execute on function public.complete_onboarding(text,text,text[],text,text[],text,integer,jsonb,text) to authenticated;

commit;
