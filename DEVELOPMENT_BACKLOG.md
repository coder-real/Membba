# Membba Development Backlog

Last updated: 2026-08-04

Legend:
- [x] Done / implemented
- [~] Partially done or implemented but needs live verification
- [ ] Not done / parked for later

## Known issues to fix later

### Auth / session
- [~] AI Inbox shows `Unauthorized` even when user appears signed in.
  - Mitigation added: safer token retrieval + refresh in AI Inbox/Automations.
  - Still needs live confirmation in preview/production. If it persists, investigate AuthContext hydration and backend `supabase.auth.getUser(token)`.
- [~] Automations toggles sometimes show `Failed to save`.
  - Mitigation added: relative API URL handling and safer token retrieval.
  - Still needs live confirmation with a fresh sign-out/sign-in.
- [~] Forgot password flow needs full live test.
  - UI and routes added: `/forgot-password`, `/reset-password`.
  - Still requires Supabase redirect URLs and email template config verification.

### Supabase Storage / Avatar
- [~] Avatar upload says `new row violates RLS policy`.
  - Bucket `avatars` was created.
  - Migration created: `supabase-storage-policies.sql`.
  - Still needs Supabase policy migration run + live upload test.

### Supabase email branding
- [~] Signup email is generic.
  - Branded template copy was provided.
  - Still needs manual setup in Supabase Dashboard → Authentication → Email Templates.
- [ ] Sender identity/domain needs setup.
  - Recommended: `Membba <noreply@yourdomain.com>`.
  - Requires custom SMTP/domain configuration in Supabase.

### WhatsApp / Baileys
- [ ] WhatsApp linked-device flow fails with `Couldn't link device. Please try again later`.
  - Tried QR and pairing code after clearing `baileys_sessions`.
  - Render was suspended and `ENABLE_WHATSAPP=false`, but phone-side linking still failed.
  - Possible causes: WhatsApp rate-limit, account/device restriction, linked device state, Baileys compatibility.
- [ ] Consider fallback provider for production WhatsApp.
  - Options: WhatsApp Cloud API, 360dialog, Twilio WhatsApp, WATI, Whapi, etc.

### AI / Automations
- [x] AI First Responder toggle is enforced inside WhatsApp DM handler.
  - Implemented in `server/services/whatsapp.js` using `isAIResponderEnabledForPhone()`.
- [~] Daily Digest toggle is respected.
  - Implemented basic/global check in `server/services/digest.js`.
  - Still needs per-creator digest delivery model.
- [ ] `digest_time` is saved but cron still uses a fixed server schedule.
  - Needs production scheduling design.
- [x] Scheduled Broadcast toggle is enforced per creator.
  - Implemented in `server/services/scheduler.js` using creator automation settings.
- [~] Automations metrics are more data-driven.
  - Added AI replies, open escalations, queued posts, recent runs from `/api/ai/status`.
  - Some card copy/metrics still need refinement.
- [x] Add real delivery/run logs for automations.
  - Implemented `automation_runs` table support and `automation-runs-migration.sql`.
  - Needs migration run in Supabase.

### AI Inbox / Actions
- [~] AI Inbox page exists but needs auth/session issue verified.
  - Page and routes implemented.
  - Token handling improved.
- [x] `Mark resolved` route exists.
  - Creator route: `PATCH /api/ai/escalations/:id/resolve`.
  - Ops route also exists.
- [~] `Resend invite` action exists.
  - Implemented for AI Inbox/Ops and creator member drawer where applicable.
  - Needs active member test data for full live verification.
- [ ] Escalation ownership currently maps by phone/subscriptions; improve with explicit `creator_id` and/or `community_id` columns on `ai_escalations`.
  - Not yet implemented. Still recommended.

### UI / UX
- [~] Tooltips use portal and should avoid clipping.
  - Implemented `Tooltip` portal component.
  - Needs visual QA across all pages.
- [ ] Community setup page is large and may need simplification later.
- [~] Automations page is more honest/data-driven.
  - Added readiness cards, test AI reply tool, real-ish metrics.
  - Still needs better final UX polish.
- [~] Add test buttons.
  - [x] Test AI Reply done.
  - [ ] Send Test Digest pending.
  - [ ] Test Broadcast pending.
