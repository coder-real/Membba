# Membba — Frontend

Monetize your Telegram community. Automated payments, access control, and subscription management.

## Stack

- React + Vite
- Tailwind CSS
- Supabase (auth + database)
- React Router v6
- React Hot Toast

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Supabase project URL and anon key from your [Supabase dashboard](https://app.supabase.com).

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up the database

- Go to your Supabase project → SQL Editor
- Run the full contents of `supabase-schema.sql`

### 4. Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`

---

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
| `/dashboard/settings` | Profile + integrations |
| `/join/:slug` | Public subscriber payment page |
| `/payment/success` | Post-payment callback |

---

## Backend (coming next)

The backend (Node.js + Express) will handle:
- Paystack webhook verification
- Subscription creation after payment
- Telegram bot automation (add/remove members)
- Cron job for expiry checks
