# KASVIA — Kakuma Savings & Village Investment Assistant
Offline Village Savings and Loans (VSL) Management System

---

## 1. What this is

KASVIA is a self-contained, **100% offline** application for running a Village
Savings and Loans group: member registration, savings, shares, loans and
interest, repayments, fines, welfare, group expenses, cash reconciliation,
meetings/attendance, reports, receipts, backups, and an audit trail.

All data is stored **only on the device it runs on**, in the browser's local
database (IndexedDB). Nothing is ever sent to the internet. It never requires
a network connection to record, calculate, search, print, back up, or restore
data.

---

## 2. Installing it on a Windows laptop

1. Copy the whole `KASVIA` folder onto the laptop (USB drive, or however you
   received it). Keep all files together in the same folder.
2. Double-click **`Start_KASVIA_Windows.bat`**.
   - This starts a small local server on the laptop itself and opens KASVIA
     in your default browser. No internet connection is used — the server
     only talks to devices on your own local network (or just to this
     computer if you're not on any network at all).
   - If Python isn't installed, the script tells you so. You can either
     install Python once (free, from python.org) for the full experience
     described below, **or** just double-click `index.html` directly — KASVIA
     will still work fully offline on that one computer.
3. Keep the black window open while you use KASVIA. Closing it stops the
   server (closing the browser tab is fine and doesn't lose any data — your
   records are saved to the device, not to that window).

### Using KASVIA on phones and other devices

KASVIA stores data **inside the browser of the device it is opened on**
(IndexedDB). That means each device has its **own separate database**:
a phone that opens the laptop's address does *not* see or edit the laptop's
records. There is no live sync between devices in this version.

The recommended set-up is therefore **one primary device per VSL group**
(for example the Treasurer's laptop or phone) where all transactions are
entered. To move records to another device, use **Backup & Restore**:
download a backup on one device and restore it on the other.

Phones on the same WiFi hotspot can still open the laptop's address
(`http://192.168.x.x:8080`) to load the app, which then works offline from
that phone's own browser. This is useful to give each committee member their
own copy of the app, but each copy starts empty unless a backup is restored.

### Installing KASVIA as an app icon

**On the computer running KASVIA** (opened via the `Start_KASVIA` script, at
`http://localhost:8080`): open it in Chrome or Edge and you'll now see an
**Install** button in the address bar (or KASVIA will show its own **Install
KASVIA** banner at the bottom of the screen). Either one adds a KASVIA icon
to the desktop/Start Menu/Applications folder that opens full-screen, with
no browser address bar — a real installed app. This needs the local server
described above; it does not work if you open `index.html` by double-clicking
it directly, because installing a web app requires the page to load from a
server address, not a raw file on disk.

**On a phone connected over WiFi**, browsers apply an extra rule: a full
"Install" is only offered on `https://` addresses, or on `http://localhost`
on the same device. A phone opening the laptop's WiFi address (something
like `http://192.168.1.5:8080`) is neither, so **the phone won't be offered
a full install — this is the browser's security rule, not a KASVIA bug**,
and no VSL app can work around it while running over plain WiFi. You have
two options on the phone:

- **Simple, works everywhere, no setup:** in the phone's browser menu, choose
  **Add to Home Screen**. This still creates a KASVIA icon that opens
  directly to the app (on iPhone, thanks to KASVIA's Apple Web App tags,
  this even opens full-screen with no address bar). It just isn't the
  "true" installed-app treatment Android gives to fully secure sites.
- **Full install on the phone too:** on that phone's Chrome, visit
  `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add
  `http://192.168.1.5:8080` (using the exact address the laptop showed),
  set it to **Enabled**, and relaunch Chrome. Chrome will now treat that
  one address as secure and offer the full Install prompt on that phone,
  same as on the laptop. This is a one-time, per-phone setting — do it once
  when you first set up each committee member's phone.

### macOS / Linux

Use `Start_KASVIA_Mac_Linux.sh` the same way (double-click, or run
`./Start_KASVIA_Mac_Linux.sh` in a terminal).

### If Install still doesn't appear

- Make sure you opened KASVIA through `http://localhost:8080` (via the start
  script), not by double-clicking `index.html`.
- Refresh the page once after the first load — Chrome/Edge sometimes need a
  moment to finish checking the manifest and service worker.
- Already installed? Browsers hide the Install button once an app is
  installed. Check your Start Menu/Applications/home screen for the KASVIA
  icon instead of looking for the button again.
- Confirm you're on a reasonably current version of Chrome, Edge, or (on
  Android) Samsung Internet — Firefox desktop and Safari on Mac do not
  support installing web apps this way, though KASVIA runs fine as a normal
  browser tab in either.

---

## 3. First-time setup

The first time KASVIA is opened on a device, it walks you through a short
setup wizard:

1. VSL group name and location.
2. Savings & share rules (minimum weekly savings, meeting frequency, share
   value).
