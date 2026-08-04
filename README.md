# Membba

Membba helps creators monetize Telegram and WhatsApp communities with automated payments, access control, subscription management, and community automations.

## Stack

- React + Vite
- Tailwind CSS
- Supabase Auth + Database
- Express backend
- Paystack payments
- Telegram Bot API
- WhatsApp/Baileys integration
- Groq-powered AI automations

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Supabase, Paystack, Telegram, WhatsApp, and AI credentials.

Important frontend variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

Important backend variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=sk_live_or_test_xxxxxxxxxxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyz
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
CLIENT_URL=http://localhost:5173
PORT=3001
```

### API URL handling

For local development, `VITE_API_URL` can be left empty. The frontend calls relative `/api/*` URLs and Vite proxies them to the Express backend through `vite.config.js`.

For production, either:

1. Set `VITE_API_URL` to your backend origin, for example:

```env
VITE_API_URL=https://membba-server.onrender.com
```

or

2. Leave it empty if your frontend host rewrites `/api/*` to the backend, as configured in `vercel.json`.

### 3. Set up the database

For a new Supabase project, run the consolidated current schema:

```txt
supabase-current-schema.sql
```

Older incremental files are still kept in the repo for history/backwards reference:

```txt
supabase-schema.sql
supabase-whatsapp-migration.sql
supabase-baileys-migration.sql
supabase-session-migration.sql
automations-migration.sql
ai-memory-migration.sql
```

### 4. Run the app locally

```bash
npm run dev
```

This starts both:

- Vite frontend: `http://localhost:5173`
- Express backend: `http://localhost:3001`

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/register` | Creator registration |
| `/login` | Creator login |
| `/dashboard` | Overview + stats |
| `/dashboard/communities` | Manage communities |
| `/dashboard/communities/new` | Create a community |
| `/dashboard/communities/:id/edit` | Edit a community |
| `/dashboard/members` | All subscribers |
| `/dashboard/payments` | All transactions |
| `/dashboard/automations` | AI/community automation tools |
| `/dashboard/settings` | Profile + integrations |
| `/join/:slug` | Public subscriber payment page |
| `/payment/success` | Post-payment callback |

## Backend endpoints

The Express backend handles:

- Paystack initialization, verification, and webhook processing
- Subscription creation and expiry processing
- Telegram bot webhook/polling, invites, and removals
- WhatsApp connection, QR/pairing, invites, and removals
- Scheduled posts and automation settings
- AI responses/digests through Groq
