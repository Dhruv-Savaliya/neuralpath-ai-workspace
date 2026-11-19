# NeuralPath — Branding, themes and developer guide

> Product and implementation guide for the NeuralPath monorepo. This document describes the current architecture and the branding/theme work introduced on the `feature/neuralpath-branding-themes-docs` branch. Verify the deployment and CI checks before treating any change as production-ready.

## 1. Product overview

NeuralPath is a personalized learning workspace. It helps learners translate goals and interests into a structured learning journey, track progress, and access supportive AI-powered learning tools. The product is designed for students, working professionals, career changers, creators and lifelong learners.

**Product principle:** AI supports the learner; the learner remains in control of goals, decisions and progress.

## 2. Brand identity

### Name and positioning
- Product name: **NeuralPath**
- Suggested tagline: **Your goals. Your path. Your growth.**
- Brand personality: thoughtful, capable, optimistic, focused and modern.
- Visual direction: a clear, compact N-shaped path mark with a subtle star/forward-motion cue.

### Colour system
| Token | Dark theme | Light theme | Purpose |
|---|---|---|---|
| Background | Deep navy `#080B14` | Cool near-white `#F5F7FC` | Main canvas |
| Surface | `#111725` | `#FFFFFF` | Cards and panels |
| Primary | Violet `#A99AFF` | Indigo `#6254D9` | Primary actions |
| Accent | Cyan `#72D9ED` | Blue-cyan `#168DAF` | Highlights and progress |
| Text | `#EDF2FF` | `#172033` | Main content |
| Muted | `#8794AB` | `#657189` | Secondary content |
| Border | Translucent cool blue | `#DDE3EF` | Separation |

Use gradients sparingly for primary actions, progress and brand emphasis. Keep long-form text on solid surfaces for legibility.

### Icon assets
- `apps/web/public/icon.svg` is the scalable brand favicon/app mark.
- Use the same mark for browser identity and compact brand placements.
- Avoid using a full poster or screenshot as a favicon; the icon must remain recognizable at 16–32 px.

## 3. Theme behaviour

The theme control switches between Dark and Light modes.
- Dark is the default first-visit theme.
- The selected theme is saved in browser local storage under `neuralpath-theme`.
- The current selection is applied to the root document as `data-theme="dark"` or `data-theme="light"`.
- The root `color-scheme` is updated so native browser controls follow the selected appearance.
- The control is available across the app from the shared root layout.
- Theme selection is local to the current browser/device; it is not an account-level Supabase preference.

### Theme implementation
- Component: `apps/web/app/components/theme-control.tsx`
- Global styles: `apps/web/app/globals.css`
- Root layout and metadata: `apps/web/app/layout.tsx`
- Icon: `apps/web/public/icon.svg`

When adding a new component, prefer semantic design tokens and theme-aware CSS over hard-coded dark-only colours. Check text, borders, hover/focus states, disabled states, charts, dialogs, forms and empty/loading states in both themes.

## 4. Technology architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 15, React 19, TypeScript | Routing, UI, server/client components |
| Styling | Tailwind CSS v4 + global CSS | Responsive layout and visual system |
| Motion/icons | Framer Motion, Lucide React | Motion and interface iconography |
| API | NestJS 11 | REST API and business logic |
| Persistence/auth | Supabase Auth + PostgreSQL + RLS | Identity and user-scoped data |
| Monorepo | npm workspaces + Turborepo | Shared scripts and build orchestration |
| Web hosting | Vercel | Next.js deployment |
| API hosting | Render | NestJS service |

The project repository is `https://github.com/Dhruv-Savaliya/neuralpath-ai-workspace`. The configured public web address is `https://neuralpathx.vercel.app`.

## 5. Repository map

```text
apps/
  web/                 Next.js frontend
    app/               Routes, layouts, global styles and UI
    lib/               API client and frontend utilities
    public/            Static assets (including icon.svg)
  api/                 NestJS backend
packages/              Shared packages, where applicable
supabase/
  migrations/          Database migrations
docs/                  Project and implementation documentation
render.yaml            Render service blueprint
turbo.json             Turborepo task configuration
package.json           npm workspace scripts
```

## 6. Local development

