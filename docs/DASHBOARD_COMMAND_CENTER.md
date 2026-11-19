# NeuralPath Dashboard — Command Centre Redesign

## Scope
This change is isolated to `feat/dashboard-command-center-redesign`. It does not change the production branch, database schema, authentication provider, or API contracts.

## Reference direction
The supplied references informed the visual direction:
- Dark navy and light cool-white workspace variants.
- Compact brand mark, left navigation, top search/profile controls.
- Clear learning overview with a personalized next-step hero.
- Progress metrics, learning activity, curriculum progress and AI companion entry point.
- Responsive layout inspired by the supplied mobile dashboard examples.

## Existing application foundations retained
- Next.js 15 / React 19 / TypeScript.
- Tailwind CSS v4 and existing global CSS design system.
- Framer Motion for reduced-motion-aware entrance transitions already present in the dashboard.
- Lucide React icons.
- Supabase-backed API client and existing NestJS endpoints.
- Existing dashboard views: overview, learning path, insights, goals, profile, achievements and AI tutor.

No additional UI dependency was added. The current stack already includes the required motion and icon packages; the dashboard chart remains a lightweight CSS-based visualization rather than adding a chart bundle for one view.

## Implemented in this branch
1. **Brand consistency** — uses the existing `/icon.svg` brand asset in the dashboard sidebar.
2. **Global workspace search** — searches loaded learning-path tasks and saved goals; results navigate to the matching roadmap day or goals view. Escape closes the result panel; Enter opens the first result.
3. **AI companion card** — a clear dashboard entry point to the existing AI tutor view. It does not create a second AI endpoint or fake assistant response.
4. **Visual hierarchy** — refreshed hero, card surfaces, metrics, panel spacing, and brand glow while retaining existing page data.
5. **Responsive behaviour** — desktop search, compact mobile search toggle, single-column dashboard panels on narrow widths, and smaller 360px layout adjustments.
6. **Light theme** — added dashboard-specific light surfaces, text, borders, chart, cards, navigation, search, and task states using the existing `data-theme` switch.
7. **Accessibility** — labelled search input, keyboard Escape/Enter handling, listbox result labels, focus-visible treatment, and existing reduced-motion support.

## Search behaviour
Search is client-side over the already loaded dashboard payload. It is not a global server-side search and does not search AI chat history, uploaded files, or all users' data. The query is cleared after a result is selected.

## Supabase and API safety
- No schema or migration changes were made.
- No new direct database query or RLS policy was introduced.
- Dashboard data continues through the existing `neuralPathApi` client and authenticated API flow.
- Existing Supabase public tables inspected for the dashboard have RLS enabled.
- Supabase security advisor currently reports a warning that leaked-password protection is disabled and five private-schema tables with RLS but no policies. Those are existing project findings, not caused by this UI branch; review them separately before production hardening.

## Infrastructure review
- **Vercel:** existing project `neuralpath-ai-workspace` is connected to the repository. This branch is not the production branch. A preview deployment should be checked after the branch push/PR event.
- **Render:** existing `neuralpath-api` service is configured to deploy from `main`; this UI-only change does not require changing its branch or redeploying the API.
- **Supabase:** existing project `neuralpath` is active and remains unchanged.
- **Framer:** the connected workspace contained a project named `Philosophical Building`, not a NeuralPath project. It was left untouched; the actual Next.js app is implemented in GitHub rather than creating a parallel Framer site.

## Verification checklist
Run from repository root:
```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Then check the preview at:
- 360 × 800
- 390 × 844
- 430 × 932
- 768 × 1024
- 1024 × 768
- 1280 × 800
- 1440 × 900
- 1920 × 1080
- 2560 × 1440

Manual scenarios:
1. Sign in and confirm existing user-specific goals and learning paths load.
2. Search for a saved task and open its correct roadmap day.
3. Search for a saved goal and open the goals panel.
4. Test empty search and no-result messaging.
5. Open AI tutor using the companion card.
6. Toggle light/dark theme and refresh to verify persistence.
7. Check sidebar open/close, search, and cards on mobile.
8. Complete a roadmap task and confirm the saved progress refreshes.
9. Check browser console and Vercel preview logs.

## Verification status
The source changes are committed to this feature branch. Build, lint, typecheck, browser viewport tests, and a live Vercel preview are not marked as passed until their actual results have been inspected. Do not merge to `main` until those checks pass.
