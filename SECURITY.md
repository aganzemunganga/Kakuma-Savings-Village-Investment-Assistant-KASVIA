# Security notes

## What is implemented

- **Passwords:** PBKDF2-SHA256, 120,000 iterations, random 16-byte salt per user, via the browser's Web Crypto API. Plain-text passwords are never stored. Minimum 8 characters with a letter and a number.
- **No default credentials.** The setup wizard makes the group create its own Administrator, Treasurer and Secretary accounts.
- **Role-based access control** for every action (see `PERMS` in `app/auth.js`).
- **Login protection:** 5 failed attempts lock the account for 5 minutes; inactivity logs the user out after 15 minutes.
- **Second Administrator sign-in** for sensitive actions (void, restore, close cycle, user changes).
- **Audit log** recording user, action, time, device string, record affected and previous/new values. There is no screen to edit or delete it.
- **Traceability:** financial entries are voided, not deleted.
- **Input validation** on forms (for example no negative amounts, no overpaying a loan without authorisation).
- **Offline by construction:** no network calls, so no data leaves the device unless the user exports a backup.

## What it does NOT protect against

Be clear about this when presenting:

- Data sits in the browser's IndexedDB. Someone with full access to the unlocked device and browser developer tools could alter records or the audit log. The audit log is *tamper-evident by design in the UI*, not cryptographically tamper-proof.
- Backup files are **plain JSON and not encrypted**.
- Clearing browser data erases the database; there is no automatic off-device copy.
- A shared device means shared risk: use a screen lock and keep the device with the Treasurer.

## Planned hardening

Encrypted backups (Web Crypto AES-GCM with a passphrase), hash-chained audit entries so any edit is detectable, optional database encryption at rest, scheduled backup reminders.

## Reporting a vulnerability

Open a private security advisory on the repository, or contact the maintainer listed in the README.
