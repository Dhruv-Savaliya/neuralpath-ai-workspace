# Phase 3 — Personalized workspace

## Architecture
Phase 3 adds a dedicated NestJS API under apps/api. Next.js remains presentation, Supabase Auth remains identity, and Supabase Postgres remains the source of truth. The API verifies Supabase access tokens and uses the same user JWT for database calls so RLS is preserved. No service-role credential is required for normal learner requests.

## Implemented foundation
- NestJS 11 service with TypeScript build configuration and versioned /api/v1 prefix.
- Supabase bearer-token verification guard and user-scoped database client.
- Dashboard aggregation for profile, goals, paths, path items and progress.
- Profile read/update endpoints with allowlisted DTO.
- Goal list/create/update/delete endpoints.
- Progress upsert endpoint.
- DTO validation, unknown-field rejection, Helmet, exact-origin CORS, throttling.
- Health endpoint and local/deployment instructions.

## Remaining Phase 3 work
1. Deploy NestJS service and configure its production origin.
2. Add typed Next.js API client forwarding the signed-in user's access token.
3. Wire the typed Next.js API client into the dashboard and replace local-only progress with server-backed progress.
4. Add path and path-item authoring/generation flows so goals become persisted learning plans.
5. Add projects, resources, assessments, reflections and weekly analytics.
6. Add integration tests for authentication, owner isolation and progress persistence.
7. Complete mobile/desktop QA and verify both deployments.

## Environment
API variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, WEB_ORIGINS and PORT. Web frontend will use a public API origin only after deployment. No service-role key or AI provider secret is needed for this phase.
