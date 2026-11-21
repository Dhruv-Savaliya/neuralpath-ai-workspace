begin;

-- Keep lexical retrieval available alongside vector similarity. This helps
-- exact identifiers, terminology and short factual queries that embeddings
-- may rank below semantically similar but less relevant passages.
alter table public.knowledge_chunks
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(source_title, '') || ' ' || coalesce(content, ''))
  ) stored;

create index if not exists knowledge_chunks_search_vector_gin_idx
  on public.knowledge_chunks using gin (search_vector);

-- Replace the three-argument RPC with a backward-compatible four-argument
-- signature whose final query_text parameter has a default.
drop function if exists public.match_knowledge_chunks(extensions.vector, real, integer);

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
  similarity real
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
    where kc.user_id = (select auth.uid())
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
    where kc.user_id = (select auth.uid())
      and nullif(trim(query_text), '') is not null
      and kc.search_vector @@ websearch_to_tsquery('simple', query_text)
    order by rank_ix
    limit least(greatest(match_count, 1), 30) * 2
  ),
  fused as (
    select
      coalesce(text_candidates.id, vector_candidates.id) as id,
      coalesce(1.0 / (60 + text_candidates.rank_ix), 0.0)
        + coalesce(1.0 / (60 + vector_candidates.rank_ix), 0.0) as rrf_score
    from text_candidates
    full outer join vector_candidates
      on text_candidates.id = vector_candidates.id
  )
  select
    kc.id,
    kc.source_title,
    kc.source_url,
    kc.content,
    (1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding))::real as similarity
  from fused
  join public.knowledge_chunks as kc on kc.id = fused.id
  where kc.user_id = (select auth.uid())
  order by fused.rrf_score desc
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, real, integer, text) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector, real, integer, text) to authenticated;

commit;
