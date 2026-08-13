# Staging Test Checklist — Expense Tracker

Guided manual test pass against your **staging Postgres**. Run everything on your Mac (which can reach staging). Tick each box; expected result is in _italics_. Anything that fails → note it and tell me.

**Auth:** this app uses [Clerk](https://clerk.com) for sign-up/sign-in — there's no local email+password flow anymore. Sign up with a real (or disposable) email at `/register`; a fresh sign-up auto-provisions default categories + a Cash account (confirmed working — see Phase 1), so Quick-Add is never empty. **Test user:** sign up with a disposable email of your choosing for this pass; delete the local `User` row at the end (Cleanup) to leave staging clean — this does **not** delete the Clerk account itself (do that from the Clerk dashboard if needed).

---

## Phase 0 — Preflight (terminal)

- [ ] `.env` `DATABASE_URL` points at **staging**. _(confirm the host, not localhost)_
- [ ] `npm install` completes _(runs `prisma generate` via postinstall — no errors)_
- [ ] `npm run db:push` _(or `prisma migrate deploy`) — schema in sync, "already in sync" is fine_
- [ ] `npm run typecheck` → _no errors_
- [ ] `npm test` → _all unit tests pass (parser, tie-out, dedup, categorize, analytics, email)_
- [ ] `npm run build` → _build succeeds_ **(this is the one step never run in my sandbox — most likely place for a surprise; report any error verbatim)**
- [ ] `npm run start` (prod) **or** `npm run dev` → open `http://localhost:3000`

---

## Phase 1 — Auth & access control

- [ ] Visit `/` while logged out → _redirected to `/login`_
- [ ] Hit an API directly logged out, e.g. `curl -i localhost:3000/api/analytics` → _401 unauthorized_
- [ ] Go to `/register`, sign up with a disposable email via Clerk → _lands on **Today**; Quick-Add already has default categories + a **Cash** account (auto-bootstrapped on first sign-in — confirms the old register-bootstrap gap is fixed)_
- [ ] Log out (rail → **Log out**) → _back to `/login`; `/` again redirects_
- [ ] Log back in with the same account → _lands on **Today** again, same data_
- [ ] `npm run seed` (from the terminal, now that a user exists) → _prints "Seeded sample data for &lt;your email&gt;" and replaces your bootstrap defaults with 8 accounts + categories + budgets + ~76 days of transactions — reload **Today** to see it_

---

## Phase 2 — Today / Home

- [ ] Hero **"Spent this month"** shows a ₹ figure with tabular digits; sparkline renders; **streak** pill shows "N of last 7 days"
- [ ] **To-Review** queue shows ~4 pending items (source: imported/email); each has Confirm
- [ ] Click **Confirm** on one → _row disappears, "N new" count decrements, it moves into Recent_
- [ ] **Recent** list is populated
- [ ] Theme toggle (dark is default) → switch to light → _whole UI flips_; reload → _choice persists_

---

## Phase 3 — Quick-Add (the make-or-break flow)

- [ ] Press **A** (desktop) or tap the center **+** (mobile) → _sheet opens, amount field focused_
- [ ] Type an amount on the keypad → _live ₹ formatting_
- [ ] Tap a **recents** tile → _prefills amount/category_
- [ ] Category chip pre-selected; account chip pre-selected (a credit card) → _both changeable in one tap_
- [ ] **Save** → _toast appears, sheet closes, item shows in Recent, month total updates_
- [ ] Open Quick-Add, leave amount empty → _Save is disabled_

---

## Phase 4 — Transactions (data page)

- [ ] Table loads; amounts **right-aligned, tabular**; row hover highlights
- [ ] Filter by **account** → _list narrows_
- [ ] Filter by **category** → _list narrows_
- [ ] Search a merchant (e.g. "swiggy") and an amount (e.g. "420") → _matches_
- [ ] Press **/** → _search box focuses_
- [ ] Toggle **Compact/Comfortable** → _row density changes_
- [ ] **Export CSV** → _file downloads_; open it → _correct columns; any cell starting with = + - @ is prefixed with `'` (formula-injection guard)_

---

## Phase 5 — Import (tie-out + dedup — trust-critical)

- [ ] Go to **Import**, select account **HDFC RuPay**
- [ ] Upload `samples/hdfc-sample-statement.csv`
- [ ] _**Tie-out banner is green ✓ "Balanced"**, opening ₹50,000 → closing ₹2,04,219_
- [ ] Rows table shows categories auto-assigned; Verified/Review tags present
- [ ] Click **Commit** → _success line "Added X, merged Y, skipped Z"_
- [ ] Go to Transactions → _the 7 imported rows are present; the salary shows as a credit_
- [ ] **Re-import the same file** → _the previously-imported rows now flag as **duplicates** (dup → merge); committing again does **not** double-count_
- [ ] Manually Quick-Add a txn matching one statement row (same amount/date/account), then import that file → _it flags as **PROBABLE** duplicate for merge_
- [ ] Negative: upload a random non-statement CSV (or an empty file) → _graceful error, no crash_
- [ ] _(If `AI_GATEWAY_API_KEY` set)_ upload an odd-format sheet with no standard headers → _LLM fallback kicks in; grounded rows only. Without a key → deterministic path handles standard headers._

---

## Phase 6 — Analytics

- [ ] **KPI cards** populate: Total spent, Avg/day, Transactions, Top category
- [ ] **Category** bars render (ranked, colored); **Daily trend** line renders
- [ ] **Spending calendar heatmap** renders with intensity shading + legend
- [ ] **Budgets vs actual**: overall + per-category bars; an over-budget category shows _neutral "₹X over — review"_ (not a red alarm)
- [ ] **Segmented control** Week / Month / Quarter → _data + charts update_
- [ ] **Recurring detected** card lists repeats (e.g. Netflix)
- [ ] **Export PDF** → _a report PDF downloads with category + budget sections_

---

## Phase 7 — Accounts

- [ ] 7 bank/card cards **+ Cash** show this-month spend + txn count + hover lift
- [ ] **Add account** ("Test Card", Credit card) → _appears in list and in Quick-Add account chips_
- [ ] **Archive** an account → _disappears from list, but its past transactions still show in Transactions (history preserved)_

---

## Phase 8 — Command palette & keyboard

- [ ] **⌘K** opens the palette; type to filter; **↑/↓** move; **Enter** runs; **Esc** closes
- [ ] Palette "Add expense" → _opens Quick-Add_; "Export…" → _downloads CSV_; "Toggle theme" → _flips theme_
- [ ] Leader nav: **G** then **T / A / H / C** → _navigates to Transactions / Analytics / Home / Accounts_
- [ ] **?** → _shortcut cheat-sheet overlay_
- [ ] On Analytics, **1 / 2 / 3** → _Week / Month / Quarter_

---

## Phase 9 — Email ingestion (webhook)

- [ ] With the app running, POST a sample alert (use your `.env` `INGEST_TOKEN` and the email you signed up with in Phase 1):
  ```bash
  curl -i -X POST localhost:3000/api/ingest/email \
    -H 'Content-Type: application/json' \
    -d '{"token":"<INGEST_TOKEN>","email":"<your signed-up email>",
         "subject":"Txn alert",
         "body":"Rs.532.00 spent on HDFC Card ending 2233 at ZOMATO on 26-07-26 via UPI."}'
  ```
  _→ 200 `{ ok: true }`_
- [ ] Reload **Today** → _the ₹532 Zomato item appears in **To-Review**_
- [ ] Repeat with a wrong token → _401 unauthorized_
- [ ] _(If wiring real Gmail later — `@googleapis/gmail` is now installed — the same parse path is reused.)_

---

## Phase 10 — PWA & responsive

- [ ] DevTools → Application: **manifest** loads, **service worker** registers
- [ ] "Install app" / Add to Home Screen works (icon + name "Expenses")
- [ ] Offline: with the app loaded, go offline and reload → _app shell still renders (offline fallback)_
- [ ] Resize to phone width → _bottom tab bar + center FAB_; wide → _left rail_
- [ ] Focus states visible when tabbing; contrast readable in both themes

---

## Cleanup (leave staging clean)

Delete the disposable test user's local row (cascades to remove its accounts, transactions, budgets, etc. — this does **not** delete the Clerk account itself, which is managed separately in the Clerk dashboard):
```sql
DELETE FROM "User" WHERE email = '<your disposable test email>';
```
Or from the app machine: `psql "$DATABASE_URL" -c "DELETE FROM \"User\" WHERE email = '<your disposable test email>';"`
_(Re-running `npm run seed` doesn't delete the user — it wipes and replaces that same user's accounts/categories/budgets/transactions in place.)_

---

## Result log

| Phase | Pass? | Notes / failures |
|---|---|---|
| 0 Preflight | ☐ | |
| 1 Auth | ☐ | |
| 2 Home | ☐ | |
| 3 Quick-Add | ☐ | |
| 4 Transactions | ☐ | |
| 5 Import | ☐ | |
| 6 Analytics | ☐ | |
| 7 Accounts | ☐ | |
| 8 Palette/keys | ☐ | |
| 9 Email ingest | ☐ | |
| 10 PWA/responsive | ☐ | |

Send me this table filled in (or just the failures) and I'll fix whatever breaks.
