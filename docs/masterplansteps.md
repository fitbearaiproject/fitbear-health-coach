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
- [x] Added forgot password functionality with reset page
- [x] Added remember me checkbox
- [x] Moving to Coach C Text Chat E2E implementation

## 1. Coach C — Text Chat E2E
- [x] API: `/api/coachc/chat` with error taxonomy (supabase/functions/coach-chat)
- [x] UI: input, Send, streaming, avatar (CoachChat component)
- [x] Supabase: write to `chat_logs` (implemented in edge function)
- [x] Auth state chip showing user email
- [x] Diagnostics panel with request metrics
- Acceptance: ✅ Component ready for testing

## 2. Coach C — Voice E2E
- [x] STT (Deepgram `nova-2`, language=`multi`) mic start/stop
- [x] TTS (Deepgram `aura-2-hermes-en`) auto-speak + Stop button
- [x] Sanitization before TTS (strip markdown/SSML)
- [x] Error handling with retry logic
- Acceptance: ✅ Voice pipeline ready for testing

## 3. Menu Scanner
- [x] Upload → `/api/menu/parse` (menu-parse edge function)
- [x] Buckets + reasoning + nutrients displayed (Top Picks/Alternates/To Avoid)
- [x] "Log this" → `meal_logs` (individual dish logging)
- [x] Image upload with preview and base64 conversion
- [x] Gemini vision analysis with user profile context
- Acceptance: ✅ Menu scanner ready for testing

## 4. Meal Scanner
- [x] Upload → `/api/meal/analyze` (meal-analyze edge function)
- [x] Dedupe safeguard (check recent logs in last hour)
- [x] Save photo to Storage (meal-photos bucket)
- [x] Show last 5 logged meals with thumbnails
- [x] Individual dish detection with nutrition analysis
- [x] Bulk logging of all detected dishes
- Acceptance: ✅ Meal scanner ready for testing

## 5. Logs
- [x] Day / Week / Custom range filters with date picker
- [x] Totals (kcal, protein, carbs, fat) with visual cards
- [x] Protein progress vs target with progress bars
- [x] Grouped by date with meal thumbnails
- [x] Calories progress tracking
- Acceptance: ✅ Logs page ready for testing

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