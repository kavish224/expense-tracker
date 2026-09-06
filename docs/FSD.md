# Functional Specification Document (FSD)
### Personal Expense Tracker — v1

**Companion to `PRD.md`.** Defines architecture, data model, APIs, module behavior, screens, and test plan.

---

## 1. Architecture

```
Next.js (App Router, TS)
├─ app/                         # routes (UI + API)
│  ├─ (auth)/login, /register   # Clerk-hosted <SignIn/>/<SignUp/> catch-all routes
│  ├─ (app)/                    # authenticated shell (rail/tabbar, theme, ⌘K)
│  │   ├─ page.tsx              # Today / Home
│  │   ├─ transactions/
│  │   ├─ analytics/
│  │   ├─ accounts/
│  │   └─ import/
│  └─ api/                      # route handlers (REST-ish) — auth via Clerk (proxy.ts + lib/user.ts), no custom auth routes
│     ├─ transactions/         # CRUD, filter, search
│     ├─ accounts/             # CRUD
│     ├─ budgets/              # CRUD
│     ├─ import/               # parse + commit
│     ├─ ingest/email/         # email alert intake (gated)
│     └─ analytics/            # aggregates
├─ lib/
│  ├─ db.ts                     # Prisma client singleton
│  ├─ user.ts                   # Clerk↔local-User resolution (requireUserId/requireUserIdApi), bootstrap defaults
│  ├─ parsing/                  # deterministic parser, narration regex, tie-out, dedup
│  ├─ llm/                      # LLM adapter (gated, fallback)
│  ├─ email/                    # email parser + Gmail adapter (gated)
│  ├─ analytics/                # aggregation helpers
│  └─ design/tokens.ts          # design tokens (mirrors CSS vars)
├─ components/                  # UI components (design system)
├─ prisma/schema.prisma         # data model
├─ prisma/seed.ts               # seed accounts + sample data
├─ tests/                       # vitest unit + route tests
└─ public/                      # PWA manifest, icons, service worker
```

**Data flow:** UI → API route handler → `lib` service → Prisma → Postgres. Parsing/dedup/tie-out are pure functions in `lib/parsing` (unit-tested independently of DB).

## 2. Data model (Prisma / Postgres)

Entities and key fields (full schema in `prisma/schema.prisma`):

- **User** — `id (Clerk user id, not locally generated), email(unique), createdAt`.
- **Account** — `id, userId, name, type(BANK|CREDIT_CARD|CASH|INVESTMENT|LOAN|OTHER_ASSET), institution?, identifierHint?(last4/VPA), currency(default INR), openingBalance, currentBalance?(manual accounts only — see 3.6), colorToken, icon, isArchived`.
- **Category** — `id, userId, name, parentId?, colorToken, icon, isSystem`.
- **Transaction** — `id, userId, accountId, direction(DEBIT|CREDIT), amount(Decimal), currency, txnDatetime, categoryId?, merchantName?, counterpartyRaw?, paymentRail(UPI|NEFT|RTGS|IMPS|CARD|CASH|OTHER), externalRef?(UTR/RRN/UPI id — dedup key), instrumentHint?(VPA/last4), note?, source(MANUAL|EMAIL|IMPORT|MANUAL_IMPORT|LLM|AA), confidence(0..1), isReviewed(bool), rawNarration?, feesFlag, refundFlag, createdAt, updatedAt`. Indexes on `(userId, txnDatetime)`, `(externalRef, amount, txnDatetime, accountId)` for dedup.
- **Budget** — `id, userId, categoryId?(null=overall), period(MONTHLY|WEEKLY), amount, startDate, rollover`.
- **Rule** — `id, userId, matchType(MERCHANT_CONTAINS|VPA_EQUALS|AMOUNT_RANGE|ACCOUNT), matchValue, setCategoryId?, priority`.
- **ImportBatch** — `id, userId, accountId, sourceFormat(CSV|XLSX|PDF|EMAIL), bankTemplateId?, fileName, rowCount, tieOutStatus(BALANCED|UNBALANCED|NA), status(PENDING|COMMITTED), createdAt`.
- **BankTemplate** — `id, userId, institution, mappingJson, createdAt` (learned column mapping reused per bank).
- **BalanceSnapshot** — `id, userId, accountId, balance(Decimal), asOf(DateTime), createdAt` — point-in-time balance record for an account, used to build the net-worth trend (§3.6).

