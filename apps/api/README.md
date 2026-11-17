# NeuralPath API (NestJS)

This is the separate backend app in the Turborepo monorepo. The Next.js web app lives in `apps/web`; Supabase Auth and PostgreSQL remain identity and data services.

## Local development
From repository root:
```bash
npm install
npm run dev:api
```
API health: `http://localhost:4000/api/v1/health`.

## Environment
Copy `.env.example` to `.env` in this directory.
- `PORT`: defaults to 4000 locally; Render injects its assigned port.
- `WEB_ORIGINS`: comma-separated exact frontend origins.
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Never use the service-role key for ordinary learner requests. Protected requests send `Authorization: Bearer <access_token>`. The API verifies the token with Supabase Auth and uses the same JWT for database queries, preserving RLS.

## API (`/api/v1`)
- GET `/health` — liveness
- GET `/dashboard` — profile, goals, paths, items, progress and stats
- GET/PATCH `/profile` — current learner profile
- GET/POST `/goals` — list/create owned goals
- PATCH/DELETE `/goals/:id` — update/delete owned goals
- POST `/progress` — upsert progress for an owned path item

All learner routes require a valid Supabase access token. Owner IDs derive from verified identity, never request body. DTOs reject unknown properties and validate bounds/enums. Global throttling and Helmet are enabled.

## Free Render deployment
A blueprint is provided at repository root as `render.yaml`. It selects the Free web-service plan, uses this folder as the service root, and configures the health check. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `WEB_ORIGINS` in Render's environment screen. Do not enable paid add-ons. Free services sleep after 15 minutes idle and may take about a minute to wake.
