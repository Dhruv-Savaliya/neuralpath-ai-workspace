# NeuralPath — UI/UX Specification
Version 1.0 · Phase 2 · 17 November 2026

## 1. Experience direction
Hybrid visual language: polished editorial marketing pages plus a calm, focused learner workspace. Retain the deep navy foundation, violet and cyan accents, subtle glass surfaces and restrained glow. Readability and trust take priority over decoration.

## 2. Design principles
- Learner ambition is the hero; AI is a supporting capability.
- Use plain, inclusive language.
- One primary action per step.
- Show progress; allow back navigation.
- Clearly mark optional questions.
- Mobile-first forms with large touch targets.
- No guaranteed career or mastery claims.
- Respect reduced motion and accessible contrast.

## 3. Visual tokens
Background: deep navy/near-black. Surfaces: layered navy/slate panels. Primary accent: soft violet. Secondary accent: ice cyan. Primary text: near-white. Secondary text: muted blue-grey. Use semantic success/warning/error styles with text labels. Use restrained borders, modest radii and short transitions.

## 4. Navigation
Header: NeuralPath, Features, How it works, About, FAQ, Sign in, Get started. Footer: product, support and legal links. Mobile navigation must preserve access to sign-in and onboarding entry points.

## 5. Authentication screens
Sign up: display name (optional), email, password. Password minimum 8 characters; explain that passwords are managed by Supabase Auth. Primary action Create account; secondary Sign in. After submission show a neutral check-your-inbox state. Do not reveal account enumeration details.
Sign in: email and password, primary Sign in, secondary Create account. Show a generic invalid credentials error. Password reset should be offered only after its flow is implemented.
Errors are concise and actionable; never show SQL or provider stack traces.

## 6. Onboarding wizard
Use five clear sections with a persistent step indicator and Back/Continue controls. Preserve answers when navigating backwards. Validate current step only. Provide a review step before final save.

Step 1 — About you: student, working professional, freelancer, founder, career changer, creator, exploring, other. Optional display name and timezone. Do not ask for employer or sensitive demographics.
Step 2 — Interests: technology, design, business, marketing, finance, data, science, communication, leadership, creative arts, health/fitness, languages, personal growth and custom interest. Multi-select; no single-profession lock-in.
Step 3 — Starting point: beginner, some experience, intermediate, advanced.
Step 4 — Goals: one or more goal cards; title, category, desired outcome, current level, optional target date and weekly time budget. At least one goal is required.
Step 5 — Learning style: reading, videos, hands-on projects, exercises, audio, guided explanations; pace relaxed, balanced or intensive; weekly time.
Review: summarize profile and goals with edit affordances.

## 7. Interaction states
Show progress, pending and disabled submit states; prevent duplicate submits; preserve data after network errors; announce validation; show save success. User can edit profile and goals later. Never make a form appear successful before server confirmation.

## 8. Learner workspace
Future dashboard sections: profile summary, active goals, recommended next action, learning paths, recent activity and progress. The AI Engineering dashboard is one selectable path. Empty state invites a learner to create a goal or generate a path when that feature exists.

## 9. Component inventory
AuthForm; StepProgress; ChoiceCard; InterestPicker; GoalEditor; TimeBudget; LearningFormatPicker; ReviewSummary; FormError; FormSuccess; ProtectedShell.

## 10. Accessibility
Keyboard operation, visible focus, persistent labels, field-associated errors, screen-reader announcements, WCAG AA text contrast, browser zoom, 44px touch targets, reduced motion, and accessible names for icon-only controls.

## 11. Trust and content
Explain why each profile field is requested. Keep goals private. Do not describe AI output as guaranteed, credentialed or professional advice. Provide clear privacy, account and data-control access.
