
# Product Requirements Document (PRD)
### Personal Expense Tracker — v1

**Owner:** Kavish · **Status:** Approved for build · **Date:** 2026-07-25
**Related docs:** `FSD.md` (functional spec), `../README.md` (run/build), design plan & showcase (in project history)

---

## 1. Summary
A personal, multi-account expense tracker for use in India, built as a Postgres-backed Next.js web app / installable PWA. It is engineered specifically to defeat the #1 reason people abandon trackers — logging friction — via a frictionless quick-add, strong bulk statement import (with duplicate detection and balance verification), and calm, non-judgmental analytics. Single user per deployment for v1 (Clerk-hosted auth), local-first for testing (Docker Postgres), cloud-deployable later (Vercel + cloud Postgres).

## 2. Goals & non-goals

**Goals (v1)**
- Log an expense in 2–3 taps / < 5 seconds with smart defaults.
- Track multiple real accounts (banks + credit cards + cash); UPI as a payment *rail*, not an account.
- Import bank/card statements (CSV/XLSX; PDF via adapter) into a common schema with dedup + balance tie-out + a review queue.
- Calm analytics: KPI cards, category/account/trend charts, a spending calendar heatmap, budgets (overall + per category).
- Dark-mode-default, light available; installable PWA; command palette + keyboard shortcuts.
- Automated capture pipelines (LLM statement parsing + email ingestion) built and code-complete, gated behind env config with deterministic fallback.

**Non-goals (v1)**
- No shared/Splitwise-style expense splitting.
- No investment/net-worth tracking.
- No multi-user / household accounts (single user).
- No live bank sync via Account Aggregator (schema is AA-ready; integration deferred).

## 3. Target user
Kavish — multi-card, heavy UPI-on-credit-card user in India. Banks: HDFC, ICICI, SBI, Bank of Baroda. Cards: AU Kiwi (RuPay, UPI-linked), ICICI Amazon Pay (Visa), HDFC (RuPay, UPI-linked). Cash: rare (~5–10×/month, manual). Has abandoned trackers before within days due to logging friction.

## 4. Success metrics
- **Primary:** daily-logging retention past day 7 (the historical drop-off point). Proxy in v1: a working streak mechanic + < 5s quick-add.
- Quick-add completion in ≤ 3 taps for the common case.
- Import: ≥ 90% of statement rows auto-verified via balance tie-out; 0 silent duplicates.
- Analytics load < 1s on seeded data.

## 5. Core features (v1 scope — all approved)