Enums are Postgres enums via Prisma. Money stored as `Decimal(14,2)`. `rawNarration` retained for audit/re-parse. `confidence + isReviewed` drive the review queue.

## 3. Modules

### 3.1 Parsing (`lib/parsing`)
- **`detectColumns(rows)`** — header sniffing → maps to `{date, narration, debit, credit, balance, ref}`; remembers via `BankTemplate`.
- **`parseNarration(text)`** — regex extraction of `rail_type, direction, UTR/RRN/UPI-id, IFSC, VPA, counterparty, amount, fees/refund flags` for UPI/NEFT/RTGS/IMPS/Card. OCR substitution passes (O↔0, I↔1, l↔1, B↔8, S↔5).
- **`tieOut(batch)`** — verifies `opening + Σcredits − Σdebits = closing` (statement-level) and per-row running balance where present; returns `{balanced, offBy, badRows[]}`. Card statements w/o running balance → control-total check.
- **`dedup(candidate, existing)`** — priority stack: exact `externalRef` → `externalRef + amount±feeband` → fuzzy `account + amount + date±3d + merchant similarity` → `instrument + amount + date`. Returns `{status: NEW|DUPLICATE|PROBABLE, matchId?}`.
- **`categorize(txn, rules, history)`** — rules first, then last-used/merchant/amount-band heuristic; assigns `categoryId` + `confidence`. Unknown → `Uncategorized`, low confidence → review.

### 3.2 LLM adapter (`lib/llm`)
- **`mapRowsWithLLM(rawRows)`** — via the Vercel **AI SDK + AI Gateway** (`AI_GATEWAY_API_KEY` for local runs, or the auto-injected `VERCEL_OIDC_TOKEN` on Vercel; model from `LLM_MODEL`, default `openai/gpt-4o-mini`). Numbered-line prompt → **structured output** validated by a Zod schema. **Redacts** account/card numbers, PAN, GSTIN before send. **Grounding guard (`validateGrounded`):** every returned row must reference a valid, unique source line whose text actually contains the claimed amount — otherwise it's dropped as hallucinated. Returns `null` when disabled or the call fails (→ deterministic fallback) and `[]` when the call succeeded but nothing survived grounding. Used for unrecognized layouts.
- Guardrail: LLM output still passes `tieOut` + validators before auto-posting.

### 3.3 Email ingestion (`lib/email`)
- **`parseAlertEmail(body, sender)`** — extracts amount/merchant/account/date/rail from bank alert templates (HDFC/ICICI/SBI/Amex etc.) → pending `Transaction(source=EMAIL, isReviewed=false)`.
- **`POST /api/ingest/email`** — accepts `{sender, subject, body}` (works today; used for tests + manual forwards). Live Gmail polling (`lib/email/gmail.ts`) activates with `GMAIL_*` env.

### 3.4 Analytics (`lib/analytics`)
- Aggregations: total by period, by category, by account, daily series (for heatmap + trend), budget consumption, recurring detection (same merchant + ~amount + monthly cadence), period deltas.

### 3.5 Auth (`lib/user.ts` + Clerk)
- Identity and sign-in/sign-up UI are owned by **Clerk** (`@clerk/nextjs`, installed via the Vercel Marketplace). `proxy.ts` runs a bare `clerkMiddleware()` on every request — it only makes Clerk's auth context available, it does not itself gate routes. Per Clerk's current guidance, route-matching in middleware is deprecated in favor of **resource-based checks**: every page/route does its own check instead.
- `requireUserId()` — for Server Components/pages; redirects to `/login` if unauthenticated.
- `requireUserIdApi()` — for Route Handlers; returns `null` if unauthenticated, and the caller responds `401` (a redirect from a Route Handler would return a 3xx to a `fetch()` caller instead of a JSON error, so this is a separate helper rather than reusing `requireUserId()`).
- `ensureLocalUser()` — on a user's first authenticated request, upserts a local `User` row keyed by the Clerk user id (email pulled from Clerk) and runs `bootstrapNewUser()` (default categories + a Cash account), so a brand-new sign-up isn't dropped into an empty app.
- `/login` and `/register` render Clerk's hosted `<SignIn/>`/`<SignUp/>` components (catch-all routes under `app/(auth)/`). `/api/ingest/*` remain public — token-protected via `INGEST_TOKEN`/`CRON_SECRET` in the route handler itself, not Clerk sessions, since their callers (email forwarders, Vercel Cron) have no Clerk session to present.

