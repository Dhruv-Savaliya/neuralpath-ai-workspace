begin;

create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_title text not null check (char_length(source_title) between 1 and 160),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1024) not null,
  embedding_model text not null default '@cf/baai/bge-m3',
  created_at timestamptz not null default now(),
  unique (user_id, source_id, chunk_index)
);

create index if not exists knowledge_chunks_owner_source_idx
  on public.knowledge_chunks(user_id, source_id);
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;
revoke all on public.knowledge_chunks from anon, authenticated;
grant select, insert, delete on public.knowledge_chunks to authenticated;

drop policy if exists knowledge_chunks_select_own on public.knowledge_chunks;
create policy knowledge_chunks_select_own
  on public.knowledge_chunks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists knowledge_chunks_insert_own on public.knowledge_chunks;
create policy knowledge_chunks_insert_own
  on public.knowledge_chunks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists knowledge_chunks_delete_own on public.knowledge_chunks;
create policy knowledge_chunks_delete_own
  on public.knowledge_chunks for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini','groq','cloudflare')),
  model text not null check (char_length(model) between 1 and 120),
  operation text not null check (operation in ('embedding','generation')),
  input_chars integer not null default 0 check (input_chars >= 0),
  output_chars integer not null default 0 check (output_chars >= 0),
  succeeded boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_owner_created_idx
  on public.ai_usage_events(user_id, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;
grant select, insert on public.ai_usage_events to authenticated;

drop policy if exists ai_usage_events_select_own on public.ai_usage_events;
create policy ai_usage_events_select_own
  on public.ai_usage_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_usage_events_insert_own on public.ai_usage_events;
create policy ai_usage_events_insert_own
  on public.ai_usage_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(1024),
  match_threshold real default 0.25,
  match_count integer default 6
)
returns table (
  id uuid,
  source_title text,
  source_url text,
  content text,
  similarity real
)
language sql
stable
security invoker
set search_path = pg_catalog, extensions
as $$
  select
    kc.id,
    kc.source_title,
    kc.source_url,
    kc.content,
    (1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding))::real as similarity
  from public.knowledge_chunks as kc
  where kc.user_id = (select auth.uid())
    and 1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) > match_threshold
  order by kc.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, real, integer) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector, real, integer) to authenticated;

commit;
