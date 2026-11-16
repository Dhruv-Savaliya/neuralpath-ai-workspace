# NeuralPath — AI Engineering Workspace

A responsive personal learning dashboard built with Next.js, React, TypeScript, Tailwind CSS v4, Framer Motion, and Lucide icons.

## Features
- Daily AI engineering learning plan with 45 progressive topics
- Interactive task checklist and day completion
- XP, levels, streak counter, and achievement badges
- Resource library with official docs and free video lesson searches
- Knowledge checkpoint with reflection input
- Progress saved locally in the browser (`localStorage`)
- Responsive desktop, tablet, and mobile layouts
- Motion-powered page transitions and modal interactions

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Deploy to Vercel
1. Push this project to a GitHub repository.
2. Import the repository at https://vercel.com/new.
3. Keep the detected Next.js framework defaults.
4. Deploy. No environment variables are required for the current local-first version.

## Progress storage
This starter stores progress in the current browser only. It does not sync across devices or authenticate users. Add a database and authentication (e.g. Supabase or MongoDB) before treating progress as cloud-persistent.

## Suggested next production upgrades
- Auth + cloud sync for progress and streaks
- Admin-editable curriculum and lesson links
- Server-side quiz validation and richer question bank
- GitHub API integration for verified commit activity
- Vercel deployment status integration
- Push notifications / daily study reminder