| # | Feature | Requirement |
|---|---|---|
| F1 | **Quick-add** | Amount-first bottom sheet (mobile) / modal (desktop); prediction-ranked category + default account pre-selected; recents templates; only amount mandatory; undo on save. |
| F2 | **Accounts** | Seeded 7 accounts + Cash; add/archive (archive preserves history); per-account spend + sparkline. UPI modeled as rail on the transaction. |
| F3 | **Transactions** | Filterable/searchable table (account × category × date × text/amount); sort; inline edit; density toggle; tabular right-aligned amounts. |
| F4 | **Import** | Upload CSV/XLSX (PDF via adapter); auto-detect columns; parse to canonical schema; **balance tie-out** verification; **dedup** vs manual/prior imports; **review queue** for low-confidence/flagged rows; per-bank template memory. |
| F5 | **Automated capture** | (a) **LLM parser adapter** (Vercel AI SDK + AI Gateway) for messy/new formats — gated on `AI_GATEWAY_API_KEY` / Vercel `VERCEL_OIDC_TOKEN`, with a grounding guard that rejects hallucinated rows; falls back to the deterministic parser. (b) **Email ingestion** endpoint that parses forwarded bank-alert emails into pending transactions — gated on Gmail config, testable via POST. |
| F6 | **Analytics** | KPI cards (total, vs last period, avg/day, top category, count); category bars; **spending calendar heatmap**; trend line; account breakdown; **budgets vs actual** (overall + per category, non-judgmental); insight cards (recurring detection, deltas). |
| F7 | **Export** | CSV export of transactions/report; PDF export of the analytics report. |
| F8 | **Command palette + shortcuts** | ⌘K palette (actions + nav + search); direct keys (A add, / search, G leader nav, 1/2/3 period, ⌘Z undo, ? cheat-sheet). |
| F9 | **PWA** | Installable (manifest + service worker, offline shell); responsive — mobile bottom tab bar + desktop left rail; all components usable on both. |
| F10 | **Auth** | [Clerk](https://clerk.com)-hosted sign-in/sign-up (email/password + social); session managed by Clerk; per-user data isolation; protected routes/APIs. New sign-ups are auto-provisioned with default categories + a Cash account. |
| F11 | **Theming** | Full design system (tokens from the showcase); **dark default**, light toggle; respects reduced-motion; AA+ contrast. |

## 6. Capture-automation posture (important)
The LLM and email layers are **core and code-complete**, but their external dependencies (LLM API key, Gmail OAuth) are supplied by the user in the morning. Until then:
- **Statement import fully works** via the deterministic parser (CSV/XLSX + Indian narration regex + tie-out + dedup).
- The **LLM adapter** activates when Gateway auth is available (`AI_GATEWAY_API_KEY` locally, or the auto-injected `VERCEL_OIDC_TOKEN` on Vercel), used for hard/new layouts; raw files parsed locally, only redacted spans sent, and a grounding guard rejects any row not traceable to a real source line + amount.
- The **email ingestion** endpoint accepts posted alert payloads today (testable/seedable); live Gmail polling activates when `GMAIL_*` env is set.
This satisfies "everything included" while guaranteeing a working, testable app overnight.

## 7. Constraints & decisions
- **Stack:** Next.js (App Router) + TypeScript + Tailwind; Prisma ORM; Postgres (Docker locally, cloud later).
- **Auth:** [Clerk](https://clerk.com) (installed via the Vercel Marketplace), hosted sign-in/sign-up UI, session cookie managed by Clerk. Local `User` rows are keyed by the Clerk user id and provisioned lazily on first sign-in.
- **Charts:** Recharts (standard) + Visx (calendar heatmap); jsPDF + CSV for export. Rationale: matches what well-designed analytics dashboards use (Stripe = KPI cards + trend charts + tables + CSV; Zerodha Console = KPI + P&L calendar heatmap + tables), scaled to personal-finance data. Trading libs (ChartIQ/TradingView) are for candlesticks — not used.
- **Design:** dark-default, one accent, muted grey ramp, tabular figures, hairline elevation, calm/non-punishing (no red "over budget").
- **Privacy:** local-first; raw statements parsed locally; only redacted text to LLM when enabled.

## 8. Definition of done (by morning)
- App runs with one command per README (`docker compose up -d` → migrate → seed → `npm run dev`).
- Seeded with the 7 accounts + Cash + realistic sample transactions, categories, and budgets.
- All F1–F11 functional at MVP quality; dark + light both render.
- Automated tests pass (parser, dedup, balance tie-out, and key API routes); `next build` succeeds; typecheck clean.
- `PRD.md`, `FSD.md`, and `README.md` present.
- Clear morning checklist for enabling LLM/email and deploying to Vercel + cloud DB.

## 9. Risks & mitigations
| Risk | Mitigation |
|---|---|
| LLM/email can't be live overnight (no keys) | Deterministic fallback; adapters gated; documented enable steps. |
| Scope large for one night | Vertical-slice priority: run + auth + F1–F4, F6, F8–F11 first; F5 adapters + F7 export layered; tests throughout. |
| Postgres not in build sandbox | App configured for Postgres + docker-compose for user; overnight testing via userspace embedded Postgres. |
| Statement format variance | Column auto-detect + template memory + review queue + tie-out catch errors; nothing wrong auto-accepted. |

## 10. Future (v2+)
Account Aggregator sync · shared/split expenses · investment/net-worth · multi-device cloud auth · Apple Shortcut + share-target capture · advanced rules UI · budget rollover.
