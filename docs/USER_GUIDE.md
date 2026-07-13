# Ledger — User Guide

A shared household finance tracker built for two people to see and manage the **same** budget.

This guide covers **Phase 1** (the version live today): you enter accounts, buckets, and
transactions by hand. The data model underneath already supports later phases (bank import,
auto-tagging, analytics, investing), so nothing you enter now will be thrown away when those
arrive.

> **Who this is for:** you and Katherine, the two members of the household. Everything you both
> enter goes into one shared household — you see each other's entries.

---

## 1. Getting in

**Where:** `https://ledger.mikesullivan.dev`

- The app is **LAN-only** in this version. When you're on the home network it loads directly.
  From outside the house you'll first hit a **Basic Auth** username/password prompt (the reverse
  proxy), *then* the app.
- Sign in is **Google only** — there are no passwords to manage and no "forgot password" flow.
- Only **allowlisted emails** can get in. Sign-in is checked against the household allowlist on
  **every** attempt; a Google account that isn't on the list is refused (you'll just bounce back
  to the sign-in page). To add or change who's allowed, edit `ALLOWED_HOUSEHOLD_EMAILS` in the
  deployment env and restart the app.
- **One shared household.** The first allowlisted person to sign in creates the household; the
  second allowlisted person to sign in **joins the same one automatically** — there's no "invite"
  step and no way to accidentally create a second household.

**Steps:** open the URL → (if off-network) enter the Basic Auth credentials → **Sign in with
Google** → you land on the Dashboard.

---

## 2. The four screens

The top nav is the same everywhere: **Dashboard · Transactions · Buckets · Accounts**, with your
name and **Sign out** on the right.

| Screen | URL | What it's for |
|---|---|---|
| **Dashboard** | `/` | This month's budget at a glance: allocated vs. spent per bucket |
| **Transactions** | `/transactions` | The running list of everything entered; add or delete here |
| **Buckets** | `/buckets` | Create budget categories and set each month's allocation |
| **Accounts** | `/accounts` | The accounts (checking, savings, credit card, …) transactions belong to |

---

## 3. First-time setup — recommended order

Do these once, in this order, and the Dashboard will start showing meaningful numbers.

1. **Add your accounts** (Accounts screen). One per real-world account — e.g. "Joint Checking"
   (checking), "Amex" (credit_card), "Emergency Fund" (savings).
2. **Create your buckets** (Buckets screen). These are your budget categories — e.g. "Groceries",
   "Rent", "Dining Out", "Savings". Optionally tag each with a **Group** (like *needs / wants /
   savings*) to keep them organized.
3. **Set this month's allocation** for each bucket (Buckets screen) — the dollar amount you're
   budgeting for that category this month.
4. **Enter transactions** as you spend (Transactions → *+ Add transaction*).
5. **Read the Dashboard** — each bucket shows Allocated, Spent, and Remaining for the month.

---

## 4. Screen reference

### Accounts (`/accounts`)
- **Add an account:** enter a **Name** and pick a **Type** — `checking`, `savings`,
  `credit_card`, `cash`, `loan`, or `investment` — then **Create**.
- **Archive** hides an account you no longer use. It's a soft-hide (the data and its transactions
  stay); it just drops off the list and out of the transaction dropdown. There's no un-archive
  button in the UI yet.

### Buckets (`/buckets`)
- **Add a bucket:** enter a **Name** (required) and optionally a **Group** (free text, e.g.
  `needs`, `wants`, `savings`), then **Create**.
- **Set the monthly allocation:** each bucket row has a `$` field showing this month's allocation.
  Type the amount and click **Save**. Allocations are **per bucket, per month** — setting April
  doesn't change May.
- **Archive** soft-hides a bucket (keeps its history) and removes it from the Dashboard.
- **⚠️ Quirk:** the Buckets page always shows the **current** month and has **no month switcher**.
  To set an allocation for a *different* month, add `?month=YYYY-MM` to the URL — e.g.
  `…/buckets?month=2026-08`. The Save button remembers whichever month the page is showing.

### Add a transaction (`/transactions/new`)
Reachable from the **+ Add transaction** button on the Dashboard or Transactions list.

| Field | Notes |
|---|---|
| **Type** | `Spend` (default), `Income`, or `Transfer`. **This sets the sign** — see below. |
| **Amount ($)** | Always type a **positive** number. The app applies the sign from the Type. |
| **Date** | Defaults to today. |
| **Account** | Optional — leave as *— none —* if you don't want to attribute it yet. |
| **Bucket** | Optional — *— uncategorized —* leaves it out of every bucket total. |
| **Merchant** | Optional. |
| **Description** | Optional. Shown first in the list; falls back to Merchant, then "—". |

