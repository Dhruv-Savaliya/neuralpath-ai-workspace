# NeuralPath free-tier hosting policy

## Goal
Keep recurring hosting cost at $0. Do not enable paid plans, paid add-ons, usage-based billing or services that require payment to continue. Recheck provider terms before each deployment.

## Selected stack
| Layer | Provider | Free target | Important limitation |
| --- | --- | --- | --- |
| Web | Vercel Hobby | $0 | Personal/non-commercial use only; usage limits apply |
| API | Render Free Web Service | $0 | Sleeps after 15 minutes idle; cold start about one minute; 750 free instance hours/workspace/month |
| Auth + database | Supabase Free | $0 | 500 MB database per project; free projects may pause after a week of low activity |
| CI | GitHub Actions | Included free usage | Usage quotas and repository eligibility apply |

## Explicit safeguards
- Do not choose paid Render compute or paid Supabase/Vercel plans.
- If a dashboard offers only a paid option, stop and ask before proceeding.
- No Render Postgres: Supabase remains the database.
- No paid persistent disk: uploaded files must use Supabase Storage, not API local disk.
- Do not use a Render free Postgres database for durable learner data; Render documents that free Postgres expires after 30 days.
- Avoid background workers, cron jobs and always-on assumptions on free Render.
- Do not use a paid custom domain; use provider subdomains until the user chooses otherwise.
- Keep provider secrets in provider environment-variable settings, not Git.

## Expected behavior
Render's free API sleeps after 15 minutes without inbound traffic. First request after sleep may wait about one minute. Do not add artificial ping/keep-alive traffic to evade the free-tier lifecycle. Supabase can pause an inactive free project. These are free-tier trade-offs, not application bugs.

## Growth warning
Vercel Hobby is restricted to personal/non-commercial use. If NeuralPath becomes a commercial product, do not assume Vercel Hobby remains eligible. Re-evaluate a genuinely free alternative or seek user approval before any paid upgrade.

## AI and embedding free-tier policy

| Capability | Selected model | Cost / limit policy |
| --- | --- | --- |
| Generation | Gemini 3.7 Flash | Free tier listed by Google for eligible accounts; model-specific quotas apply |
| Optional fallback | Groq GPT-OSS 120B | Paid per token; disabled by default (`GROQ_ENABLED=false`) |
| Embeddings | Cloudflare Workers AI BGE-M3 | Workers Free includes 10,000 Neurons/day; quota exhaustion must fail closed |
| Vector database | Supabase pgvector | Existing Supabase project; no separate vector database |

Do not assume Groq GPT-OSS 120B is free. Current published rates are $0.15 per million input tokens and $0.60 per million output tokens. Keep the Groq secret stored but do not call this provider unless the user explicitly approves paid usage.

Gemini 3.7 Flash has a listed free tier, while newer Gemini models may have different pricing. Pin the configured model to `gemini-3.7-flash` until pricing and eligibility are rechecked.

Cloudflare BGE-M3 is listed at $0.0118 per million input tokens, metered through Workers AI Neurons. The Workers Free daily allowance is 10,000 Neurons. This is a capped free allowance, not unlimited inference. Monitor usage in Cloudflare and stop on quota errors; never upgrade the account automatically.

AI provider keys must remain in Render's server-side Environment settings. Never commit secrets or expose them in browser variables. Avoid sending private credentials or sensitive personal information to free-tier AI providers.
