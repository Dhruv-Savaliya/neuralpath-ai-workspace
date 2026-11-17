# NeuralPath — Personalized Learning Platform

NeuralPath is an AI-powered learning platform designed for people across professions. Learners define what they want to achieve, share their starting point and preferences, and build a learning journey that can evolve with them.

**Product promise:** Your goals. Your path. Your growth.

## Current stack
- Next.js 15 / React 19 / TypeScript
- Tailwind CSS v4
- Framer Motion and Lucide icons
- Vercel deployment

## Public website
- Home / landing page
- About
- Features
- How it works
- FAQ
- Contact
- Privacy and Terms (drafts requiring review)

## Existing learning workspace
The original 45-day AI Engineering learning dashboard is preserved at `/dashboard`. It remains one learning path among many; it is not the product's only profession.

## Product roadmap
See [docs/PRODUCT_VISION_AND_ROADMAP.md](docs/PRODUCT_VISION_AND_ROADMAP.md) for the full plan covering profession-agnostic onboarding, editable learner profiles, Supabase authentication and persistence, adaptive learning paths, AI provider abstraction, embeddings, chunking, vector retrieval, RAG, and launch quality gates.

## Local development
```bash
npm install
npm run dev
``

Open http://localhost:3000.

## Build and checks
```bash
npm run lint
npm run build
``

## Current implementation status
The public website and existing dashboard are implemented in the repository. Authentication, onboarding persistence, Supabase-backed profiles/progress, AI provider integrations, embeddings, and RAG are planned work and must not be considered live until separately implemented, tested, and deployed.

## Environment variables
No AI provider secrets belong in client-side variables. Supabase browser-safe configuration may use the public project URL and publishable key. Server-only keys must never use a `NEXT_PUBLIC_` prefix and must never be committed.
