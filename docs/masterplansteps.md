# Fitbear AI — Master Plan Steps (SSOT)

> This file is the single source of truth. Update it after every step: status, notes, and acceptance proof links/screenshots.

## Status Legend
- [ ] Backlog
- [~] In Progress
- [x] Done
- [!] Blocked (note cause + next action)

## 0. Project Setup
- [x] Connect Supabase (Auth/DB/Storage)
- [x] Verify tables exist (profiles, targets, meal_logs, photos, chat_logs)
- [x] Set env vars (see Section A)
- [x] Add color tokens + base layout
- [x] Auth system (email/password, no email confirmation)

## 0.1. Authentication Setup
- [x] Created Auth page with sign in/sign up tabs
- [x] Added AuthProvider with proper session management
- [x] Protected routes - redirect to /auth if not authenticated
- [x] Added logout functionality to Navigation
- [x] Used proper auth state management with onAuthStateChange

## 1. Coach C — Text Chat E2E
- [ ] API: `/api/coachc/chat` with error taxonomy
- [ ] UI: input, Send, streaming, avatar
- [ ] Supabase: write to `chat_logs`
- Acceptance: screenshot + Diagnostics snapshot

## 2. Coach C — Voice E2E
- [ ] STT (Deepgram `nova-2`, language=`multi`) mic start/stop
- [ ] TTS (Deepgram `aura-2-hermes-en`) auto-speak + Stop button
- [ ] Sanitization before TTS (strip markdown/SSML)
- Acceptance: video/gif + Diagnostics snapshot

## 3. Menu Scanner
- [ ] Upload → `/api/menu/parse`
- [ ] Buckets + reasoning + nutrients displayed
- [ ] "Log this" → `meal_logs`
- Acceptance: log visible in Logs (Day view)

## 4. Meal Scanner
- [ ] Upload → `/api/meal/analyze`
- [ ] Dedupe safeguard; save photo to Storage
- [ ] Show last 5 logged meals
- Acceptance: list shows 5 most recent with thumbnails

## 5. Logs
- [ ] Day / Week / Custom range filters
- [ ] Totals (kcal, protein, carbs, fat)
- [ ] Protein progress vs target
- Acceptance: totals match known fixtures

## 6. Profile (BPS)
- [ ] Fields: gender, diet_type (non-veg not omnivore), activity, conditions[], notes
- [ ] Used by Chat + Scanners
- Acceptance: context fields appear in Diagnostics payload

## 7. Settings
- [ ] Targets editor (protein, fibre, sodium, sugar, calories)
- [ ] Danger Zone delete account (confirm modal)
- Acceptance: account deletion verified (auth + data)

## 8. Consistency & Palette
- [ ] Apply health/wellness palette globally
- [ ] Rename omnivore→non-vegetarian; remove halal everywhere
- [ ] Replace legacy SSR/hydration code
- Acceptance: visual snapshot, grep results

## 9. RLS & Security Proof
- [ ] Owner-only policies validated
- [ ] Negative test: other user cannot read rows
- Acceptance: screenshot of denied query

## 10. Deployment
- [ ] Production build
- [ ] Env configured on host
- [ ] Smoke test (Chat + Scanners + Logs)
- Acceptance: live URL + smoke test checklist

---

## Section A — Environment Variables

Frontend (`.env`):
- VITE_SUPABASE_URL=
- VITE_SUPABASE_ANON_KEY=

Server/Edge:
- SUPABASE_SERVICE_ROLE=
- GOOGLE_API_KEY=
- DEEPGRAM_API_KEY=

## Notes / Decisions / Risks
- English-only replies; sanitize before TTS.
- Diagnostics panel is mandatory on Chat page.