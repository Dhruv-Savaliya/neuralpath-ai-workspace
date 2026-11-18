# Phase 6 — Adaptive learning and learner intelligence

## Goal

Turn the existing 45-day roadmap into a genuinely adaptive learning workspace. Recommendations must be based on the signed-in learner's saved profile, preferences, goals, roadmap and progress — never on demo data or fabricated activity.

Phase 6 is additive. It must not rewrite completed progress, silently change a learner's roadmap, or introduce paid infrastructure.

## Existing data to reuse

- `profiles`: display name, profession, experience level, interests, timezone.
- `learner_preferences`: learning formats, pace, weekly minutes, language and preferred days.
- `learning_goals`: goal, desired outcome, current level, target date and priority.
- `learning_paths` / `learning_path_items`: assigned curriculum and task order.
- `learning_progress`: completed tasks, timestamps and reflections.
- Phase 5 private knowledge chunks and retrieval RPC: optional learner-owned reference context.

Do not create a second copy of these facts in a new profile or analytics table.

## Scope

### 6.1 Learner activity and insight API

Build an authenticated read-only endpoint that returns:
- progress by roadmap phase and by week;
- completed and remaining tasks;
- active-day streak derived from saved completion timestamps and the learner timezone;
- study consistency over 7 and 30 days;
- goal status and distance to target dates;
- data freshness and an explicit empty-state indicator.

All counts must be computed from the requesting user's rows. No global user data or cross-account aggregation.

### 6.2 Adaptive recommendation engine

Generate a small number of actionable recommendations from:
- the next incomplete roadmap tasks;
- recent completion history and saved reflections;
- goal priority and target date;
- weekly time budget, pace, preferred learning formats and language;
- optional relevant personal knowledge retrieved from Phase 5.

Recommendations should include a reason, estimated time, related task/goal IDs, confidence or evidence, and a clear action. The AI may explain and prioritize; deterministic validation must constrain its output to real task and goal IDs.

### 6.3 Learner-controlled plan adjustments

The system may suggest:
- a shorter or longer daily workload;
- revision when the learner has been inactive;
- extra practice after repeated incomplete tasks;
- a next project based on a completed milestone.

It must not change the roadmap, due dates, goals or progress automatically. The learner reviews and explicitly accepts any change. Existing progress and task IDs remain intact.

### 6.4 Feedback and evaluation

Capture whether a recommendation was helpful, ignored or dismissed, with minimal metadata. Build a small offline evaluation set for recommendation relevance, factual grounding, invalid task IDs, latency and provider errors. Never use fabricated production events as evaluation data.

## Provider and cost policy

- Use the configured Gemini primary provider only when its free quota is available.
- Keep Groq GPT-OSS 120B disabled by default; it is token-priced and is not an assumed free fallback.
- Reuse Cloudflare BGE-M3 and Supabase pgvector only where personal knowledge retrieval materially improves a recommendation.
- Do not add a paid vector database, queue, analytics vendor or hosted model.
- If AI is unavailable, show a clearly labelled deterministic next-task suggestion based on saved database records. Do not present it as an AI-generated response.
- Add per-user request limits, bounded prompt/context size, timeouts and provider usage telemetry.

## Proposed API

- `GET /api/v1/learning/insights` — saved learner activity and goal insights.
- `GET /api/v1/learning/recommendations` — recommendations grounded in current learner records.
- `POST /api/v1/learning/recommendations/:id/feedback` — learner feedback.
- `POST /api/v1/learning/recommendations/:id/accept` — explicit approval for a proposed change, with server-side validation.

The final routes and persistence schema must be reviewed before implementation. Prefer reusing existing tables; add a small recommendation/feedback table only if the data cannot be represented safely in current schema.

## Security and privacy

- Every route requires Supabase authentication.
- Enforce user ownership in every query and mutation; never trust a user ID supplied in request JSON.
- Use RLS on any new exposed table.
- Send only the minimum necessary profile/progress context to Gemini. Do not send secrets or sensitive personal data.
- Treat reflections and retrieved knowledge as untrusted input.
- Do not infer health, political, religious or other sensitive traits.
- Log provider/model, operation, latency, outcome and token/character counts where available; never log prompts, reflections or secrets.

## Acceptance criteria

1. A new account with no progress sees an honest empty state and a real next-task suggestion.
2. Completing a task updates insights and recommendation context after refresh.
3. Recommendations refer only to tasks/goals owned by the signed-in user.
4. An AI outage does not fabricate an AI response or corrupt learner data.
5. A recommendation cannot alter the roadmap without explicit approval.
6. Cross-user access tests fail closed.
7. Unit tests cover streak/timezone boundaries, empty history, overdue goals, invalid model output and invalid task IDs.
8. CI lint, typecheck, build and tests pass.
9. Production smoke tests confirm real authenticated responses with the free provider configuration.
10. No paid service or plan is enabled.

## Phase 6 delivery order

1. Finish Phase 5 live AI ingestion/chat acceptance tests and merge the dashboard data-integrity correction.
2. Add learner insights endpoint and tests.
3. Add deterministic recommendation schema and validation.
4. Add Gemini recommendation generation with explicit deterministic fallback.
5. Add learner feedback and explicit plan-acceptance flow.
6. Connect dashboard insights/recommendations UI.
7. Run ownership/security, provider-failure, cost-limit and production acceptance tests.