Click **Save** and you're returned to the Transactions list.

### Transactions list (`/transactions`)
- Shows the **100 most recent** transactions, newest first.
- Columns: **Date · Description · Account · Bucket · Amount · Last edited**.
- **Amount color:** red = money out (Spend), green = money in (Income/Transfer).
- **Last edited** shows *who* made the last change (from the audit log) — handy when it's the two
  of you sharing the ledger.
- **Delete** removes a transaction (it's logged in the audit trail). **There is no edit** — to
  correct a transaction, delete it and add it again.

### Dashboard (`/`)
- **Month navigation:** `← Prev` / month name / `Next →`. Defaults to the current month.
- Table of your active buckets: **Bucket · Allocated · Spent · Remaining**.
  - **Allocated** — what you budgeted for that bucket this month (0 if unset).
  - **Spent** — the sum of **Spend**-type transactions assigned to that bucket this month.
  - **Remaining** — Allocated − Spent. **Turns red when you've overspent** (negative).
- Only **Spend** transactions that have a **bucket** count toward Spent. Income, transfers, and
  uncategorized spending won't show up in a bucket row.

---

## 5. Money & input rules

- Every amount is stored internally as **integer cents** — no floating-point rounding drift.
- You type dollars. The amount field accepts only a plain number with up to two decimals:
  `12`, `12.5`, `12.50`, `-3.00` are all valid.
- **Not accepted** (these throw an error page): a `$` sign, thousands separators (`1,200`), or
  more than two decimals (`12.500`). Type `1200`, not `$1,200`.
- **You never type a minus sign for normal spending** — choosing **Type = Spend** makes it a
  negative (money out) automatically.

---

## 6. Known limitations in this version (Phase 1)

None of these are bugs — they're just not built yet. Worth knowing before you test:

- **No transaction editing** — delete and re-add to correct one.
- **Buckets page shows the current month only** — use the `?month=YYYY-MM` URL trick for others.
- **Transfers are single-sided** — a Transfer records one positive entry; it does **not** move
  money between two accounts as a proper double-entry pair.
- **Bucket "Group" is a label only** — it's shown but not yet subtotaled anywhere.
- **No account balances** — the app doesn't compute a running balance per account yet.
- **Errors are full-page** — a bad amount shows an error page rather than a friendly inline
  message. Just go back and fix the input.
- **List caps at 100 transactions.**
- **Not here yet:** bank CSV import, auto-tagging/rules, spending analytics/reports, and
  investment/net-worth tracking.

---

## 7. What's coming next

- **Phase 2** — import real bank transactions from a CSV, plus rule-based auto-tagging into
  buckets.
- **Phase 3** — spending analytics and reporting.
- **Phase 4** — investment and net-worth tracking.

---

## 8. User-testing checklist

Use this to shake the app out before trusting it with real numbers. Check items off as you go.

### Access & accounts
- [ ] **Michael** signs in with Google and lands on the Dashboard. *(already verified)*
- [ ] **Katherine** signs in with Google → confirm she lands in the **same** household (she can
      see Michael's buckets/transactions), **not** a fresh empty one. *(still unverified — this is
      the key second-member test)*
- [ ] A Google account **not** on the allowlist is refused (bounced back to sign-in).

### Setup flow
- [ ] Create at least one account of a few different **Types**; confirm each appears.
- [ ] **Archive** an account and confirm it disappears from the list and the transaction dropdown.
- [ ] Create buckets **with** and **without** a Group; confirm both show.
- [ ] Set an allocation for the **current** month, then for a **different** month via
      `?month=YYYY-MM`; confirm they're independent.

### Transactions
- [ ] Add a **Spend** with a bucket → it shows **red** in the list and **increases Spent /
      decreases Remaining** for that bucket on the Dashboard.
- [ ] Add an **Income** → shows **green**; confirm it does **not** count toward any bucket's Spent.
- [ ] Add a transaction with Account and Bucket left blank (uncategorized) → confirm it still
      saves and shows "—".
- [ ] **Delete** a transaction → confirm it's gone from the list and the Dashboard updates.

### Edge cases
- [ ] Enter an amount with a `$`, a comma, or 3 decimals → confirm it errors (expected).
- [ ] Overspend a bucket (Spent > Allocated) → confirm **Remaining goes red**.

### Cross-user (shared ledger)
- [ ] Both of you sign in and confirm you see the **same** data.
- [ ] Confirm the **Last edited** column attributes each change to the right person.

### Out of scope for user testing, but track for "trust with real money"
- [ ] Confirm the **nightly backup cron** is actually installed on the NAS (`sudo crontab -l`) —
      still unconfirmed per project STATUS.