### 3.6 Net worth (`lib/networth`)
Tracks all of the user's money, not just spend-tracked accounts — the goal is one number that answers "what am I worth right now," plus a trend over time. Deliberately scoped to **manual entry**, not live bank aggregation: India's automated equivalent (the RBI Account Aggregator framework — Setu/Finvu/OneMoney/CAMSFinServ) requires the app to register as a regulated FIU, which is out of scope for this project. Existing `EMAIL`/`LLM`-sourced transaction ingestion (§3.3) already keeps `BANK`/`CASH`/`CREDIT_CARD` balances live without that; net worth extends coverage to the accounts nothing can auto-feed.

- **Three new `AccountType` values** — `INVESTMENT`, `LOAN`, `OTHER_ASSET` — for money/property that isn't fed by transaction ingestion (brokerage/MF holdings, a loan owed, real estate, jewelry, etc). These accounts carry a manually-entered `Account.currentBalance` instead of a transaction ledger.
- **`computeAccountBalances(userId)`** (`lib/networth/service.ts`) — the current balance per account, one formula per account class:
  - **Ledger accounts** (`BANK`, `CASH`, `CREDIT_CARD`): `openingBalance + Σcredits − Σdebits` on the account itself, **plus** the amount of any `TRANSFER`-kind transaction elsewhere whose `transferAccountId` points at this account (a credit-card bill paid from a bank account is recorded once, on the bank side — see §2 — so the card's own balance has to pick it up via `transferAccountId` or a paid-down card would look like it never got paid). A card that's carrying a balance naturally computes negative; no separate liability flag needed for it.
  - **Manual accounts** (`INVESTMENT`, `LOAN`, `OTHER_ASSET`): `Account.currentBalance` as entered, most recently, via the account form. `LOAN` is entered as a positive "amount owed" and negated when summed into net worth.
- **`computeNetWorth(balances)`** (`lib/networth/aggregate.ts`, pure/unit-tested) — signed per-account net-worth contribution (ledger balance as-is; `INVESTMENT`/`OTHER_ASSET` positive; `LOAN` negated), split into `assets`/`liabilities` by sign, `totalAssets − totalLiabilities = netWorth`.
- **`BalanceSnapshot`** — a `POST /api/networth/snapshot` action stores the current balance of every non-archived account, timestamped; `netWorthSeries()` sums each snapshot batch (by `asOf` day, with the same sign convention) into a `{date, netWorth}` series for the trend chart. Snapshots are additive history, never overwritten — recomputing current balances never touches them.
- **Screen** (`/networth`) — hero net-worth number + trend line (from snapshots), assets vs. liabilities breakdown, per-account list, "Update balance" for manual accounts, "Snapshot now" to checkpoint the trend.

## 4. API surface (representative)

| Method | Path | Purpose |
|---|---|---|
| — | — | Auth is Clerk-hosted (no custom `/api/auth/*` routes); client components read session state via Clerk's own hooks (`useUser`, `useAuth`). |
| GET/POST | `/api/accounts` | list/create |
| PATCH/DELETE | `/api/accounts/:id` | update/archive |
| GET/POST | `/api/transactions` | list(filter/search/sort/paginate)/create |
| PATCH/DELETE | `/api/transactions/:id` | edit/delete (+undo) |
| GET/POST/PATCH/DELETE | `/api/budgets` | budgets CRUD |
| POST | `/api/import/parse` | upload → parsed preview + tie-out + dedup flags |
| POST | `/api/import/commit` | commit reviewed rows (merge dups) |
| POST | `/api/ingest/email` | email alert intake (gated/token) |
| GET | `/api/analytics?period=` | KPIs, series, category/account breakdown, budgets |
| GET | `/api/networth` | current balances, assets/liabilities totals, trend series |
| POST | `/api/networth/snapshot` | checkpoint every account's current balance into `BalanceSnapshot` |
| GET | `/api/export?type=csv\|pdf` | export |

All responses JSON; amounts as strings (Decimal-safe); errors `{error, code}`.

## 5. Screens (behavior)

- **Login/Register** — Clerk's hosted `<SignIn/>`/`<SignUp/>` components, centered.
- **Home/Today** — streak pill (gentle), hero "spent this month" + sparkline + delta, 1 insight card, To-Review queue (email/import pending, one-tap confirm), quick-add entry. Mobile: bottom tabbar + center Add FAB. Desktop: left rail.
- **Quick-add** — bottom sheet (mobile) / modal (desktop): amount pad focused, recents templates, prediction-ranked category chips, account chips, `More` (note/date/rail/split-off), Save + Undo toast.
- **Transactions** — filter bar (account/category/period/text), sortable table, density toggle, inline edit, multiselect bulk categorize, `/` search, keyboard row nav.
- **Import** — 5-step: source→detect→map(confirm/remembered)→parse→review. Tie-out banner (balanced ✓ / off-by ⚠), confidence tags, dedup side-by-side (merge/keep-both), bulk-accept verified.
- **Analytics** — KPI card row → category bars → spending calendar heatmap → trend line → account breakdown → budgets vs actual → insight cards → period segmented control → export buttons.
- **Accounts** — account cards (glyph, name, last4, month spend, sparkline), add/archive, per-account drill. Includes `INVESTMENT`/`LOAN`/`OTHER_ASSET` types, which show/edit a manual current balance instead of month spend.
- **Net worth** — hero total (assets − liabilities) + trend line, assets/liabilities breakdown, per-account balances, "Update balance" (manual accounts), "Snapshot now".

All screens: dark default + light; loading (skeleton), empty (illustration + CTA), error (card-scoped banner + retry) states.

## 6. Design system (implementation)
Tokens in `lib/design/tokens.ts` + CSS variables in `app/globals.css`, mirroring the showcase: color (dark + light), 4pt spacing scale, type ramp (SF/Inter, tabular numerals), radius, elevation (hairline + shadows for overlays), motion (120/180/240ms, decelerate easing, reduced-motion fallback). Components: Button, AccountChip, CategoryChip, AmountPad, TransactionRow, InsightCard, BudgetBar, SegmentedControl, TabBar/Rail, CommandPalette, Toast/Undo, Skeleton, ConfidenceTag, KpiCard, chart wrappers with the four states.

## 7. Accessibility
AA+ contrast; visible 2px accent focus ring; full keyboard operability (table nav, palette, all actions); focus trap+restore in overlays; ≥44px targets; `aria-live` on review count + toasts; icon buttons labeled; charts have accessible table alternative; `prefers-reduced-motion` honored.

## 8. Test plan
- **Unit (vitest):** `parseNarration` across UPI/NEFT/RTGS/IMPS/Card samples; `tieOut` balanced + off-by cases; `dedup` exact/probable/new; `categorize` rules+heuristic; email `parseAlertEmail`; redaction.
- **Integration:** import parse→commit round-trip (dedup merge); transactions filter/search; analytics aggregation; sign-up (Clerk)→protected route→auto-bootstrap.
- **Build/type:** `next build` + `tsc --noEmit` clean.
- **Manual smoke (documented):** run against seeded Postgres; verify quick-add, import review, analytics, theme toggle, ⌘K, PWA install.

## 9. Environment
`DATABASE_URL`, `INGEST_TOKEN` live in `.env` (local Postgres). `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (from `vercel integration add clerk` or dashboard.clerk.com) live in `.env.local`, along with optional `KV_REST_API_URL` + `KV_REST_API_TOKEN` (from `vercel integration add upstash/upstash-kv`) for distributed rate limiting on the ingest webhooks — falls back to an in-memory limiter without them. Optional `AI_GATEWAY_API_KEY` + `LLM_MODEL` (or the auto-injected `VERCEL_OIDC_TOKEN` on Vercel), optional `GMAIL_*`. `.env.example` documents all. `docker-compose.yml` provides Postgres. Scripts: `dev`, `build`, `start`, `db:push`, `db:migrate`, `seed`, `test`, `lint`, `typecheck`.
