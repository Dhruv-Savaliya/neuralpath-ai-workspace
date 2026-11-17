# NeuralPath API (NestJS)

Separate NestJS service. Next.js is the web client; Supabase Auth is identity and Supabase Postgres remains the source of truth.

## Local setup
Requires Node.js 20+ and the NeuralPath Supabase schema.
    cd apps/api
    npm install
    cp .env.example .env
    npm run start:dev
Default origin http://localhost:4000; health GET /api/v1/health.

## Environment
PORT (default 4000), WEB_ORIGINS (comma-separated exact frontend origins), SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
Never use the service-role key for ordinary learner requests. Protected requests send Authorization: Bearer <access_token>. The API verifies the token with Supabase Auth and uses the same JWT for database queries, preserving RLS.

## API (prefix /api/v1)
- GET /health — liveness
- GET /dashboard — profile, goals, paths, path items, progress and stats
- GET /profile; PATCH /profile — current learner profile
- GET /goals; POST /goals — list/create owned goals
- PATCH /goals/:id; DELETE /goals/:id — update/delete owned goals
- POST /progress — upsert progress for an owned path item

All learner routes require a valid Supabase access token. Owner IDs come from verified identity, never request body. DTOs reject unknown properties and validate bounds/enums. Global throttling and Helmet are enabled.

## Deployment
Deploy this directory as a separate Node service. Set the environment variables above and WEB_ORIGINS to the production web origin. Do not configure the web client to use the API until its health endpoint returns ok.
