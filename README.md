# Expense Tracker

A personal, multi-account expense tracker for India — Next.js + TypeScript + Tailwind + Postgres (Prisma), installable as a PWA. Dark-mode default with a light toggle. Built to defeat logging friction: frictionless quick-add, strong statement import with balance tie-out + duplicate detection, and calm analytics.

Docs: [`docs/PRD.md`](docs/PRD.md) · [`docs/FSD.md`](docs/FSD.md)

---

## Quick start (≈2 minutes)

Requirements: **Node 20+**, **Docker** (for local Postgres).

> **One-time cleanup first.** This project was assembled in a sandbox that left a few throwaway items — a broken `node_modules` symlink, a stale `package-lock.json`, `._DELETE_*` cache folders, and some vitest temp files. Remove them before installing (you own them on your Mac, so this just works):
> ```bash
> rm -rf node_modules package-lock.json ._DELETE_* vitest.config.ts.timestamp-*
> ```

```bash
# 1. from the project folder
cp .env.example .env            # then set CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
                                 # (vercel integration add clerk, or from dashboard.clerk.com)

# 2. start Postgres
docker compose up -d

# 3. install deps (generates the Prisma client)
npm install

# 4. create the schema
npm run db:push

# 5. run it
npm run dev
# open http://localhost:3000 and sign up via Clerk (any email)
```

