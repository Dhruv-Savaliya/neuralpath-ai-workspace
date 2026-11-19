# NeuralPath — Turborepo monorepo

NeuralPath is a personalized learning workspace. The web app and API are separate deployable applications in one repository.

## Project documentation

- [Branding, themes and developer guide](docs/BRANDING_THEMES.md) — brand identity, dark/light mode behaviour, architecture, local setup, environment configuration, deployment, security and quality checks.

## Architecture
- `apps/web` — Next.js 15, React 19, TypeScript, Tailwind CSS v4.
- `apps/api` — NestJS 11 REST API.
- Supabase — Auth and PostgreSQL with Row Level Security.
- Turborepo + npm workspaces — shared commands, dependency graph and caching.

## Free-tier deployment targets
- Frontend: Vercel Hobby for personal/non-commercial use.
- Backend: Render Free Web Service (sleeps after 15 minutes idle; first request after sleep can take about a minute).
- Database/Auth: Supabase Free (500 MB database per project; inactive projects may pause after a week).
- CI: GitHub Actions included usage.

These are provider free tiers, not lifetime guarantees. Limits, eligibility and policies can change. Do not add paid add-ons or enter a paid plan for this project. If a provider asks for a payment method or paid upgrade, stop and review before proceeding.

## Repository layout
```
apps/
  web/                 # Next.js frontend
  api/                 # NestJS backend
packages/              # Shared packages (add when needed)
supabase/
  migrations/          # Database migrations
docs/
  PHASE_3_IMPLEMENTATION.md
render.yaml            # Free API service blueprint
turbo.json
package.json           # npm workspace + Turbo entry point
```

## Local development
Requires Node.js 20+ (Node 22 recommended) and npm.

```bash
npm install
npm run dev
```

Web: http://localhost:3000
API: http://localhost:4000/api/v1/health

Run one app:
```bash
npm run dev:web
npm run dev:api
```

## Quality checks
```bash
npm run lint
npm run typecheck
npm run build
```

## Environment
Copy `apps/web/.env.example` to `apps/web/.env.local`.
Copy `apps/api/.env.example` to `apps/api/.env`.

Web needs Supabase URL + publishable key and, after API deployment, `NEXT_PUBLIC_API_BASE_URL`.
API needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WEB_ORIGINS`.
Never put Supabase service-role keys or AI provider secrets in browser variables or commit secrets.

## Deploy
- Vercel: Root Directory `apps/web`; include source files outside the root; install command `cd ../.. && npm install`; build command `cd ../.. && npx turbo run build --filter=@neuralpath/web`.
- Render: create the service from `render.yaml`. It uses `apps/api` as its root and the Free plan. Set the Supabase URL, publishable key and exact production web origin in Render's environment settings.
- Configure `NEXT_PUBLIC_API_BASE_URL` in Vercel only after the Render API health check succeeds.

## Current product status
The UI and initial NestJS endpoints are foundations, not a claim that every planned learning feature is complete. Read `docs/PHASE_3_IMPLEMENTATION.md` for the remaining integration and test work.
