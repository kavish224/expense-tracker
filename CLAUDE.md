# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 16** expense tracking PWA (Progressive Web App) with authentication, built using:
- **Frontend**: React 19, Next.js App Router, TailwindCSS 4, Zustand for state management
- **Backend**: Next.js API routes, Neon Postgres (serverless), JWT-based authentication
- **PWA**: next-pwa with service worker configured to disable API caching (financial data must always be fresh)

## Recent Production Improvements (2026-02-25)

- **Self-hosted Inter font** - No build-time network dependency
- **Pointer Events API** - Type-safe touch handling without `as any` casts
- **Granular loading states** - Fixed duplicate data fetches, added loading/error tracking
- **Touch-first UI** - `active:` states replace hover, keyboard focus indicators added
- **Safe-area consistency** - Unified classes for iOS notch handling
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
- `SESSION_SECRET` - JWT signing secret (defaults to fallback in development)

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
- **accounts**: `id`, `user_id` (FK to users), `name`, `type`, `created_at`
- **expenses**: `id`, `user_id` (FK to users), `amount`, `category`, `payment_method`, `account_id` (FK to accounts, nullable), `date`, `note`, `created_at`

Indexes on: `expenses.user_id`, `expenses.date`, `accounts.user_id`

Database access:
- `src/lib/neon.ts` - Neon HTTP client wrapper that mimics `@vercel/postgres` API
- All queries use tagged template literals: `sql\`SELECT...\``

### State Management
- **Zustand store** (`src/store/useExpenseStore.ts`) manages:
  - Expenses and accounts arrays
  - User session state
  - Modal open/close state and editing state
  - CRUD operations that call API then update local state

- **Client-side DB wrapper** (`src/lib/db.ts`) contains fetch functions for expenses and accounts
- **StoreInitializer** component (`src/components/StoreInitializer.tsx`) loads initial data on mount

### Data Types
- `Expense` has both `account` (UUID) and `accountName` (string) fields
- API routes JOIN accounts table to populate `accountName` when fetching expenses
- Categories and payment methods are predefined constants in `src/lib/types.ts`

### PWA Configuration
`next.config.ts` configures next-pwa with:
- **Empty `runtimeCaching` array** - disables Service Worker caching of `/api/*` routes to ensure fresh financial data
- Precaching of static assets still happens automatically
- PWA disabled in development mode

### File Structure
- `src/app/` - Next.js App Router pages and API routes
  - `src/app/api/` - REST API endpoints (auth, expenses, accounts)
  - `src/app/page.tsx` - Dashboard (main page)
  - `src/app/analytics/page.tsx` - Analytics view
  - `src/app/accounts/page.tsx` - Account management
- `src/components/` - React components (modals, cards, nav)
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

### Date Handling
- Expenses are always sorted by date DESC (newest first)
- Dates stored as ISO strings in state and sent to API
- Database stores as `TIMESTAMP WITH TIME ZONE`
- Analytics page filters to last 30 days by default

### Account References
When working with expenses that have accounts:
- `account` field contains the UUID (for database operations)
- `accountName` field contains the display name (for UI)
- API routes must LEFT JOIN accounts table to populate `accountName`
