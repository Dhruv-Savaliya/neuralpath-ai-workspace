begin;

create table if not exists public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  feedback text check (feedback in ('helpful', 'dismissed')),
  accepted_at timestamptz,
  accepted_action jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists learning_recommendations_owner_created_idx
  on public.learning_recommendations(user_id, created_at desc);

alter table public.learning_recommendations enable row level security;
revoke all on public.learning_recommendations from anon, authenticated;
grant select, insert, update on public.learning_recommendations to authenticated;

drop policy if exists learning_recommendations_select_own on public.learning_recommendations;
create policy learning_recommendations_select_own
  on public.learning_recommendations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists learning_recommendations_insert_own on public.learning_recommendations;
create policy learning_recommendations_insert_own
  on public.learning_recommendations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists learning_recommendations_update_own on public.learning_recommendations;
create policy learning_recommendations_update_own
  on public.learning_recommendations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
