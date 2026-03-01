# Expense Tracker

A personal expense tracking PWA built with Next.js 16, designed to feel like a native iOS app. Track spending across accounts, view analytics, and export data — all with a clean, fast interface.

## Features

- **Dashboard** — Monthly spend summary, category donut chart, recent activity (last 30 days)
- **Analytics** — Search, filter by category/account, sort by date or amount, grouped transaction list, CSV export
- **Accounts** — Bank and credit card accounts, per-account spend breakdown
- **Add/Edit Expenses** — Sheet modal with numpad, category chips, calendar, time picker, swipe-to-dismiss
- **PWA** — Add to homescreen on iOS/Android, works offline for static assets
- **Dark mode** — iOS-native dark/light toggle

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TailwindCSS 4, Recharts
- **State**: Zustand with optimistic updates
- **Database**: Neon Postgres (serverless)
- **Auth**: JWT via `jose`, passwords via `bcryptjs`
- **PWA**: `next-pwa` (service worker, no API caching)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create `.env.local`:

```env
DATABASE_URL=your_neon_postgres_connection_string
SESSION_SECRET=your_random_secret_min_32_chars
```

> `SESSION_SECRET` is **required in production** — the app throws at startup if it's missing.

### 3. Initialize the database

```bash
node scripts/init-db.js
```

This creates the `users`, `accounts`, and `expenses` tables with indexes.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev       # Development server (http://localhost:3000)
npm run build     # Production build
npm start         # Start production server
npm run lint      # ESLint
node scripts/init-db.js  # Initialize database tables
```

## Project Structure

```
src/
├── app/
│   ├── api/              # REST API routes
│   │   ├── auth/         # login, signup, logout, me
│   │   ├── expenses/     # CRUD for expenses
│   │   └── accounts/     # CRUD for accounts
│   ├── page.tsx          # Dashboard
│   ├── analytics/        # Analytics page
│   ├── accounts/         # Accounts page
│   ├── login/            # Login page
│   └── signup/           # Signup page
├── components/           # React components
├── lib/                  # auth, db client, types, calculations
└── store/                # Zustand store
public/
├── manifest.json         # PWA manifest
├── fonts/                # Self-hosted Inter font
└── icons/                # PWA icons
scripts/
└── init-db.js            # Database setup script
```

## Deployment

Deploy to any Node.js host (Vercel, Railway, Render, etc.).

Set these environment variables in your host:
- `DATABASE_URL` — Neon Postgres connection string
- `SESSION_SECRET` — Random secret (min 32 characters)

**After first deploy:** add the site to your iOS homescreen by opening it in Safari → Share → Add to Home Screen.

> If you update `public/manifest.json`, delete the existing homescreen shortcut and re-add it — iOS caches the manifest aggressively.
