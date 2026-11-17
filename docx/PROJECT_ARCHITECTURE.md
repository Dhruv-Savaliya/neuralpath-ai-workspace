# NeuralPath — Project Architecture
Version 1.0 · 17 November 2026

## Product intent
NeuralPath is a profession-agnostic learning platform for students, professionals, freelancers, founders, career changers, creators and lifelong learners. Learners can maintain multiple interests and goals. AI supports the experience; it is not the only product value.

## System architecture
Browser (Next.js App Router) → server components/actions/route handlers → Supabase Auth + PostgreSQL with RLS → future server-side AI orchestration → embedding and retrieval services.

### Technology
- Next.js 15, React 19, TypeScript, Tailwind CSS v4.
- Supabase Auth for identity and sessions.
- @supabase/ssr for cookie-based server/browser clients.
- Supabase PostgreSQL for profiles, preferences, goals, paths and progress.
- PostgreSQL Row Level Security for data authorization.
- Vercel for hosting and environment-specific secrets.
- Future: pgvector and replaceable server-side AI/embedding providers.

## Application layers
1. Presentation: public pages, auth, onboarding, dashboard, settings.
2. Identity: Supabase Auth; validate sessions server-side with auth.getUser().
3. Domain services: server actions validate input and derive owner ID from the authenticated user.
4. Persistence: private user-owned tables with RLS, foreign keys and constraints.
5. AI services (future): server-only provider adapters; retrieval always filters by authenticated owner before context is returned.

## Core entities
- auth.users: Supabase-managed identity.
- profiles: one row per user; display name, profession, experience, interests, timezone and onboarding status.
- learner_preferences: formats, pace, language and weekly availability.
- learning_goals: multiple goals per user with desired outcome, level, target date, time budget, priority and status.
- learning_paths: plans owned by a user and linked to that user's goal.
- learning_path_items: ordered lessons, exercises, projects and milestones.
- learning_progress: completion and reflection records.

Every user-owned table contains user_id (or an equivalent owner key), references auth.users with ON DELETE CASCADE, and has RLS enabled. Child records must be proven to belong to the same owner as their parent.

## Authentication and onboarding flow
1. User signs up with email/password through Supabase Auth.
2. Email verification is enabled for production; callback exchanges the one-time code for a cookie-backed session.
3. An Auth trigger creates a minimal profile with safe defaults. It never trusts role metadata.
4. Protected onboarding collects current situation, interests, experience, goal(s), weekly time and learning preferences.
5. Server validates all values and derives the owner from auth.getUser(); it ignores any client-supplied user ID.
6. Profile, preferences and goals are saved; onboarding is marked complete only after successful writes.
7. User enters the protected dashboard. Profile and goals remain editable.

## Security model
- Deny by default. Enable RLS on every private table exposed through the Supabase Data API.
- Use explicit SELECT/INSERT/UPDATE/DELETE policies scoped to auth.uid().
- Profiles: no direct client INSERT/DELETE; users can update only approved profile columns. Role is not user-editable.
- Child rows: policy checks owner and parent ownership. Database constraints/triggers prevent mismatched owner references.
- No service-role key in browser code or NEXT_PUBLIC variables.
- Never trust user_id, owner_id, role, onboarding status or permissions from client payloads.
- Use server-side input validation, bounded strings/arrays, enums, foreign keys and safe redirects.
- Use secure cookie sessions; never store auth tokens in localStorage.
- Rate-limit future AI endpoints. Do not log credentials, tokens or sensitive prompts.
- RLS is the authorization boundary; middleware is only a navigation/session convenience.
- SECURITY DEFINER functions must use a fixed search_path, minimal grants and a narrowly scoped purpose.

## Environment variables
Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
Optional only when a server feature requires it: SUPABASE_SERVICE_ROLE_KEY and server-only AI provider keys. Never prefix secrets with NEXT_PUBLIC. Commit placeholders only in .env.example.

## Future AI / RAG architecture
Server-side ingestion validates file type and size, extracts text, chunks with overlap and stores metadata. Embeddings are generated server-side and stored with owner_id. Every vector search must filter by the authenticated owner before returning chunks. The model is not an authorization mechanism. Re-check ownership when retrieving source files. Apply retention and deletion rules to source, chunks and embeddings together.

## Deployment and quality gates
Review and apply migrations to a staging Supabase project first; back up production; configure Supabase Auth redirect allowlists and Vercel variables; deploy Preview; test sign-up, callback, sign-in, sign-out and onboarding; then run two-user RLS tests for every CRUD operation. A committed SQL migration is not applied automatically by Git push. Release only after lint, typecheck, build, auth smoke tests and cross-user isolation tests pass.
