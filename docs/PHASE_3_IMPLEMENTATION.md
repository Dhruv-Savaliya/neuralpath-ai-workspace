# Phase 3 — Personalized workspace API

## Monorepo structure
This repository uses npm workspaces and Turborepo:
- `apps/web`: Next.js frontend.
- `apps/api`: NestJS backend.
- `supabase/migrations`: PostgreSQL schema.
- `render.yaml`: Render Free API blueprint.

## Implemented
- Separate NestJS service with `/api/v1` prefix and health endpoint.
- Supabase access-token validation; the API passes the user's JWT to Postgres so RLS remains active.
- Dashboard aggregation, profile read/update, learning-goal CRUD, progress upsert.
- DTO validation, Helmet, CORS and throttling.
- Typed frontend API client.
- npm workspace scripts and Turborepo task graph.
- Render free-service blueprint and GitHub Actions validation.

## Not yet complete
- Connect dashboard screens to the API client and remove local-only progress paths.
- Persist learning path and path-item creation/updates.
- Add project, resource and assessment workflows.
- Add integration tests proving user isolation and progress persistence.
- Deploy Render service, configure exact CORS origin, set Vercel API origin, and test both services together.
- Confirm the existing Supabase migration is applied and verify schema against service queries.

## Local commands
```bash
npm install
npm run dev
npm run dev:web
npm run dev:api
npm run lint
npm run typecheck
npm run build
```

## Free deployment
Vercel Hobby frontend (personal/non-commercial use only), Render Free NestJS web service, Supabase Free Auth/Postgres. Read `docs/FREE_TIER_ARCHITECTURE.md` for quotas and limitations. No paid plan is authorized by this project plan.
