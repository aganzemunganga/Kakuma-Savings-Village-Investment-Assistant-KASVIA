# Architecture

KASVIA is a static, offline-first single-page app. There is **no server-side code**.

## Layers

| Layer | Files | Responsibility |
|---|---|---|
| UI / routing | `app/index.html`, `app/ui.js`, `app/main.js` | Shell, navigation, dashboard, forms, modals |
| Feature modules | `app/modules.js`, `app/loans.js`, `app/reports.js` | Members, savings, fines, welfare, expenses, loans, repayments, reports, search |
| Security | `app/auth.js`, `app/util.js` | Roles/permissions, sessions, lockout, password hashing, audit log |
| Data | `app/db.js` | IndexedDB wrapper (all reads and writes) |
| Offline / install | `app/sw.js`, `app/manifest.json`, `app/install.js` | Cache-first service worker, PWA install |

## Data model (IndexedDB object stores)

`settings` · `users` · `members` · `savings` · `shares` · `loans` · `repayments` · `fines` · `welfare` · `expenses` · `meetings` · `auditLogs` · `cycles` · `alerts`

Settings are key/value documents (group profile, savings rules, loan rules, ID counters, current cycle). Indexes exist on `memberId` and `loanId` for fast per-member and per-loan lookups.

## Key design decisions

- **Void, never delete.** Financial records are marked voided with who/when/why; the original stays visible. `PERMS.transactions_delete` is empty for every role.
- **Configurable rules.** Interest rate, method (flat or declining balance), share value and borrowing limit are settings, not constants.
- **Sequential IDs.** `VSL-0001`, `TXN-2026-000001`, `LOAN-2026-000001`, `RCT-2026-000001` come from counters stored in the database.
- **Separation of duties.** Treasurer records money, Secretary keeps members and meetings, only the Administrator approves loans, restores backups and manages users.
- **Cache-first service worker.** After the first load every asset comes from the cache, so the app opens with no connection. Bump `CACHE_NAME` in `sw.js` when shipping changes.
- **No external requests.** No CDN, fonts, analytics or API calls. An automated test enforces this.

## Loan interest

- **Flat:** `interest = principal × rate`; total = principal + interest. Example: KSh 10,000 at 10% → KSh 1,000 interest, KSh 11,000 total.
- **Declining balance:** interest is charged on the remaining principal each period with equal principal instalments. Example: KSh 10,000, 10% per period, 4 periods → 1,000 + 750 + 500 + 250 = KSh 2,500.

Repayments are split into principal and interest and reduce the outstanding balance automatically.

## Limits of this design

IndexedDB is per browser profile, so data is per device (no sync yet). See the roadmap in the README.
