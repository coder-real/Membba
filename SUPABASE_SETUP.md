# Membba Supabase Setup

Last updated: 2026-08-04

## Recommended setup for a fresh or existing Supabase project

Run this file in Supabase SQL Editor:

```txt
supabase-current-schema.sql
```

This is now the main consolidated schema and includes the current app requirements:

- communities
- plans
- payments
- payment_events
- subscriptions
- telegram_uid_tokens
- baileys_sessions
- whatsapp_sessions
- whatsapp_pending_invites
- automation_settings
- scheduled_posts
- automation_runs
- ai_escalations
- member_conversations
- ops_notes
- avatars storage bucket and storage policies

## Legacy/incremental migrations

These files are kept for history and for targeted patching if needed, but the consolidated schema above should be the source of truth:

```txt
supabase-schema.sql
supabase-whatsapp-migration.sql
supabase-baileys-migration.sql
supabase-session-migration.sql
automations-migration.sql
ai-memory-migration.sql
ai-escalations-migration.sql
automation-runs-migration.sql
payment-events-migration.sql
ops-notes-migration.sql
ops-escalation-workflow-migration.sql
supabase-storage-policies.sql
```

If your database is missing a table/column/policy, run `supabase-current-schema.sql` first.

## Important Supabase Auth configuration

### Redirect URLs

Add these in Supabase Authentication URL Configuration:

```txt
http://localhost:5173/reset-password
http://localhost:5173/dashboard
https://YOUR-VERCEL-DOMAIN/reset-password
https://YOUR-VERCEL-DOMAIN/dashboard
```

For Arena preview testing, also add the current Arena preview URL ending in:

```txt
/reset-password
```

### Email templates

Customize in:

```txt
Supabase Dashboard → Authentication → Email Templates
```

Templates to update:

- Confirm signup
- Reset password
- Magic link
- Email change

## Important backend environment variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=sk_test_or_live_xxx
TELEGRAM_BOT_TOKEN=xxx
GROQ_API_KEY=gsk_xxx
CLIENT_URL=https://your-frontend-domain
SERVER_URL=https://your-backend-domain
MEMBBA_ADMIN_EMAILS=founder@example.com,support@example.com
```

## Important frontend environment variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-key
VITE_API_URL=
```

For local/Arena testing, leave `VITE_API_URL` empty so `/api/*` goes through the Vite proxy.
For production direct API calls, set it to your backend URL.
