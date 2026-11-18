begin;

-- Keep AI usage telemetry aligned with the backend insert contract.
alter table public.ai_usage_events
  add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column if not exists error_code text check (error_code is null or char_length(error_code) <= 120);

-- Failed provider chains are telemetry events, not actual providers.
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_provider_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_provider_check
  check (provider in ('gemini','groq','cloudflare','generation_chain'));

commit;
