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
    select kc.id
    from public.knowledge_chunks as kc
    where kc.user_id = (select auth.uid())
    order by kc.embedding OPERATOR(extensions.<=>) query_embedding
    limit least(greatest(match_count, 1) * 4, 40)
  ),
  text_candidates as (
    select kc.id
    from public.knowledge_chunks as kc
    where kc.user_id = (select auth.uid())
      and nullif(trim(query_text), '') is not null
      and kc.search_vector @@ websearch_to_tsquery('simple', query_text)
    order by ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', query_text)) desc
    limit least(greatest(match_count, 1) * 4, 40)
  ),
  candidate_ids as (
    select id from vector_candidates
    union
    select id from text_candidates
  ),
  scored as (
    select
      kc.id,
      kc.source_title,
      kc.source_url,
      kc.content,
      (1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding))::real as similarity,
      case
        when nullif(trim(query_text), '') is not null
          then ts_rank_cd(kc.search_vector, websearch_to_tsquery('simple', query_text))::real
        else 0::real
      end as text_rank
    from public.knowledge_chunks as kc
    join candidate_ids as candidate on candidate.id = kc.id
    where kc.user_id = (select auth.uid())
      and (
        1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) > match_threshold
        or (
          nullif(trim(query_text), '') is not null
          and kc.search_vector @@ websearch_to_tsquery('simple', query_text)
        )
      )
  )
  select id, source_title, source_url, content, similarity
  from scored
  order by
    (0.75 * greatest(similarity, 0) + 0.25 * least(text_rank, 1)) desc,
    similarity desc
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, real, integer, text) from public, anon;
grant execute on function public.match_knowledge_chunks(extensions.vector, real, integer, text) to authenticated;

commit;
