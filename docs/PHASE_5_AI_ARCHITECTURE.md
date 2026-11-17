# Phase 5 — AI and knowledge foundation

## Provider policy

NeuralPath uses server-side provider adapters only.

| Capability | Provider / model | Policy |
| --- | --- | --- |
| Text generation primary | Google Gemini `gemini-3.7-flash` | Free tier where available; enforce account quotas |
| Text generation fallback | Groq `openai/gpt-oss-120b` | Disabled by default because the model is token-priced |
| Embeddings | Cloudflare Workers AI `@cf/baai/bge-m3` | Workers Free allowance only; stop on quota errors |
| Vector storage | Supabase PostgreSQL + pgvector | `extensions.vector(1024)` |

Gemini's free tier is limited to eligible models and account-specific rate limits. Free-tier content may be used to improve Google's products; do not send secrets, credentials, or sensitive personal data.

Groq GPT-OSS 120B is not a guaranteed free model. Its current published pricing is $0.15 per million input tokens and $0.60 per million output tokens. `GROQ_ENABLED=false` is intentional. Do not enable it without explicit cost approval.

Cloudflare Workers AI Free includes 10,000 Neurons per day. BGE-M3 is listed at $0.0118 per million input tokens; actual neuron usage and account limits apply. On free-plan quota exhaustion, requests fail; NeuralPath must not upgrade or enable paid billing automatically.

## Environment variables

Set secrets only in Render's API service environment (or local ignored `.env`):

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.7-flash`
- `GROQ_API_KEY`
- `GROQ_MODEL=openai/gpt-oss-120b`
- `GROQ_ENABLED=false`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-m3`
- `EMBEDDING_DIMENSIONS=1024`

Never use `NEXT_PUBLIC_` for provider secrets.

## API

All endpoints require a valid Supabase access token in `Authorization: Bearer <token>`.

### List private sources

`GET /api/v1/ai/knowledge`

Returns the signed-in user's source titles, source URLs, creation dates, and chunk counts. Results are grouped by source ID and scoped to the authenticated owner.

### Add a text source

`POST /api/v1/ai/knowledge`

```json
{
  "title": "Python learning notes",
  "content": "Paste at least 40 characters of learning material here...",
  "source_url": "https://example.com/notes"
}
```

The API splits text into overlapping chunks, embeds each chunk with BGE-M3, and stores the vectors under the authenticated user. It does not fetch arbitrary URLs; `source_url` is citation metadata only.

### Ask NeuralPath

`POST /api/v1/ai/chat`

```json
{
  "question": "Explain the key concept from my notes."
}
```

The API embeds the query, retrieves up to six private chunks through the RLS-aware RPC, then generates an answer. Returned source references map to `[S1]`, `[S2]`, etc.

### Delete a source

`DELETE /api/v1/ai/knowledge/:sourceId`

Deletes all chunks and embeddings for that source, scoped to the authenticated owner.

## Security and operations

- Provider keys are used only by the NestJS API.
- Supabase RLS is enabled on both new tables.
- The retrieval RPC uses caller privileges and filters by `auth.uid()`.
- Source content is treated as untrusted prompt context, never as instructions.
- Usage events record provider, model, operation and character counts, not prompts or API keys.
- Chat is limited to 10 requests/minute per user and ingestion to 5 requests/minute per user.
- Each ingestion request is capped at 50,000 characters; each chunk is capped at 1,200 characters.
- Embedding responses are validated for exactly 1,024 finite values before storage.
- The application returns a service-unavailable response when Gemini is down and paid Groq fallback is disabled. It never silently enables paid usage.

## Current scope and known follow-ups

This phase provides text ingestion, vector persistence, private semantic retrieval, grounded chat, source deletion, and usage telemetry. File uploads, PDF extraction, curated shared knowledge, hybrid keyword search, reranking, prompt evaluations, and adaptive learning are separate follow-up work and must not be described as implemented.