- [ ] Search bar in dashboard topbar is currently visual only.

## Big hitter development tasks

### 1. Make automations real and enforce toggles
- [x] Enforce `ai_responder` in WhatsApp DM handler.
- [~] Enforce `daily_digest` in digest cron.
  - Basic/global enforcement done; per-creator still pending.
- [x] Enforce `scheduler` in scheduled posts cron.
- [x] Add automation run logs.
- [~] Replace placeholder metrics with real counts.

### 2. Make payments/subscription flow production-solid
- [~] Test Paystack initialize → success callback → verify → subscription creation.
  - Initialize tested successfully.
  - Payment success page improved.
  - Full checkout-to-subscription flow needs live production/non-Arena test.
- [~] Test webhook signature path.
  - Code hardened, but live Paystack webhook test pending.
- [ ] Test expired subscription processing safely.
  - Cron currently disabled locally for safety.
- [x] Add clearer payment failure handling.
  - Payment Success page and Payments dashboard improved.
- [x] Add idempotency and audit logs where missing.
  - Payment event logging added with `payment-events-migration.sql`.

### 3. Improve AI action execution
- [x] For active members: resend invite from AI Inbox.
- [x] For payment issues: lookup recent payment by email/phone/reference.
  - Creator Payments page and Ops Helpdesk payment lookup implemented.
- [x] For expired users: auto-send renewal link.
  - AI reply includes renewal URL.
- [ ] Add `ai_escalations.creator_id` and `community_id` for cleaner ownership.
  - Still pending and recommended.

### 4. WhatsApp strategy decision
- [ ] Continue debugging Baileys later OR switch to more stable provider.
- [ ] For MVP reliability, investigate WhatsApp Cloud API/provider route.

### 5. Production readiness
- [x] Clean schema/migrations.
  - `supabase-current-schema.sql` consolidated as current source of truth.
  - Added `SUPABASE_SETUP.md` and `scripts/check-db-schema.js`.
  - Live DB check currently reports missing `ai_escalations.assigned_to_email` and `ops_notes` until consolidated schema is run.
- [~] Fix RLS policies.
  - Some backend auth and storage migrations added.
  - Avatar storage RLS still needs live confirmation.
- [~] Configure Supabase email templates.
  - Templates provided, but manual dashboard setup still pending.
- [ ] Confirm Vercel/Render env vars.
- [~] Add error logging and admin diagnostics.
  - Payment events, automation runs, AI escalations, Ops Helpdesk added.
  - Needs final production logging strategy.

### Arena/Paystack preview findings
- [~] Paystack checkout in Arena preview can redirect/framing-log `localhost:5173` or CSP report-only warnings.
  - Backend now uses request `Origin` for new Paystack callback URLs.
  - Old checkout links may still point to localhost.
  - Re-test on production Vercel domain.
- [ ] Browser console shows Grammarly extension warnings and React minified recoverable error #419 during external checkout flow.
  - Likely caused by browser extensions / iframe preview / external checkout environment.
  - Re-test in a clean browser and production URL later.

## Recently completed additions not originally in backlog

### Creator dashboard
- [x] Forgot password UI and reset-password UI.
- [x] Members drawer with subscription/payment/AI escalation context.
- [x] Members drawer supports +30 day extension.
- [x] Members drawer supports resolving AI escalations.
- [x] Payments page supports reference filter and member linking.
- [x] Payment success page improved with retry verification and clearer support instructions.
- [x] Automations page includes Test AI Reply tool.

### Membba internal operations app
- [x] Internal Ops Help Desk route: `/ops/helpdesk`.
- [x] Ops admin allowlist via `MEMBBA_ADMIN_EMAILS`.
- [x] Ops global search across creators, communities, payments, and subscriptions.
- [x] Ops payment lookup and verify/repair subscription tool.
- [x] Ops subscription actions: extend, cancel, resend invite.
- [x] Ops internal notes backend + UI for payment lookup.
- [x] Ops creator detail route: `/ops/creators/:id`.
- [x] Ops creator detail shows creator profile, metrics, communities, payments, subscriptions, AI issues, automation settings, and notes.