**Auth:** local email/password sign-in is gone — this app uses [Clerk](https://clerk.com) (`@clerk/nextjs`) for sign-up/sign-in. On your first authenticated request, the app auto-provisions your account: default categories + a Cash account, so you're never dropped into a completely empty app.

**Sample data:** once you've signed up, run `npm run seed` to replace your bootstrap defaults with a fuller realistic dataset — your 7 accounts (HDFC, ICICI, SBI, Bank of Baroda + AU Kiwi RuPay, ICICI Amazon Pay, HDFC RuPay) + Cash, category catalog, overall + per-category budgets, ~75 days of realistic transactions (UPI-on-credit-card heavy), monthly salary credits, and a few pending items in the **To-Review** queue. (If more than one user exists in the DB, pass `-- --email=you@example.com` to target yours.)

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Run the production build |
| `npm run db:push` | Apply the Prisma schema to the DB |
| `npm run db:migrate` | Create a migration (dev) |
| `npm run seed` | Seed accounts + sample data |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |

---

## Features (v1)

- **Quick-add** — amount-first sheet, prediction-ranked category, default account, recents, ≤3 taps. Keyboard: `A`.
- **Transactions** — filter (account × category × text/amount), search (`/`), density toggle, tabular right-aligned amounts, CSV export.
- **Import** — upload CSV/XLSX → column auto-detect → **balance tie-out** verification → **duplicate detection** vs. what you've logged → review queue → commit. Try `samples/hdfc-sample-statement.csv`.
- **Analytics** — KPI cards, category bars (Recharts), **spending calendar heatmap**, daily trend, by-account, **budgets vs. actual** (overall + per category, non-judgmental framing), recurring-charge detection, **PDF + CSV export**.
- **Accounts** — your banks + credit cards + Cash; add / archive (archive preserves history). UPI is a payment *rail*, not an account.
- **Command palette** — `⌘K`. Direct keys: `A` add, `/` search, `G`+`T/A/H/C/I` navigate, `?` cheat-sheet.
- **PWA** — installable, offline shell, responsive (mobile bottom-tab + desktop rail).
- **Auth** — [Clerk](https://clerk.com) (hosted sign-in/sign-up UI + session), auto-provisioned per-user defaults on first sign-in.
- **Theming** — dark default + light, one accent, tabular numerals, AA+ contrast, visible focus, reduced-motion aware.

---

## Automated capture (LLM + email) — enable when ready

Both pipelines are **built and code-complete**; they run in deterministic-fallback mode until you add credentials, then activate with no code change.

**LLM statement parsing** — for messy/new statement layouts, via the Vercel **AI SDK + AI Gateway**. For local runs set in `.env`:
```
AI_GATEWAY_API_KEY=...           # create one in the Vercel AI Gateway
LLM_MODEL=openai/gpt-4o-mini     # any Gateway "provider/model" string
```
When deployed on **Vercel** it activates automatically via the injected `VERCEL_OIDC_TOKEN` — no key to manage. Statements are parsed **locally first** (deterministic parser); the LLM is a fallback for unrecognized layouts. Only **redacted** text spans are sent, and every returned row must be **grounded** — it has to reference a real source line whose text actually contains the claimed amount, or it's rejected as a hallucination — before it still passes the balance tie-out on the way to auto-posting.

**Email ingestion** — forward bank-alert emails to the app. Works today via the webhook (used by tests); live Gmail polling activates with `GMAIL_*` env. Test it now:
```bash
curl -X POST http://localhost:3000/api/ingest/email \
  -H 'Content-Type: application/json' \
  -d '{"token":"dev-ingest-token","email":"you@example.com",
       "subject":"Txn alert",
       "body":"Rs.520.00 spent on HDFC Card ending 7788 at ZOMATO on 25-07-26 via UPI."}'
```
`email` must match a real signed-up user's email (the account is resolved by email, not by session). The parsed transaction appears in the **To-Review** queue on Today. Live Gmail polling (`GMAIL_*` env, `/api/ingest/gmail/poll`) reuses this same parse+dedup path.

---

## Deploy (morning checklist → Vercel + cloud Postgres)

1. Create a cloud Postgres (Neon / Supabase / Vercel Postgres) and copy its connection string.
2. Push this folder to a Git repo, import into **Vercel**.
3. Install Clerk (`vercel integration add clerk`) and, for real distributed rate limiting on the ingest webhooks, Upstash Redis (`vercel integration add upstash/upstash-kv`) — both auto-provision their env vars into the linked project.
4. Set remaining Vercel env vars: `DATABASE_URL`, `INGEST_TOKEN` (+ `LLM_*` / `GMAIL_*` if enabling capture).
5. Build command `npm run build`; after first deploy run `npx prisma db push` against the cloud DB, sign up via Clerk (auto-provisions your account), then optionally `npm run seed` for sample data.

---

## Tech & structure

Latest stable stack (Dec 2025 / 2026): **Next.js 16** (App Router) · **React 19** · **Prisma 7** (Rust-free client + `@prisma/adapter-pg`) on **Postgres** · **Tailwind CSS 4** · **Recharts 3** (+ custom SVG heatmap) · **jsPDF 4** · **Zod 4** · **Vitest 4** · TypeScript 5.9.

> **Note on Prisma 7:** the client is generated into `generated/` (git-ignored) and `npm install` runs `prisma generate` automatically (postinstall). Database URL + seed config live in `prisma.config.ts`. The datasource uses a `pg` driver adapter (`lib/db.ts`).

> **TypeScript version:** pinned to the 5.9 line. TypeScript 7 (the new native/Go compiler) is published but not yet supported by Next 16's build pipeline — using it would break `next build`.

```
app/            routes (UI + /api handlers); proxy.ts wires Clerk middleware
components/     design-system UI (AppShell, QuickAdd, CommandPalette, Heatmap, ui)
lib/            parsing (narration, tie-out, dedup, columns, categorize),
                llm/, email/, analytics/, user.ts (Clerk↔local-user resolution), db
prisma/         schema.prisma + seed.ts
tests/          vitest unit tests (parser, tie-out, dedup, analytics, email, LLM adapter)
samples/        example statement to import
docs/           PRD.md, FSD.md
```

## Testing status

`npm test` runs 45 unit tests covering the trust-critical logic — narration parsing (UPI/NEFT/RTGS/IMPS/card, including OCR-confused digits), balance tie-out (balanced + off-by localisation, exact integer-paise arithmetic), duplicate detection (exact/probable/new), categorization, analytics aggregation, email parsing, redaction, and the LLM grounding guard. All green.
