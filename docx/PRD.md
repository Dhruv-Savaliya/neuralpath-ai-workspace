# NeuralPath — Product Requirements Document
Version 1.0 · Phase 2 · 17 November 2026

## 1. Summary
NeuralPath turns a learner's ambitions into a practical, personalized and adaptable learning journey. It serves every profession and supports multiple simultaneous interests and goals.

## 2. Problem and value
Generic courses, disconnected resources, unclear next steps and unrealistic schedules make learning difficult to sustain. NeuralPath connects goals, learner context, practical work, resources and progress in one private workspace.

## 3. Audiences
Students; working professionals; freelancers; founders; career changers; creators; lifelong learners.

## 4. Product principles
Profession-neutral; multiple goals; practical next steps; transparent AI assistance; learner control; privacy by default; accessible and mobile-first.

## 5. Phase 2 scope
IN SCOPE: Supabase email/password authentication; email confirmation callback; sign-in/sign-out; protected onboarding and dashboard; learner profile; multiple learning interests; one or more goals; preferences; PostgreSQL schema; RLS; server-side validation; environment template; security test plan.
OUT OF SCOPE: AI roadmap generation, embeddings, chunking, vector search/RAG, billing, social profiles, teams and public learner directories.

## 6. Functional requirements
FR-01 Visitors can register with email/password.
FR-02 Passwords are handled only by Supabase Auth.
FR-03 Production registration requires email verification.
FR-04 Verified users can sign in and sign out.
FR-05 Anonymous users cannot access onboarding or dashboard.
FR-06 Incomplete users are routed to onboarding.
FR-07 Each Auth user has one private profile.
FR-08 User selects current situation: student, employed, freelancer, founder, career changer, creator, exploring or other.
FR-09 User selects multiple interests.
FR-10 User selects experience level.
FR-11 User creates one or more learning goals with title, category, desired outcome, level, optional target date and weekly time.
FR-12 User selects learning formats and pace.
FR-13 User can resume and edit profile information.
FR-14 Server derives owner from authenticated session; client user IDs are ignored.
FR-15 Users can only read or mutate their own rows.
FR-16 Errors are understandable and do not expose SQL/provider internals.
FR-17 Existing AI Engineering workspace remains one learning path, not the only profession.

## 7. Data requirements
Profile: display name, profession, experience, interests, timezone, onboarding version/status.
Goal: title, category, outcome, current level, optional target date, weekly minutes, priority, status.
Preferences: formats, pace, language, weekly time and optional preferred days.
All fields are bounded and validated on the server and by database constraints.

## 8. Non-functional requirements
Security: RLS, least privilege, no browser service key, cookie sessions, server validation.
Privacy: minimal collection, clear purpose, user control and deletion path.
Accessibility: labels, keyboard support, focus states, screen-reader errors and reduced motion.
Reliability: migrations, constraints, foreign keys and idempotent operations.
Performance: fast saves and minimal round trips.
Maintainability: schema changes are version controlled.

## 9. Acceptance criteria
- Sign-up and email verification callback work on Preview and Production.
- Sign-in and sign-out correctly establish/clear sessions.
- Direct anonymous access to protected routes redirects to sign-in.
- Incomplete authenticated users are redirected to onboarding.
- User can save and reload profile, preferences and multiple goals.
- Changing user_id/owner_id/role in a request never grants access.
- User A cannot SELECT, INSERT, UPDATE or DELETE User B's records, including child records.
- Anonymous role cannot access private learner records.
- No service-role or AI secret appears in client assets or Git history.
- Lint, typecheck and production build pass.

## 10. Risks
Email deliverability and redirect allowlists; RLS misconfiguration; long onboarding; AI provider costs; sensitive free-text goals; legacy localStorage progress not syncing to cloud. Mitigate with staged email tests, two-user RLS tests, save/resume, provider abstraction, data minimization and a later controlled progress migration.

## 11. Release definition
Phase 2 is not production-complete until the SQL migration is applied to the intended Supabase project, Vercel variables are set, email redirects are verified, two-user RLS tests pass against the live database, and deployment is green.
