begin;

-- OPEN-10: Shared Public Knowledge Corpus Migration
-- Make user_id nullable for public corpus rows and add visibility column
alter table public.knowledge_chunks
  alter column user_id drop not null;

alter table public.knowledge_chunks
  add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'public'));

create index if not exists knowledge_chunks_visibility_idx
  on public.knowledge_chunks (visibility);

create index if not exists knowledge_chunks_public_source_idx
  on public.knowledge_chunks (source_id, chunk_index)
  where visibility = 'public';

-- Strict RLS: authenticated users can read their own private chunks OR any public chunk.
-- Users can only insert/delete their own private chunks.
-- Public chunks can only be written or managed by the service role.
drop policy if exists knowledge_chunks_select_own on public.knowledge_chunks;
drop policy if exists knowledge_chunks_select_policy on public.knowledge_chunks;

create policy knowledge_chunks_select_policy
  on public.knowledge_chunks for select to authenticated
  using (
    (visibility = 'private' and (select auth.uid()) = user_id)
    or
    visibility = 'public'
  );

drop policy if exists knowledge_chunks_insert_own on public.knowledge_chunks;
create policy knowledge_chunks_insert_own
  on public.knowledge_chunks for insert to authenticated
  with check (
    visibility = 'private'
    and user_id is not null
    and (select auth.uid()) = user_id
  );

drop policy if exists knowledge_chunks_delete_own on public.knowledge_chunks;
create policy knowledge_chunks_delete_own
  on public.knowledge_chunks for delete to authenticated
  using (
    visibility = 'private'
    and user_id is not null
    and (select auth.uid()) = user_id
  );

-- Replace match_knowledge_chunks to query both private and public chunks,
-- giving the authenticated user's private chunks a slight boost.
drop function if exists public.match_knowledge_chunks(extensions.vector, real, integer, text);

create function public.match_knowledge_chunks(
  query_embedding extensions.vector(1024),
  match_threshold real default 0.25,
  match_count integer default 6,
  query_text text default null
)
returns table (
  id uuid,
  source_title text,
  source_url text,
  content text,
  similarity real,
  visibility text
)
language sql
stable
security invoker
set search_path = pg_catalog, extensions, public
set hnsw.ef_search = 100
as $$
  with vector_candidates as (
    select
      kc.id,
      row_number() over (
        order by kc.embedding OPERATOR(extensions.<=>) query_embedding
      ) as rank_ix
    from public.knowledge_chunks as kc
    where (
        (kc.visibility = 'private' and kc.user_id = (select auth.uid()))
        or
        kc.visibility = 'public'
      )
      and 1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) > match_threshold
    order by kc.embedding OPERATOR(extensions.<=>) query_embedding
    limit least(greatest(match_count, 1), 30) * 2
  ),
  text_candidates as (
    select
      kc.id,
      row_number() over (
        order by ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', query_text)) desc
      ) as rank_ix
    from public.knowledge_chunks as kc
    where (
        (kc.visibility = 'private' and kc.user_id = (select auth.uid()))
        or
        kc.visibility = 'public'
      )
      and nullif(trim(query_text), '') is not null
      and kc.search_vector @@ websearch_to_tsquery('simple', query_text)
    order by rank_ix
    limit least(greatest(match_count, 1), 30) * 2
  ),
  fused as (
    select
      coalesce(text_candidates.id, vector_candidates.id) as id,
      coalesce(1.0 / (60 + text_candidates.rank_ix), 0.0)
        + coalesce(1.0 / (60 + vector_candidates.rank_ix), 0.0) as base_rrf
    from text_candidates
    full outer join vector_candidates
      on text_candidates.id = vector_candidates.id
  )
  select
    kc.id,
    kc.source_title,
    kc.source_url,
    kc.content,
    (1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding))::real as similarity,
    kc.visibility
  from fused
  join public.knowledge_chunks as kc on kc.id = fused.id
  where (
    (kc.visibility = 'private' and kc.user_id = (select auth.uid()))
    or
    kc.visibility = 'public'
  )
  order by
    -- Private rows receive a small RRF boost (0.005) over public rows with equal match
    (fused.base_rrf + case when kc.visibility = 'private' then 0.005 else 0.0 end) desc
  limit least(greatest(match_count, 1), 30);
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, real, integer, text) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector, real, integer, text) to authenticated;

commit;
