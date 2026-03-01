# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 16** expense tracking PWA (Progressive Web App) with authentication, built using:
- **Frontend**: React 19, Next.js App Router, TailwindCSS 4, Zustand for state management
- **Backend**: Next.js API routes, Neon Postgres (serverless), JWT-based authentication
- **PWA**: next-pwa with service worker configured to disable API caching (financial data must always be fresh)

## Recent Production Improvements (2026-03-01)

- **iOS native design system** - Full iOS-style design tokens, safe-area handling, frosted glass nav
- **Optimistic updates with rollback** - All mutations (add/update/delete) apply instantly and roll back on error
- **Double-tap prevention** - `submitting` state on AddExpenseModal disables numpad and buttons during in-flight requests
- **Inline confirmations** - All destructive actions use inline iOS-style confirm bars; no `window.confirm()`
- **Toast system** - Enter/exit animations, tap-to-dismiss, max 3 visible, positioned above bottom nav
- **API input validation** - Whitelisted categories/payment methods, amount bounds, note max length, account type validation
- **SESSION_SECRET guard** - Throws at startup in production if env var is missing
- **LoadingSpinner on initial load** - All 3 pages show spinner while data is fetching
- **StoreInitializer fix** - Uses `hasInitialized` ref instead of `expenses.length` to prevent re-init after deleting all expenses
- **PWA safe-area gap fix** - `manifest.json` `background_color: #1c1c1e`, explicit viewport meta with `viewport-fit=cover`, `html.dark { background-color: #1c1c1e }`, nav uses `env(safe-area-inset-bottom, 34px)` fallback
- **Self-hosted Inter font** - No build-time network dependency
- **Production optimizations** - Disabled X-Powered-By, enabled compression, image optimization

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Initialize database (creates tables and indexes)
node scripts/init-db.js
```

## Environment Setup

Required environment variables in `.env.local`:
- `DATABASE_URL` or `POSTGRES_URL` - Neon Postgres connection string
- `SESSION_SECRET` - JWT signing secret (**required in production** — app throws at startup if missing)

## Architecture

### Authentication Flow
- JWT-based sessions using `jose` library
- Session tokens stored in httpOnly cookies (7-day expiration)
- Password hashing with `bcryptjs`
- Auth logic in `src/lib/auth.ts`
- Protected API routes verify session via `verifySession()`
- All API routes check authentication and filter data by `user_id`

### Database Schema
Three main tables (all use UUID primary keys):
- **users**: `id`, `email`, `password_hash`, `created_at`
- **accounts**: `id`, `user_id` (FK to users), `name`, `type` (`Bank` | `CreditCard`), `created_at`
- **expenses**: `id`, `user_id` (FK to users), `amount`, `category`, `payment_method`, `account_id` (FK to accounts, nullable), `date`, `note`, `created_at`

Indexes on: `expenses.user_id`, `expenses.date`, `accounts.user_id`

Database access:
- `src/lib/neon.ts` - Neon HTTP client wrapper that mimics `@vercel/postgres` API
- All queries use tagged template literals: `` sql`SELECT...` ``

### State Management
- **Zustand store** (`src/store/useExpenseStore.ts`) manages:
  - Expenses and accounts arrays
  - User session state
  - Modal open/close state and editing state
  - CRUD operations with optimistic updates and rollback on error

- **Client-side DB wrapper** (`src/lib/db.ts`) contains fetch functions for expenses and accounts
- **StoreInitializer** component (`src/components/StoreInitializer.tsx`) loads initial data on mount using `hasInitialized` ref

### Data Types
- `Expense` has both `account` (UUID) and `accountName` (string) fields
- API routes JOIN accounts table to populate `accountName` when fetching expenses
- Categories and payment methods are predefined constants in `src/lib/types.ts`
- Account `type` must be exactly `'Bank'` or `'CreditCard'` — validated at API level

### PWA Configuration
`next.config.ts` configures next-pwa with:
- **Empty `runtimeCaching` array** - disables Service Worker caching of `/api/*` routes to ensure fresh financial data
- Precaching of static assets still happens automatically
- PWA disabled in development mode

`public/manifest.json`:
- `background_color: "#1c1c1e"` — fills the home-indicator zone on iOS in dark mode (critical for no black gap)

### iOS Safe-Area / Bottom Nav Gap
The bottom nav gap fix involves three layers working together:
1. `manifest.json` `background_color: "#1c1c1e"` — OS uses this to paint outside the web viewport in PWA mode
2. `html.dark { background-color: #1c1c1e }` in globals.css — opaque color (not semi-transparent var) for the safe-area zone
3. `paddingBottom: 'env(safe-area-inset-bottom, 34px)'` on the nav — 34px fallback for when the env var returns 0
4. Explicit `<meta name="viewport" content="... viewport-fit=cover">` in layout.tsx `<head>` — iOS PWA reads this directly

**After deploying changes to manifest.json:** delete the PWA from homescreen and re-add it — iOS caches the manifest aggressively.

### File Structure
- `src/app/` - Next.js App Router pages and API routes
  - `src/app/api/` - REST API endpoints (auth, expenses, accounts)
  - `src/app/page.tsx` - Dashboard (main page)
  - `src/app/analytics/page.tsx` - Analytics view with search, filter, sort, grouped list
  - `src/app/accounts/page.tsx` - Account management
- `src/components/` - React components (modals, cards, nav)
  - `AddExpenseModal.tsx` - Sheet modal with numpad, calendar, time picker, swipe-to-dismiss
  - `ExportCSVButton.tsx` - CSV export with range picker and custom date range
  - `LoadingSpinner.tsx` - Reusable spinner, used for `loading.initial` state in all pages
  - `Toast.tsx` - Toast notification system with enter/exit animations
- `src/lib/` - Utilities (auth, db client, types, calculations)
- `src/store/` - Zustand store
- `scripts/` - Database initialization script

## Important Patterns

### API Route Pattern
All API routes follow this structure:
1. Verify session with `await verifySession()`
2. Return 401 if no session
3. Filter queries by `session.userId`
4. JOIN accounts table when returning expenses to populate `accountName`
5. Return proper HTTP status codes (201 for creates, 401 for auth failures, 500 for errors)

### API Input Validation
Expenses API validates:
- `amount`: positive finite number, max 10,000,000
- `category`: must be in `['Food','Transport','Shopping','Entertainment','Bills','Health','Education','Travel','Groceries','Other']`
- `paymentMethod`: must be in `['Cash','UPI','Credit Card','Debit Card','Net Banking','Wallet']`
- `date`: must parse as valid date
- `note`: max 200 characters

Accounts API validates:
- `name`: required, non-empty string, max 50 characters, trimmed before insert
- `type`: must be `'Bank'` or `'CreditCard'`

### Optimistic Update Pattern
All mutations use this pattern:
1. Apply change to store immediately (optimistic)
2. Call API
3. On success: replace optimistic record with server response
4. On error: restore previous state snapshot, re-throw for UI handling

### Date Handling
- Expenses are always sorted by date DESC (newest first)
- Dates stored as ISO strings in state and sent to API
- Database stores as `TIMESTAMP WITH TIME ZONE`
- Dashboard recent activity filters to last 30 days

### Account References
When working with expenses that have accounts:
- `account` field contains the UUID (for database operations)
- `accountName` field contains the display name (for UI)
- API routes must LEFT JOIN accounts table to populate `accountName`