3. Loan interest rules (interest rate, flat vs. declining-balance method,
   default duration, maximum loan relative to a member's savings).
4. Creating the **Administrator** account.
5. Creating the **Treasurer** account.
6. Creating the **Secretary** account.

You choose every username/phone number and password yourself during setup —
KASVIA does **not** ship with any built-in default password. Passwords must
be at least 8 characters and include a letter and a number, and are stored
only as a securely salted, hashed value (PBKDF2-SHA256) — never as plain
text.

Once setup is complete, anyone opening KASVIA on that device sees the login
screen.

---

## 4. The three user roles

| Role | Can do | Cannot do |
|---|---|---|
| **Administrator** | Everything: approve/reject loans, manage users, change settings, restore backups, close cycles, authorize corrections, view audit log | — |
| **Treasurer** | Record savings, repayments, fines, welfare, expenses; view balances; print receipts; generate financial reports | Delete members or transactions, change settings, create admins, restore backups |
| **Secretary** | Register/update members, record meetings & attendance, view member/savings/loan information, print member lists | Approve loans, change financial settings, restore backups, change other users' passwords |

Sensitive actions (voiding a transaction, closing a cycle, restoring a
backup, creating/disabling a user) always prompt for a **second
Administrator sign-in** before proceeding, even if an Administrator is
already logged in — this is recorded in the audit log along with who
authorized it.

**Financial records are never permanently deleted.** Mistakes are corrected
using **Void**, which keeps the original entry visible (marked *Voided*) and
records who voided it and when.

---

## 5. Day-to-day use

- **Dashboard** — today's activity and group-wide totals at a glance.
- **Members** — register, search, and open a member's full profile and
  printable statement.
- **Savings & Shares** — record regular/additional savings and share
  purchases; each member's share ledger updates automatically.
- **Loans** — apply → Administrator approves → disburse → repay. Interest is
  calculated automatically using the group's configured rate and method
  (Flat or Declining balance), and clearly shown at every step. Before
  approval, KASVIA shows the member's savings, existing loan balance, and
  warns if the request exceeds the group's configured borrowing limit.
- **Repayments** — each repayment is split automatically into interest and
  principal, updates the loan balance, and can be paid by Cash or M-Pesa
  (enter the M-Pesa code manually — no internet/API connection is used or
  required).
- **Fines / Welfare / Expenses** — simple transaction logs, each printable
  as a receipt.
- **Meetings** — records attendance per member and any secretary's remarks.
- **Cash Management** — shows the expected cash balance built from every
  transaction, and lets you compare it against a physical cash count to spot
  discrepancies.
- **Reports** — savings, loans, repayments, interest, fines, welfare,
  expenses, members, and meeting summaries, filterable by date range or VSL
  cycle, printable, or exportable to CSV (opens in Excel).
- **VSL Cycles** — start/close a savings cycle; a closed cycle cannot be
  silently edited — any correction is authorized and logged.

---

## 6. Backup & Restore

- **Settings ▸ Backup & Restore ▸ Download backup** saves a single file
  (`*.kasvia.json`) containing every record in the system. Store copies on a
  USB drive or elsewhere safe, regularly.
- **Restore** replaces the current database with a chosen backup file.
  KASVIA always asks for confirmation first, because this cannot be undone.
- Individual modules (members, savings, loans, etc.) can also be exported
  as CSV for use in Excel.

---

## 7. Security notes

- Passwords are hashed with PBKDF2-SHA256 (120,000 iterations) and a random
  salt per user — never stored in plain text.
- Accounts lock for 5 minutes after 5 failed login attempts.
- Sessions automatically log out after 15 minutes of inactivity.
- Every significant action (login, registration, approvals, voids, backups,
  restores, settings changes) is written to an immutable **Audit Log**,
  visible only to Administrators, showing who did what and when.
- Data lives only in the browser's local storage on the device it was
  entered on. If you clear your browser's site data for KASVIA, or use a
  different browser/device, you'll be looking at an empty (or differently
  set up) database — so keep regular backups.

---

## 8. Demo / test data

On a brand-new install with no members yet, the Administrator's dashboard
offers a **Load demo data** button. This creates five clearly fictional
members (Amina, John, Mary, Peter, Grace) with sample savings and one sample
loan, so you can explore every screen safely before entering real records.

---

## 9. What was tested

Every module described above was exercised end-to-end during development:
login and lockout behaviour, role permissions per screen, member
registration/search, savings and share recording, the full loan lifecycle
(apply → approve → disburse → repay → fully paid) under both interest
methods, fines/welfare/expenses recording and voiding, meeting attendance,
cash reconciliation, report generation and CSV export, backup export and
restore (including the confirmation warning), and the audit log capturing
each of the above. All financial data is held in IndexedDB, which works
without any network connection — the app was verified to keep functioning
with the device's network disconnected.

**Known limitations to be aware of:**
- This is delivered as a browser-based application (not a compiled
  `.exe`/`.apk`). It installs and behaves like a desktop/phone app once
  "Installed" via the browser's install prompt, and needs no internet at any
  point after files are copied onto the device.
- Opening `index.html` directly (double-click) works fully for a single
  device; running the included start script is what allows other phones on
  the same offline network to reach the same shared database.
- There is no automatic Kiswahili translation built in yet — the interface
  is currently in English, structured so translated labels could be added
  later.
