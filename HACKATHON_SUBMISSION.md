# ReFuTech Hackathon 2026: KASVIA submission kit

## One-line pitch
KASVIA is a free, offline digital record book that lets village savings and loans groups in Kakuma keep accurate, traceable savings and loan records on a phone or laptop with no internet.

## Project description (copy/paste, ~150 words)
Village Savings and Loans (VSL) groups are one of the most important financial tools in refugee and host communities, but most still run on paper notebooks. Books get lost, interest is calculated by hand, and nobody can show who changed a figure, which causes disputes. Cloud tools do not help where internet is weak and data is expensive. KASVIA is an offline-first web app that stores everything on the device. It supports members, savings and shares, loans with configurable interest, repayments (cash or manually recorded M-Pesa), fines, a separate welfare fund, expenses, cash reconciliation, meetings, receipts and reports. Three roles (Administrator, Treasurer, Secretary) separate duties, passwords are hashed, sensitive actions need a second admin sign-in, records are voided rather than deleted, and every important action is logged. It installs like an app and needs no server.

## Links to fill in
- Repository: `https://github.com/YOUR-USERNAME/kasvia`
- Live demo (GitHub Pages): `https://YOUR-USERNAME.github.io/kasvia/`
- Pitch deck: `docs/pitch/KASVIA_Pitch.pptx`

## 3-minute pitch script
**0:00 Hook (20s).** "In Kakuma, thousands of people save together in VSL groups. Their entire financial history sits in one paper notebook. If it is lost, wet, or disputed, the savings are gone. KASVIA fixes that without needing internet."

**0:20 Problem (30s).** Paper books are a single point of failure; interest is calculated by hand; there is no audit trail; cloud tools fail with poor connectivity and expensive data.

**0:50 Live demo (80s).** Open the installed app in airplane mode. Log in as Treasurer, record a savings deposit, open the dashboard totals. Switch to Administrator, approve a loan (show the borrowing-limit check and the interest shown clearly), record an M-Pesa repayment and print the receipt. Show the audit log entry.

**2:10 Trust and design (30s).** Three roles with separation of duties; no default passwords; nothing is ever deleted, only voided with a reason; everything works offline and stays on the device.

**2:40 Honest limits and next steps (20s).** "Today it is one device per group with backup and restore. Next: Kiswahili, device-to-device sync, encrypted backups, and a pilot with a real Kakuma VSL group in January."

## Demo checklist (do this the day before)
1. Deploy to GitHub Pages and open the live link on your phone with internet.
2. Tap **Install** (or Add to Home Screen) on the phone and on the laptop.
3. Turn on airplane mode and confirm the app still opens and works.
4. Load demo data and rehearse the 80-second demo path above.
5. Replace `docs/screenshots/*.png` with real screenshots and update the deck if you wish.
6. Make a backup file and keep it on a USB stick in case the browser data is cleared.
7. Have a second browser profile ready as a fallback.

## Likely judge questions
- **How is this different from a spreadsheet?** Roles, audit trail, automatic interest and balances, receipts, and no formulas to break; works as an installed app on a phone.
- **What if the phone is lost?** Data is on the device; groups should make regular backups (backup reminders and encryption are on the roadmap). Today this is the main limitation.
- **Can several people use it at once?** Not live yet. Each device has its own database; the recommended model is one primary device per group, with backup/restore to move data. Sync is next on the roadmap.
- **Is M-Pesa integrated?** No. Users type the M-Pesa reference code manually, so it works offline. We do not claim an API integration.
- **How secure is it?** Salted PBKDF2 password hashing, role-based access, re-authentication for sensitive actions, audit log. It protects against mistakes and casual tampering, not a determined attacker with full device access (see `docs/SECURITY.md`).
- **How will it be sustained?** Open source (MIT), no hosting cost, so groups and partners can adopt it without a subscription.
- **What have you tested?** 10 automated tests on the core logic plus a manual pilot checklist; end-to-end browser tests are the next gap (see `docs/TEST_REPORT.md`).
- **Is it for refugees only?** No. It serves host and refugee communities, and collects refugee/host status only if a group chooses to.

## Impact and next 3 months
1. Pilot with one or two real VSL groups in Kakuma, with feedback from the Chairperson, Treasurer and Secretary.
2. Add Kiswahili and a simple in-app guide.
3. Ship encrypted backups and local sync.

## Publish to GitHub (first time)
```bash
cd kasvia
git init -b main
git add .
git commit -m "KASVIA: offline-first VSL management system"
git remote add origin https://github.com/YOUR-USERNAME/kasvia.git
git push -u origin main
```
Then on GitHub: **Settings → Pages → Source: GitHub Actions**. The `Deploy to GitHub Pages` workflow publishes the `app/` folder and gives you the HTTPS link. Replace every `YOUR-USERNAME` and `[YOUR NAME]` in `README.md`, `LICENSE` and this file.