### Requirements
- Node.js 20 or newer (Node 22 recommended)
- npm 10+
- Supabase project credentials for authenticated data flows
- API environment values for backend integration

### Install and run
```bash
npm install
npm run dev
```

The web app is expected at `http://localhost:3000`; the API health endpoint is expected at `http://localhost:4000/api/v1/health`.

Run one application:
```bash
npm run dev:web
npm run dev:api
```

## 7. Environment configuration

Copy the examples before configuring local values:
```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

The web application uses the Supabase URL and publishable/anon key plus `NEXT_PUBLIC_API_BASE_URL` when the API is deployed. The API uses its Supabase URL and publishable key plus the allowed web origins.

Never commit secrets. Never expose Supabase service-role keys, database passwords, or AI provider keys through `NEXT_PUBLIC_*` variables.

## 8. Existing product areas

The current web routes and dashboard code include:
- Public marketing pages describing the product and learning approach.
- Authentication and onboarding flows.
- A learner workspace/dashboard.
- Learning goals and learning paths.
- Task progress and activity/insight surfaces.
- Learner profile and achievements areas.
- AI tutor and learning resource/library surfaces.

The dashboard reads workspace information through the frontend API client. Treat the backend and database as the source of truth for persisted learner information. Do not replace live flows with hard-coded success messages or mock data.

## 9. Responsive design standards

The UI should remain usable from **360 px through 2560 px**.
- Use mobile-first Tailwind utilities and fluid sizing such as `clamp()`.
- Keep layouts inside the viewport; avoid horizontal page scrolling.
- Use a compact navigation pattern on small screens and a full navigation layout on larger screens.
- Use sensible maximum content widths on ultrawide displays.
- Ensure cards and forms collapse into one column when needed.
- Test keyboard focus, touch target size, text wrapping and long user-generated content.

Recommended manual viewport checks: 360, 390, 430, 768, 1024, 1280, 1440, 1920 and 2560 px.

## 10. Quality checks

Run the checks from the repository root:
```bash
npm run lint
npm run typecheck
npm run build
```

Also manually verify:
1. Public pages in both themes.
2. Sign-in, sign-up and onboarding in both themes.
3. Dashboard, goals, profile, roadmap and AI surfaces in both themes.
4. Theme persistence after refresh and route navigation.
5. Mobile navigation and the theme control at 360–430 px.
6. Keyboard focus and screen-reader label for the theme control.
7. API health, authenticated Supabase reads/writes, user isolation and task progress.
8. Vercel and Render deployment logs after CI/build completion.

A successful code change or domain attachment does not by itself prove the complete product is production-ready. Confirm actual build, runtime, authentication and persistence behaviour.

## 11. Deployment

### Vercel web
- Root directory: `apps/web`
- Include source files outside the root directory for the monorepo build.
- Install command: `cd ../.. && npm install`
- Build command: `cd ../.. && npx turbo run build --filter=@neuralpath/web`
- Production domain: `neuralpathx.vercel.app`

### Render API
Use the existing `render.yaml` blueprint and configure the required Supabase values and exact production web origin in Render environment settings. Confirm the API health endpoint before relying on live frontend integration.

### Supabase
Apply migrations in order and confirm Row Level Security policies are enabled for user-owned data. Do not bypass RLS to make the UI appear functional.

## 12. Security and privacy

- Keep secrets on the server.
- Use Supabase RLS for user isolation.
- Validate API input on the server.
- Do not trust client-provided user IDs for authorization.
- Avoid logging access tokens, passwords or private learner data.
- Keep AI outputs clearly distinguishable from verified system data.

## 13. Contribution workflow

1. Create a feature branch from the current `main`.
2. Make a focused change and keep existing product behaviour intact.
3. Run lint, typecheck and build.
4. Test both themes and responsive breakpoints.
5. Open a pull request with screenshots and a concise test report.
6. Merge only after checks pass and deployment status is verified.

## 14. Known verification boundary

This guide records the architecture and code surfaces inspected for this update. It does not claim that a production build, browser visual regression, API integration test or full device test has passed unless a corresponding result is recorded separately. Theme coverage should be reviewed component-by-component as the product evolves.
