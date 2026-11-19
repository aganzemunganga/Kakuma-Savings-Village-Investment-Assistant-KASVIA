# Test report

_Run with `npm test` (Node 22, `fake-indexeddb`). Last run: 10 passed, 0 failed._

## Automated tests (`tests/kasvia.test.js`)

These load the real files from `app/` into a sandbox, so they test production code.

| # | What is verified |
|---|---|
| 1 | Flat interest: KSh 10,000 at 10% → 1,000 interest, 11,000 total |
| 2 | Declining-balance interest: KSh 10,000, 10%, 4 periods → 2,500 interest |
| 3 | Zero rate and invalid input do not break the calculation |
| 4 | Password strength rule (8+ chars, letter and number) |
| 5 | Passwords are salted and hashed, differ per salt, never contain the plain text, and verify correctly |
| 6 | Sequential unique IDs for members, transactions, loans, receipts |
| 7 | Database put/get/query and full export → clear → import round trip |
| 8 | Role permissions: Treasurer and Secretary cannot approve loans, restore backups, manage users or change settings |
| 9 | No role can delete transactions |
| 10 | Application code contains no external URLs or external `fetch` calls |

## Not yet covered (honest gaps)

- Automated end-to-end browser tests of every screen (login, forms, printing).
- Cross-browser and low-end-phone testing.
- Real-device offline test after installing the PWA (airplane-mode check).
- Load testing with large groups (hundreds of members, years of data).

## Manual pilot checklist

1. Install from the hosted demo, switch the device to airplane mode, reopen the app. ✔/✘
2. Complete setup, load demo data, record savings, a loan, a repayment, a fine. ✔/✘
3. Void a transaction with Administrator re-authentication; confirm the audit log entry. ✔/✘
4. Download a backup, clear site data, restore, confirm records return. ✔/✘
5. Print a receipt and a member statement. ✔/✘
