# NeuralPath — Product Vision & Development Roadmap

## Product vision
NeuralPath is an AI-powered personalized learning platform for people across professions. It helps each learner define a goal, understand their starting point, follow an adaptive learning path, build practical skills, and measure progress.

**Positioning:** Your goals. Your path. Your growth.

The platform is profession-agnostic. Example journeys include software development, AI and data, design, marketing, business, finance, product management, communication, and academic learning. These are examples, not a closed list.

## Product principles
1. Personalization starts with the learner's goal, not a fixed curriculum.
2. AI recommendations should be grounded in curated or user-provided learning material where possible.
3. Learners control their goals, profile, learning history, and data.
4. Progress is measurable, explainable, and editable.
5. Free-tier AI services are used responsibly with quotas, caching, and provider fallbacks.
6. Never expose provider secrets in browser code or NEXT_PUBLIC variables.
7. Build accessible, responsive experiences for mobile, tablet, and desktop.
8. Preserve existing working dashboard features during the migration.

## Phase 1 — Complete public website
- Home: hybrid futuristic hero, clear product explanation, profession pathways, how it works, feature highlights, privacy messaging, FAQs, and CTA.
- About: mission, vision, product philosophy, and who NeuralPath serves.
- Features: personalized learning paths, AI mentor, projects, progress analytics, and knowledge library.
- How it works: discover, onboard, generate a path, learn, review, adapt.
- FAQ and Contact pages.
- Privacy and Terms pages, clearly treated as drafts until legally reviewed.
- Custom not-found and error states.
- Shared responsive header, accessible mobile navigation, footer, design tokens, SEO metadata, sitemap, robots, Open Graph metadata, and reduced-motion support.

## Phase 2 — Authentication and onboarding
Account creation and sign-in lead into onboarding when the learner profile is incomplete. Returning users with completed onboarding go directly to their workspace.

Onboarding is a short, resumable multi-step flow:
1. Intent: what the learner wants to learn or achieve; free-text goal plus suggested categories.
2. Profession/context: current profession or study context, with options for exploring, career change, or other.
3. Starting point: beginner, familiar, intermediate, or advanced; optionally capture known skills.
4. Outcome: career transition, promotion, project, certification, academic support, or personal interest.
5. Time commitment: minutes per day, days per week, optional target date.
6. Learning preferences: reading, video, hands-on projects, guided exercises, quizzes, or mixed.
7. Profile review: show the proposed profile and let the learner confirm or edit before generating a plan.

Do not force a fixed profession taxonomy. Support custom goals and multiple learning interests. Allow optional questions to be skipped, show progress, and save drafts.

## Learner profile
Store structured, editable profile data: identity/display preferences; profession/context and experience level; learning goals and desired outcomes; known, in-progress, and target skills; preferred formats; weekly availability and target date; onboarding version and timestamps. AI inferences are suggestions, never facts, and users can correct or delete them.

## Phase 3 — Personalized workspace
- Overview: today's focus, next action, progress, and weekly goal.
- Learning path: phases, modules, lessons, prerequisites, and milestones.
- Tasks and practice with clear completion criteria.
- Projects and portfolio-oriented deliverables relevant to the selected goal.
- Curated resources and user-authorized uploads.
- Assessments and periodic knowledge reviews.
- Progress analytics, consistency, milestones, and reflections.
- Contextual AI mentor, profile, and settings.

Keep existing XP, streaks, achievements, and the 45-day AI Engineering curriculum as one available path, not the default experience for everyone.

## Phase 4 — AI and knowledge architecture
### Provider abstraction
Implement a server-only AI provider interface. Evaluate providers/models on current free-tier quotas, latency, quality, data policies, regional availability, and commercial-use terms. Keep model selection replaceable.

All model calls go through server routes/actions with authentication, per-user rate limits, input/output validation, usage budgets, timeouts, retries, graceful fallback, caching, prompt versioning, and observability. Never expose provider secrets in client bundles or NEXT_PUBLIC variables.

### Embeddings, chunking, and retrieval
1. Ingest curated learning resources and user-authorized uploads.
2. Extract text and metadata, preserving source title, URL/file, owner, and permissions.
3. Normalize text and split into semantic chunks with configurable size and overlap.
4. Generate embeddings using a replaceable provider/model.
5. Store vectors and metadata in a vector-capable store; evaluate Supabase pgvector first.
6. Retrieve by semantic similarity with metadata filters and user/tenant isolation.
7. Optionally rerank retrieved chunks.
8. Build grounded prompts with source references; require grounded answers for knowledge tasks.
9. Evaluate retrieval quality and answer quality.

Never mix private user documents across accounts. Enforce authorization before retrieval, not only in prompts. Support deletion of source documents and derived chunks/embeddings.

### AI capabilities, delivered incrementally
- Goal-to-roadmap generation with structured JSON and validation.
- AI mentor grounded in relevant learning resources.
- Lesson explanations adapted to learner level.
- Quiz and practice generation with answer validation.
- Project mentor and milestone breakdown.
- Progress reflection and next-step recommendations.
- Skill-gap analysis based on completed assessments and work, not unsupported assumptions.

AI must not autonomously change learner goals or mark work complete. Learners confirm meaningful changes.

## Data and security foundation
Use Supabase Auth and Postgres as the initial backend, with RLS on every user-owned table. Evaluate pgvector for embeddings. Keep service-role credentials server-only.

Suggested entities: profiles, learner_goals, learner_skills, learning_preferences, learning_paths, path_modules, lessons, learning_tasks, task_completions, assessments, assessment_attempts, projects, resources, resource_chunks/embeddings, ai_conversations/messages, ai_usage_events, user_activity, and achievements.

Use foreign keys, indexes, constraints, timestamps, and ownership policies. Avoid collecting sensitive profile information unless essential and explicitly provided.

## Delivery phases
1. Public website: hybrid design system and complete public pages; responsive, accessible, SEO-ready.
2. Auth and onboarding: Supabase authentication, resumable onboarding, editable profile, RLS, and migrations.
3. Personalized workspace: dynamic paths, tasks, projects, resources, progress, and cloud persistence.
4. AI foundation: provider abstraction, secure server-side calls, structured outputs, quotas, logs, and evaluations.
5. Knowledge/RAG: ingestion, chunking, embeddings, pgvector retrieval, citations, ownership isolation, and deletion.
6. Adaptive learning: roadmap updates, mentor, quizzes, projects, and learner-approved recommendations.
7. Quality and launch: tests, accessibility, security review, performance, mobile QA, and monitoring.

## Definition of done
- TypeScript checks, ESLint, and production build pass.
- Core flows tested at mobile and desktop breakpoints.
- No secrets committed.
- Supabase RLS and authorization tested where relevant.
- Existing features preserved or migrated deliberately.
- Deployment verified before declaring success.

## Current repository baseline
The existing project is a Next.js 15 / React 19 / TypeScript / Tailwind CSS v4 application. Its README describes a local-first AI Engineering dashboard with a 45-day curriculum and browser localStorage progress. The public site and profession-agnostic onboarding are new work; Supabase-backed auth, cloud progress, embeddings, and RAG must not be described as implemented until built and tested.