# TODOS

## Photo uploads broken on Vercel (pre-existing)
**What:** Pantry photo scanning writes to `public/uploads/` which is read-only on Vercel at runtime.
**Why:** Photo scanning is the lowest-friction way to add fridge items. Without it, users must add items manually.
**Fix:** Switch to `/tmp` (ephemeral) + analyze immediately without persisting, or use Vercel Blob Storage.
**Context:** `src/app/api/pantry/route.ts:52` uses `writeFile` to `public/uploads/`. Vercel serverless functions have a writable `/tmp` directory but it's ephemeral. The image is only needed for AI analysis, not long-term storage.
**Depends on:** Nothing. Can be fixed independently.
**Priority:** Medium. Blocks photo-based fridge check-in in production.

## SMS notification channel (deferred)
**What:** Add Twilio SMS as a second notification channel alongside web push.
**Why:** Push notifications can be dismissed and forgotten. SMS sits in the text inbox. For neurodivergent users, SMS may be more reliable.
**Fix:** ~1 hour with CC. Twilio account, `/api/sms/webhook/route.ts`, SMS sender in `notifications.ts`, phone number input in settings.
**Context:** Explicitly deferred during eng review. Design doc chose Approach B+C (app + SMS). Push-only shipping first to validate core hypothesis.
**Depends on:** P0 push notifications working. Validate push compliance first.
**Priority:** High (fast follow after push validation).

## E2E test setup (Playwright)
**What:** Set up Playwright for browser-based E2E tests covering push notifications and service worker interactions.
**Why:** 6 test paths deferred: push notification display, accept/skip via notification buttons, onboarding permission flow. Currently tested manually on phone.
**Fix:** Install Playwright, configure for Chrome, write 6 E2E test cases.
**Context:** Project has vitest for unit/integration tests. E2E is the gap. Service worker push events can't be tested in vitest's node environment.
**Depends on:** P0 implementation complete and working.
**Priority:** Low. Manual testing sufficient for single-user validation.
