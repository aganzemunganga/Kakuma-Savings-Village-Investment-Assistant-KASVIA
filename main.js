/* ==========================================================================
   KASVIA — main.js
   Login, first-time setup wizard, dashboard, meetings, cash management,
   cycles, backup/restore, audit log, users, settings, and app bootstrap.
   ========================================================================== */

/* ---------------------------- LOGIN ---------------------------- */
function renderLogin(container) {
  container.innerHTML = `
    <div class="centerscreen">
      <div class="authcard">
        <div class="brand">
          <div class="brandmark">K</div>
          <div class="brandtext"><div class="k">KASVIA</div><div class="sub">Kakuma Savings &amp; Village Investment Assistant</div></div>
        </div>
        <div id="loginMsg"></div>
        <form id="loginForm" onsubmit="return false">
          <div class="field"><label>Username or registered phone number</label><input id="loginUser" autocomplete="username" required></div>
          <div class="field"><label>Password</label><input id="loginPass" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary btn-block" id="loginBtn" onclick="doLogin()">Log in</button>
        </form>
        <p class="hint center" style="text-align:center;margin-top:14px">Works fully offline. Your data stays on this device.</p>
      </div>
    </div>`;
  document.getElementById("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
}
async function doLogin() {
  const u = document.getElementById("loginUser").value;
  const p = document.getElementById("loginPass").value;
  const btn = document.getElementById("loginBtn");
  btn.disabled = true; btn.textContent = "Signing in…";
  const res = await attemptLogin(u, p);
  btn.disabled = false; btn.textContent = "Log in";
  if (!res.ok) {
    document.getElementById("loginMsg").innerHTML = `<div class="msg msg-error">${esc(res.error)}</div>`;
    return;
  }
  if (res.user.mustChangePassword) { Router.go("settings/mustchange"); return; }
  Router.go("dashboard");
}

/* ---------------------------- FIRST-TIME SETUP WIZARD ---------------------------- */
let wizardState = {
  step: 1, group: {}, savings: {}, loanSettings: {}, admin: {}, treasurer: {}, secretary: {}
};
function renderSetupWizard(container) {
  wizardState = { step: 1, group: {}, savings: {}, loanSettings: {}, admin: {}, treasurer: {}, secretary: {} };
  drawWizard(container);
}
function drawWizard(container) {
  const s = wizardState.step;
  const dots = Array.from({ length: 6 }, (_, i) => i + 1)
    .map(i => `<div class="dot ${i < s ? "done" : i === s ? "now" : ""}"></div>`).join("");
  container.innerHTML = `
    <div class="centerscreen">
      <div class="authcard" style="max-width:520px">
        <div class="brand"><div class="brandmark">K</div>
          <div class="brandtext"><div class="k">Welcome to KASVIA</div><div class="sub">First-time setup — Step ${s} of 6</div></div></div>
        <div class="wizard-steps">${dots}</div>
        <div id="wizardBody"></div>
      </div>
    </div>`;
  const body = document.getElementById("wizardBody");
  if (s === 1) return wizStep1(body);
  if (s === 2) return wizStep2(body);
  if (s === 3) return wizStep3(body);
  if (s === 4) return wizStep4(body, "admin", "Create Administrator account", "This account has full control of the system, including approvals and backups.");
  if (s === 5) return wizStep4(body, "treasurer", "Create Treasurer account", "Handles day-to-day savings, repayments, fines, welfare and expenses.");
  if (s === 6) return wizStep4(body, "secretary", "Create Secretary account", "Manages member registration, meetings and attendance.");
}
function wizStep1(body) {
  body.innerHTML = `
    <p class="hint">Enter your VSL group's profile. This appears on receipts and reports.</p>
    <div class="field"><label>VSL group name *</label><input id="w_name" value="${esc(wizardState.group.name || "")}" placeholder="e.g. Kakuma Umoja VSL Group"></div>
    <div class="field"><label>Location *</label><input id="w_location" value="${esc(wizardState.group.location || "")}" placeholder="e.g. Kakuma Camp, Turkana West"></div>
    <div class="field"><label>Currency</label><input value="Kenyan Shillings (KES / KSh)" disabled></div>
    <button class="btn btn-primary btn-block" onclick="wizNext1()">Continue</button>`;
}
function wizNext1() {
  const name = document.getElementById("w_name").value.trim();
  const location = document.getElementById("w_location").value.trim();
  if (!name) return toast("Please enter the VSL group name.", "err");
  wizardState.group = { name, location, currency: "KES" };
  wizardState.step = 2; drawWizard(document.getElementById("app"));
}
function wizStep2(body) {
  body.innerHTML = `
    <p class="hint">Configure savings and share rules. You can change these later in Settings.</p>
    <div class="formrow">
      <div class="field"><label>Minimum weekly savings (KSh)</label><input id="w_min" type="number" min="0" value="${wizardState.savings.minWeekly ?? 100}"></div>
      <div class="field"><label>Maximum weekly savings (KSh)</label><input id="w_max" type="number" min="0" value="${wizardState.savings.maxWeekly ?? ""}" placeholder="No limit"></div>
    </div>
    <div class="formrow">
      <div class="field"><label>Meeting frequency</label>
        <select id="w_freq"><option ${wizardState.savings.meetingFrequency === "Weekly" ? "selected" : ""}>Weekly</option><option ${wizardState.savings.meetingFrequency === "Bi-weekly" ? "selected" : ""}>Bi-weekly</option><option ${wizardState.savings.meetingFrequency === "Monthly" ? "selected" : ""}>Monthly</option></select></div>
      <div class="field"><label>Share value (1 share = KSh)</label><input id="w_share" type="number" min="1" value="${wizardState.savings.shareValue ?? 100}"></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="wizNext2()">Continue</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="wizardState.step=1;drawWizard(document.getElementById('app'))">Back</button>`;
}
function wizNext2() {
  wizardState.savings = {
    minWeekly: Number(document.getElementById("w_min").value || 0),
    maxWeekly: document.getElementById("w_max").value ? Number(document.getElementById("w_max").value) : "",
    meetingFrequency: document.getElementById("w_freq").value,
    shareValue: Number(document.getElementById("w_share").value || 100),
    cycle: ""
  };
  wizardState.step = 3; drawWizard(document.getElementById("app"));
}
function wizStep3(body) {
  body.innerHTML = `
    <p class="hint">Configure loan interest rules. The method will be clearly shown wherever loans are calculated.</p>
    <div class="formrow">
      <div class="field"><label>Interest rate (%)</label><input id="w_rate" type="number" min="0" step="0.1" value="${wizardState.loanSettings.interestRate ?? 10}"></div>
      <div class="field"><label>Interest method</label>
        <select id="w_method"><option ${wizardState.loanSettings.interestMethod === "Flat interest" ? "selected" : ""}>Flat interest</option><option ${wizardState.loanSettings.interestMethod === "Declining balance" ? "selected" : ""}>Declining balance</option></select></div>
    </div>
    <div class="formrow">
      <div class="field"><label>Default loan duration (months)</label><input id="w_dur" type="number" min="1" value="${wizardState.loanSettings.defaultDurationMonths ?? 3}"></div>
      <div class="field"><label>Max loan = savings ×</label><input id="w_mult" type="number" min="1" value="${wizardState.loanSettings.maxLoanMultiplier ?? 3}"></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="wizNext3()">Continue</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="wizardState.step=2;drawWizard(document.getElementById('app'))">Back</button>`;
}
function wizNext3() {
  wizardState.loanSettings = {
    interestRate: Number(document.getElementById("w_rate").value || 0),
    interestMethod: document.getElementById("w_method").value,
    defaultDurationMonths: Number(document.getElementById("w_dur").value || 3),
    maxLoanMultiplier: Number(document.getElementById("w_mult").value || 3)
  };
  wizardState.step = 4; drawWizard(document.getElementById("app"));
}
function wizStep4(body, key, title, blurb) {
  const v = wizardState[key];
  body.innerHTML = `
    <p class="hint">${esc(blurb)}</p>
    <div class="field"><label>Full name *</label><input id="w_uname" value="${esc(v.username || "")}"></div>
    <div class="field"><label>Username or phone number *</label><input id="w_ulogin" value="${esc(v.phone || "")}" placeholder="e.g. +254 7XX XXX XXX"></div>
    <div class="field"><label>Create secure password *</label><input id="w_upass" type="password"></div>
    <div class="field"><label>Confirm password *</label><input id="w_upass2" type="password"></div>
    <div class="hint">Minimum 8 characters, with at least one letter and one number. No default or publicly known passwords are created — you set this now.</div>
    <div id="wizErr"></div>
    <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="wizNext4('${key}')">${key === "secretary" ? "Finish setup" : "Continue"}</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="wizardState.step--;drawWizard(document.getElementById('app'))">Back</button>`;
}
async function wizNext4(key) {
  const uname = document.getElementById("w_uname").value.trim();
  const ulogin = document.getElementById("w_ulogin").value.trim();
  const pass = document.getElementById("w_upass").value;
  const pass2 = document.getElementById("w_upass2").value;
  const errEl = document.getElementById("wizErr");
  errEl.innerHTML = "";
  if (!uname || !ulogin) { errEl.innerHTML = `<div class="msg msg-error">Name and username/phone are required.</div>`; return; }
  if (!passwordStrengthOk(pass)) { errEl.innerHTML = `<div class="msg msg-error">Password must be at least 8 characters with a letter and a number.</div>`; return; }
  if (pass !== pass2) { errEl.innerHTML = `<div class="msg msg-error">Passwords do not match.</div>`; return; }
  wizardState[key] = { username: uname, phone: ulogin, password: pass };
  if (key === "secretary") return finishWizard();
  wizardState.step++;
  drawWizard(document.getElementById("app"));
}
async function finishWizard() {
  await DB.init();
  await DB.setSetting("groupProfile", wizardState.group);
  await DB.setSetting("savingsSettings", wizardState.savings);
  await DB.setSetting("loanSettings", wizardState.loanSettings);
  await DB.setSetting("counters", {});

  const roleMap = [["admin", ROLES.ADMIN], ["treasurer", ROLES.TREASURER], ["secretary", ROLES.SECRETARY]];
  for (const [key, role] of roleMap) {
    const v = wizardState[key];
    const { hash, salt } = await hashPassword(v.password);
    await DB.put("users", {
      id: uid(), username: v.username, phone: v.phone, role, passwordHash: hash, salt,
      active: true, mustChangePassword: false, createdAt: nowISO()
    });
  }
  const cycleId = uid();
  await DB.put("cycles", { id: cycleId, startDate: todayISO(), endDate: "", status: "Open", createdAt: nowISO() });
  await DB.setSetting("currentCycleId", cycleId);
  await audit("Completed first-time setup", wizardState.group.name);
  toast("Setup complete! You can now log in.");
  Router.go("login");
  setTimeout(() => Router.render(), 50);
}

/* ---------------------------- DASHBOARD ---------------------------- */
async function pageDashboard(el) {
  const [members, savings, loans, repayments, fines, welfare, expenses, meetings] = await Promise.all(
    ["members", "savings", "loans", "repayments", "fines", "welfare", "expenses", "meetings"].map(s => DB.all(s))
  );
  const today = todayISO();
  const activeSavings = savings.filter(s => !s.voided);
  const activeFines = fines.filter(f => !f.voided);
  const activeWelfare = welfare.filter(w => !w.voided);
  const activeExpenses = expenses.filter(e => !e.voided);

  const sumToday = (arr, dk = "date") => arr.filter(x => x[dk] === today).reduce((s, x) => s + Number(x.amount ?? x.amountPaid ?? 0), 0);
  const todaysSavings = sumToday(activeSavings);
  const todaysRepayments = sumToday(repayments);
  const todaysLoans = loans.filter(l => l.disbursedDate === today).reduce((s, l) => s + Number(l.amount || 0), 0);
  const todaysExpenses = sumToday(activeExpenses);
  const todaysFines = sumToday(activeFines);
  const todaysWelfare = sumToday(activeWelfare.filter(w => w.type === "Contribution"));

  const totalSavings = activeSavings.reduce((s, x) => s + Number(x.amount || 0), 0);
  const outstandingLoans = loans.filter(l => ["Active", "Disbursed"].includes(l.status)).reduce((s, l) => s + Number(l.balance || 0), 0);
  const interestCollected = repayments.reduce((s, r) => s + Number(r.interestPortion || 0), 0);
  const welfareBalance = activeWelfare.filter(w => w.type === "Contribution").reduce((s, w) => s + Number(w.amount || 0), 0)
    - activeWelfare.filter(w => w.type === "Payment").reduce((s, w) => s + Number(w.amount || 0), 0);
  const totalExpenses = activeExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const loanDisbursedTotal = loans.filter(l => l.disbursedDate).reduce((s, l) => s + Number(l.amount || 0), 0);
  const expectedCash = totalSavings + repayments.reduce((s, r) => s + Number(r.amountPaid || 0), 0) + activeFines.reduce((s, f) => s + Number(f.amount || 0), 0)
    + activeWelfare.filter(w => w.type === "Contribution").reduce((s, w) => s + Number(w.amount || 0), 0)
    - loanDisbursedTotal - totalExpenses - activeWelfare.filter(w => w.type === "Payment").reduce((s, w) => s + Number(w.amount || 0), 0);

  const activeLoansCount = loans.filter(l => ["Active", "Disbursed"].includes(l.status)).length;
  const paidLoansCount = loans.filter(l => l.status === "Fully Paid").length;
  const overdueCount = loans.filter(l => l.status === "Defaulted").length;

  const alerts = (await DB.all("alerts")).filter(a => !a.acknowledged).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  el.innerHTML = `
    ${members.length === 0 && requireRole(ROLES.ADMIN) ? `
      <div class="card" style="margin-bottom:18px;background:var(--forest-tint);border-color:var(--forest)">
        <b>Get started</b>
        <p class="small" style="margin:6px 0">Your VSL group has no members yet. Register your first member, or load fictional demo data to explore KASVIA before entering real records.</p>
        <button class="btn btn-primary btn-sm" onclick="Router.go('members')">Register first member</button>
        <button class="btn btn-ghost btn-sm" onclick="loadDemoData()">Load demo data</button>
      </div>` : ""}
    ${alerts.length && requireRole(ROLES.ADMIN) ? `
      <div class="card" style="margin-bottom:18px;border-color:var(--clay)">
        <b style="color:var(--clay)">Security &amp; system alerts</b>
        <ul style="margin:8px 0 0;padding-left:18px">${alerts.map(a => `<li class="small">${esc(a.message)} <span class="muted">— ${fmtDateTime(a.date)}</span></li>`).join("")}</ul>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="Router.go('audit')">View audit log</button>
      </div>` : ""}

    <div class="section-title"><h3>Today's summary</h3></div>
    <div class="grid grid-4">
      ${statCard("Today's savings", formatKES(todaysSavings))}
      ${statCard("Today's repayments", formatKES(todaysRepayments))}
      ${statCard("Today's loans issued", formatKES(todaysLoans), { cls: "gold" })}
      ${statCard("Today's expenses", formatKES(todaysExpenses), { cls: "clay" })}
      ${statCard("Today's fines", formatKES(todaysFines))}
      ${statCard("Today's welfare", formatKES(todaysWelfare))}
    </div>

    <div class="section-title"><h3>Group summary</h3></div>
    <div class="grid grid-4">
      ${statCard("Total members", members.filter(m => m.membershipStatus !== "Deactivated").length)}
      ${statCard("Total savings", formatKES(totalSavings))}
      ${statCard("Outstanding loans", formatKES(outstandingLoans), { cls: "clay" })}
      ${statCard("Interest collected", formatKES(interestCollected), { cls: "gold" })}
      ${statCard("Welfare fund balance", formatKES(welfareBalance))}
      ${statCard("Total expenses", formatKES(totalExpenses))}
      ${statCard("Expected cash balance", formatKES(expectedCash), { cls: "gold" })}
      ${statCard("Meetings held", meetings.length)}
    </div>

    <div class="section-title"><h3>Loan summary</h3></div>
    <div class="grid grid-4">
      ${statCard("Active loans", activeLoansCount)}
      ${statCard("Fully paid loans", paidLoansCount)}
      ${statCard("Defaulted loans", overdueCount, { cls: overdueCount ? "clay" : "" })}
      ${statCard("Total outstanding", formatKES(outstandingLoans), { cls: "clay" })}
    </div>
    <div style="margin-top:20px" class="small muted">KASVIA — 100% offline. All data is stored securely on this device.</div>
  `;
}

/* ---------------------------- MEETINGS ---------------------------- */
async function pageMeetings(el) {
  const meetings = (await DB.all("meetings")).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  el.innerHTML = `
    <div class="toolbar"><div class="spacer"></div>
      ${can("meetings_record") ? `<button class="btn btn-primary" onclick="openMeetingForm()">+ New meeting</button>` : ""}
    </div>
    ${renderTable({
      columns: [
        { key: "id", label: "Meeting" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
        { key: "location", label: "Location" },
        { key: "present", label: "Present", render: r => (r.present || []).length },
        { key: "absent", label: "Absent", render: r => (r.absent || []).length },
      ], rows: meetings, rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="openMeetingDetail('${r.id}')">View</button>`,
      emptyText: "No meetings recorded yet."
    })}
  `;
}
async function openMeetingForm() {
  if (!can("meetings_record")) return toast("You do not have permission to record meetings.", "err");
  const members = await activeMembers();
  openModal({
    title: "New meeting", wide: true,
    bodyHTML: `
      <div class="formrow">
        <div class="field"><label>Date *</label><input id="mt_date" type="date" value="${todayISO()}"></div>
        <div class="field"><label>Location</label><input id="mt_loc" placeholder="e.g. Community hall, Block 5"></div>
      </div>
      <div class="section-title"><h3>Attendance register</h3></div>
      <div class="tablewrap" style="max-height:260px;overflow-y:auto">
        <table><thead><tr><th>Member</th><th class="center">Present</th></tr></thead><tbody>
        ${members.map(m => `<tr><td>${esc(m.fullName)} <span class="muted small">(${m.id})</span></td><td class="center"><input type="checkbox" class="mt_att" value="${m.id}" checked></td></tr>`).join("")}
        </tbody></table>
      </div>
      <div class="field" style="margin-top:12px"><label>Secretary's remarks / meeting notes</label><textarea id="mt_notes" rows="3"></textarea></div>
    `,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="saveMeeting()">Save meeting</button>`
  });
}
async function saveMeeting() {
  const date = document.getElementById("mt_date").value;
  if (!date) return toast("Date is required.", "err");
  const location = document.getElementById("mt_loc").value;
  const notes = document.getElementById("mt_notes").value;
  const boxes = Array.from(document.querySelectorAll(".mt_att"));
  const present = boxes.filter(b => b.checked).map(b => b.value);
  const allIds = boxes.map(b => b.value);
  const absent = allIds.filter(id => !present.includes(id));
  const id = await genMeetingId();
  const rec = { id, date, location, present, absent, notes, secretaryRemarks: notes, recordedBy: Session.current.username, createdAt: nowISO() };
  await DB.put("meetings", rec);
  await audit("Recorded meeting", id, null, rec);
  toast(`Meeting ${id} recorded — ${present.length} present, ${absent.length} absent.`);
  closeModal(); Router.render();
}
async function openMeetingDetail(id) {
  const m = await DB.get("meetings", id);
  const members = await DB.all("members");
  const nameOf = mid => (members.find(x => x.id === mid) || {}).fullName || mid;
  openModal({
    title: `Meeting ${id} — ${fmtDate(m.date)}`, wide: true,
    bodyHTML: `
      <p><b>Location:</b> ${esc(m.location || "—")}</p>
      <div class="grid grid-2">
        <div><b>Present (${m.present.length})</b><ul>${m.present.map(p => `<li class="small">${esc(nameOf(p))}</li>`).join("")}</ul></div>
        <div><b>Absent (${m.absent.length})</b><ul>${m.absent.map(p => `<li class="small">${esc(nameOf(p))}</li>`).join("")}</ul></div>
      </div>
      <p><b>Notes:</b> ${esc(m.notes || "—")}</p>
    `,
    footHTML: `<button class="btn btn-ghost" onclick="window.print()">Print</button><button class="btn btn-primary" onclick="closeModal()">Close</button>`
  });
}

/* ---------------------------- CASH MANAGEMENT ---------------------------- */
async function pageCash(el) {
  const [savings, repayments, loans, fines, welfare, expenses] = await Promise.all(
    ["savings", "repayments", "loans", "fines", "welfare", "expenses"].map(s => DB.all(s))
  );
  const activeSavings = savings.filter(s => !s.voided);
  const activeFines = fines.filter(f => !f.voided);
  const activeWelfare = welfare.filter(w => !w.voided);
  const activeExpenses = expenses.filter(e => !e.voided);
  const savingsIn = activeSavings.reduce((s, x) => s + Number(x.amount || 0), 0);
  const repayIn = repayments.reduce((s, x) => s + Number(x.amountPaid || 0), 0);
  const finesIn = activeFines.reduce((s, x) => s + Number(x.amount || 0), 0);
  const welfareIn = activeWelfare.filter(w => w.type === "Contribution").reduce((s, x) => s + Number(x.amount || 0), 0);
  const welfareOut = activeWelfare.filter(w => w.type === "Payment").reduce((s, x) => s + Number(x.amount || 0), 0);
  const loansOut = loans.filter(l => l.disbursedDate).reduce((s, x) => s + Number(x.amount || 0), 0);
  const expensesOut = activeExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const expected = savingsIn + repayIn + finesIn + welfareIn - loansOut - expensesOut - welfareOut;

  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <h3>Cash flow summary</h3>
      ${renderTable({
        columns: [{ key: "item", label: "Item" }, { key: "amount", label: "Amount", right: true }],
        rows: [
          { item: "Opening balance (cycle)", amount: formatKES(0) },
          { item: "+ Savings collected", amount: formatKES(savingsIn) },
          { item: "+ Loan repayments", amount: formatKES(repayIn) },
          { item: "+ Fines collected", amount: formatKES(finesIn) },
          { item: "+ Welfare contributions", amount: formatKES(welfareIn) },
          { item: "− Loan disbursements", amount: formatKES(-loansOut) },
          { item: "− Group expenses", amount: formatKES(-expensesOut) },
          { item: "− Welfare payments", amount: formatKES(-welfareOut) },
        ], emptyText: ""
      })}
    </div>
    <div class="grid grid-2">
      ${statCard("Expected cash balance", formatKES(expected), { cls: "gold" })}
      <div class="card">
        <div class="label" style="font-size:.74rem;text-transform:uppercase;color:var(--ink-soft);font-weight:700">Reconcile with physical cash count</div>
        <div class="field" style="margin-top:8px"><input id="physicalCash" type="number" step="0.01" placeholder="Enter counted physical cash (KSh)"></div>
        <button class="btn btn-primary btn-sm" onclick="reconcileCash(${expected})">Compare</button>
        <div id="reconcileResult" style="margin-top:10px"></div>
      </div>
    </div>
  `;
}
function reconcileCash(expected) {
  const val = Number(document.getElementById("physicalCash").value || 0);
  const diff = Math.round((val - expected) * 100) / 100;
  const out = document.getElementById("reconcileResult");
  if (Math.abs(diff) < 0.01) out.innerHTML = `<div class="msg msg-ok">✓ Matches expected balance.</div>`;
  else out.innerHTML = `<div class="msg msg-error">⚠ Discrepancy of ${formatKES(Math.abs(diff))} (${diff > 0 ? "surplus" : "shortfall"}). Please investigate before closing the cycle.</div>`;
}

/* ---------------------------- VSL CYCLES ---------------------------- */
async function pageCycles(el) {
  const cycles = (await DB.all("cycles")).sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  const currentId = await DB.getSetting("currentCycleId");
  el.innerHTML = `
    <div class="toolbar"><div class="spacer"></div>
      ${can("cycles_manage") ? `<button class="btn btn-primary" onclick="openNewCycleForm()">+ Start new cycle</button>` : ""}
    </div>
    ${renderTable({
      columns: [
        { key: "id", label: "Cycle" }, { key: "startDate", label: "Start", render: r => fmtDate(r.startDate) },
        { key: "endDate", label: "End", render: r => r.endDate ? fmtDate(r.endDate) : "—" },
        { key: "status", label: "Status", render: r => r.id === currentId ? statusBadge("Active") : (r.status === "Closed" ? statusBadge("Voided") : statusBadge("Pending")) },
      ], rows: cycles,
      rowActions: r => r.id === currentId && can("cycles_manage") ? `<button class="btn btn-danger btn-sm" onclick="closeCycle('${r.id}')">Close cycle</button>` : `<button class="btn btn-ghost btn-sm" onclick="Router.go('reports')">Report</button>`,
      emptyText: "No cycles yet."
    })}
  `;
}
function openNewCycleForm() {
  if (!can("cycles_manage")) return toast("Only Administrators can manage cycles.", "err");
  openModal({
    title: "Start new VSL cycle",
    bodyHTML: `<div class="msg msg-info">Starting a new cycle will close the current one. Approved balances are carried forward automatically.</div>
      <div class="field"><label>Start date *</label><input id="cy_start" type="date" value="${todayISO()}"></div>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="startNewCycle()">Start cycle</button>`
  });
}
async function startNewCycle() {
  requireAdminAuth("Start a new VSL cycle", async (admin) => {
    const startDate = document.getElementById("cy_start")?.value || todayISO();
    const currentId = await DB.getSetting("currentCycleId");
    if (currentId) {
      const cur = await DB.get("cycles", currentId);
      cur.status = "Closed"; cur.endDate = startDate; cur.closedBy = admin.username;
      await DB.put("cycles", cur);
    }
    const id = uid();
    await DB.put("cycles", { id, startDate, endDate: "", status: "Open", createdAt: nowISO() });
    await DB.setSetting("currentCycleId", id);
    await audit("Started new VSL cycle", id);
    toast("New cycle started.");
    closeModal(); Router.render();
  });
}
async function closeCycle(id) {
  if (!can("cycles_manage")) return toast("Only Administrators can close a cycle.", "err");
  requireAdminAuth(`Close VSL cycle ${id}`, async (admin) => {
    const cycle = await DB.get("cycles", id);
    const before = { ...cycle };
    cycle.status = "Closed"; cycle.endDate = todayISO(); cycle.closedBy = admin.username;
    await DB.put("cycles", cycle);
    await audit("Closed VSL cycle", id, before, cycle);
    toast(`Cycle ${id} closed. Any further correction requires authorization and is logged.`);
    Router.render();
  });
}

/* ---------------------------- BACKUP & RESTORE ---------------------------- */
async function pageBackup(el) {
  const profile = await DB.getSetting("groupProfile", {});
  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <h3>Create backup</h3>
        <p class="small muted">Exports all members, savings, shares, loans, repayments, fines, welfare, expenses, meetings, users/settings and audit records into one JSON backup file. The file is not encrypted, so keep it somewhere safe (for example a USB drive kept by the Chairperson).</p>
        ${can("backup_create") ? `<button class="btn btn-primary" onclick="createBackup()">Download backup (.kasvia.json)</button>` : `<p class="msg msg-info">Only Administrators can create backups.</p>`}
      </div>
      <div class="card">
        <h3>Restore backup</h3>
        <p class="small msg msg-error">Restoring a backup will replace the current local database. This cannot be undone.</p>
        ${can("backup_restore") ? `
          <input type="file" id="restoreFile" accept=".json,application/json">
          <button class="btn btn-danger" style="margin-top:10px" onclick="restoreBackupPrompt()">Restore from file</button>
        ` : `<p class="msg msg-info">Only Administrators can restore backups.</p>`}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Export records</h3>
      <p class="small muted">Export individual data sets as CSV for use in Excel or other spreadsheet software.</p>
      <div class="pillfilter">
        ${["members", "savings", "loans", "repayments", "fines", "welfare", "expenses"].map(s => `<button onclick="quickExportCSV('${s}')">${s}</button>`).join("")}
      </div>
    </div>
  `;
}
async function createBackup() {
  if (!can("backup_create")) return toast("Only Administrators can create backups.", "err");
  const dump = await DB.exportAll();
  const profile = await DB.getSetting("groupProfile", {});
  downloadFile(`${(profile.name || "kasvia").replace(/\s+/g, "_")}_backup_${todayISO()}.kasvia.json`, JSON.stringify(dump, null, 2), "application/json");
  await audit("Created backup");
  toast("Backup downloaded.");
}
function restoreBackupPrompt() {
  const file = document.getElementById("restoreFile").files[0];
  if (!file) return toast("Please choose a backup file first.", "err");
  confirmAction("Restoring this backup will replace the current local database. Continue?", async () => {
    const text = await file.text();
    try {
      const dump = JSON.parse(text);
      await DB.importAll(dump);
      await audit("Restored backup from file: " + file.name);
      toast("Backup restored successfully. Reloading…");
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      toast("Could not read backup file: " + e.message, "err");
    }
  }, { danger: true, confirmLabel: "Yes, restore and replace" });
}
async function quickExportCSV(store) {
  const rows = await DB.all(store);
  if (!rows.length) return toast("No records to export.", "err");
  const cols = Object.keys(rows[0]).filter(k => k !== "createdAt").map(k => ({ label: k, get: r => r[k] }));
  downloadFile(`kasvia_${store}_${todayISO()}.csv`, toCSV(rows, cols), "text/csv");
}

/* ---------------------------- AUDIT LOG ---------------------------- */
async function pageAudit(el) {
  if (!can("audit_view")) { el.innerHTML = `<div class="msg msg-error">Only Administrators can view the audit log.</div>`; return; }
  const logs = (await DB.all("auditLogs")).sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = `
    <div class="toolbar"><input id="auditSearch" placeholder="Filter by user or action…" style="padding:9px 12px;border:1px solid var(--line);border-radius:8px;min-width:260px" oninput="filterAudit(this.value)"></div>
    <div id="auditWrap"></div>`;
  window.__auditLogs = logs;
  renderAuditTable(logs);
}
function renderAuditTable(rows) {
  document.getElementById("auditWrap").innerHTML = renderTable({
    columns: [
      { key: "date", label: "Date/time", render: r => fmtDateTime(r.date) },
      { key: "user", label: "User" }, { key: "action", label: "Action" },
      { key: "recordAffected", label: "Record" },
    ], rows: rows.slice(0, 300), emptyText: "No audit entries yet."
  });
}
function filterAudit(q) {
  q = q.trim().toLowerCase();
  const filtered = !q ? window.__auditLogs : window.__auditLogs.filter(l => (l.user || "").toLowerCase().includes(q) || (l.action || "").toLowerCase().includes(q) || (l.recordAffected || "").toLowerCase().includes(q));
  renderAuditTable(filtered);
}

/* ---------------------------- USERS ---------------------------- */
async function pageUsers(el) {
  if (!can("users_manage")) { el.innerHTML = `<div class="msg msg-error">Only Administrators can manage users.</div>`; return; }
  const users = await DB.all("users");
  el.innerHTML = `
    <div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" onclick="openUserForm()">+ Create user</button></div>
    ${renderTable({
      columns: [
        { key: "username", label: "Name" }, { key: "phone", label: "Username/phone" }, { key: "role", label: "Role" },
        { key: "active", label: "Status", render: r => r.active ? statusBadge("Active") : statusBadge("Voided") },
      ], rows: users,
      rowActions: r => `
        <button class="btn btn-ghost btn-sm" onclick="resetUserPassword('${r.id}')">Reset password</button>
        ${r.active ? `<button class="btn btn-danger btn-sm" onclick="toggleUserActive('${r.id}',false)">Disable</button>` : `<button class="btn btn-ghost btn-sm" onclick="toggleUserActive('${r.id}',true)">Enable</button>`}
      `,
      emptyText: "No users found."
    })}
  `;
}
function openUserForm() {
  openModal({
    title: "Create user account",
    bodyHTML: `
      <div class="field"><label>Full name *</label><input id="u_name"></div>
      <div class="field"><label>Username or phone *</label><input id="u_login"></div>
      <div class="field"><label>Role *</label><select id="u_role"><option>${ROLES.ADMIN}</option><option>${ROLES.TREASURER}</option><option>${ROLES.SECRETARY}</option></select></div>
      <div class="field"><label>Temporary password *</label><input id="u_pass" type="password"></div>
      <div class="hint">User will be required to change this password on first login.</div>
    `,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createUser()">Create user</button>`
  });
}
async function createUser() {
  const username = document.getElementById("u_name").value.trim();
  const login = document.getElementById("u_login").value.trim();
  const role = document.getElementById("u_role").value;
  const pass = document.getElementById("u_pass").value;
  if (!username || !login) return toast("Name and username/phone are required.", "err");
  if (!passwordStrengthOk(pass)) return toast("Password must be 8+ characters with a letter and number.", "err");
  requireAdminAuth("Create new user account", async () => {
    const { hash, salt } = await hashPassword(pass);
    const rec = { id: uid(), username, phone: login, role, passwordHash: hash, salt, active: true, mustChangePassword: true, createdAt: nowISO() };
    await DB.put("users", rec);
    await audit("Created user", username, null, { username, role });
    toast(`User ${username} (${role}) created.`);
    closeModal(); Router.render();
  });
}
async function toggleUserActive(id, active) {
  requireAdminAuth((active ? "Enable" : "Disable") + " user account", async () => {
    const u = await DB.get("users", id);
    const before = { ...u };
    u.active = active;
    await DB.put("users", u);
    await audit((active ? "Enabled" : "Disabled") + " user", u.username, before, u);
    toast(`User ${u.username} ${active ? "enabled" : "disabled"}.`);
    Router.render();
  });
}
function resetUserPassword(id) {
  openModal({
    title: "Reset password",
    bodyHTML: `<div class="field"><label>New password *</label><input id="rp_pass" type="password"></div>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="doResetPassword('${id}')">Reset</button>`
  });
}
async function doResetPassword(id) {
  const pass = document.getElementById("rp_pass").value;
  if (!passwordStrengthOk(pass)) return toast("Password must be 8+ characters with a letter and number.", "err");
  requireAdminAuth("Reset user password", async () => {
    const u = await DB.get("users", id);
    const { hash, salt } = await hashPassword(pass);
    u.passwordHash = hash; u.salt = salt; u.mustChangePassword = true;
    await DB.put("users", u);
    await audit("Reset password for user", u.username);
    toast(`Password reset for ${u.username}.`);
    closeModal(); Router.render();
  });
}

/* ---------------------------- SETTINGS ---------------------------- */
async function pageSettings(el, params, fullSeg) {
  if (!can("settings_manage") && fullSeg !== "settings/mustchange") { el.innerHTML = `<div class="msg msg-error">Only Administrators can change system settings.</div>`; return; }
  const group = await DB.getSetting("groupProfile", {});
  const savingsSettings = await DB.getSetting("savingsSettings", {});
  const loanSettings = await DB.getSetting("loanSettings", {});
  const mustChange = fullSeg === "settings/mustchange";

  el.innerHTML = `
    ${mustChange ? `<div class="msg msg-info">Please change your password before continuing.</div>` : ""}
    <div class="card" style="margin-bottom:16px">
      <h3>Change my password</h3>
      <div class="formrow">
        <div class="field"><label>Current password</label><input id="cp_old" type="password"></div>
        <div class="field"><label>New password</label><input id="cp_new" type="password"></div>
      </div>
      <button class="btn btn-primary" onclick="changeMyPassword()">Update password</button>
    </div>
    ${!mustChange ? `
    <div class="card" style="margin-bottom:16px">
      <h3>Group profile</h3>
      <div class="formrow">
        <div class="field"><label>Group name</label><input id="s_name" value="${esc(group.name || "")}"></div>
        <div class="field"><label>Location</label><input id="s_loc" value="${esc(group.location || "")}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveGroupProfile()">Save profile</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h3>Savings &amp; share settings</h3>
      <div class="formrow">
        <div class="field"><label>Minimum weekly savings</label><input id="s_min" type="number" value="${savingsSettings.minWeekly ?? 0}"></div>
        <div class="field"><label>Maximum weekly savings</label><input id="s_max" type="number" value="${savingsSettings.maxWeekly ?? ""}"></div>
      </div>
      <div class="formrow">
        <div class="field"><label>Meeting frequency</label><select id="s_freq"><option ${savingsSettings.meetingFrequency==="Weekly"?"selected":""}>Weekly</option><option ${savingsSettings.meetingFrequency==="Bi-weekly"?"selected":""}>Bi-weekly</option><option ${savingsSettings.meetingFrequency==="Monthly"?"selected":""}>Monthly</option></select></div>
        <div class="field"><label>Share value (KSh)</label><input id="s_share" type="number" value="${savingsSettings.shareValue ?? 100}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveSavingsSettings()">Save savings settings</button>
    </div>
    <div class="card">
      <h3>Loan &amp; interest settings</h3>
      <div class="formrow">
        <div class="field"><label>Interest rate (%)</label><input id="s_rate" type="number" step="0.1" value="${loanSettings.interestRate ?? 10}"></div>
        <div class="field"><label>Interest method</label><select id="s_method"><option ${loanSettings.interestMethod==="Flat interest"?"selected":""}>Flat interest</option><option ${loanSettings.interestMethod==="Declining balance"?"selected":""}>Declining balance</option></select></div>
      </div>
      <div class="formrow">
        <div class="field"><label>Default duration (months)</label><input id="s_dur" type="number" value="${loanSettings.defaultDurationMonths ?? 3}"></div>
        <div class="field"><label>Max loan = savings ×</label><input id="s_mult" type="number" value="${loanSettings.maxLoanMultiplier ?? 3}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveLoanSettings()">Save loan settings</button>
    </div>
    ` : ""}
  `;
}
async function changeMyPassword() {
  const oldPass = document.getElementById("cp_old").value;
  const newPass = document.getElementById("cp_new").value;
  const ok = await verifyPassword(oldPass, Session.current.passwordHash, Session.current.salt);
  if (!ok) return toast("Current password is incorrect.", "err");
  if (!passwordStrengthOk(newPass)) return toast("New password must be 8+ characters with a letter and number.", "err");
  const { hash, salt } = await hashPassword(newPass);
  Session.current.passwordHash = hash; Session.current.salt = salt; Session.current.mustChangePassword = false;
  await DB.put("users", Session.current);
  await audit("Changed own password", Session.current.username);
  toast("Password updated.");
  Router.go("dashboard");
}
async function saveGroupProfile() {
  const group = { name: document.getElementById("s_name").value.trim(), location: document.getElementById("s_loc").value.trim(), currency: "KES" };
  await DB.setSetting("groupProfile", group);
  await audit("Updated group profile");
  toast("Group profile saved.");
  Router.render();
}
async function saveSavingsSettings() {
  const s = {
    minWeekly: Number(document.getElementById("s_min").value || 0),
    maxWeekly: document.getElementById("s_max").value ? Number(document.getElementById("s_max").value) : "",
    meetingFrequency: document.getElementById("s_freq").value,
    shareValue: Number(document.getElementById("s_share").value || 100)
  };
  await DB.setSetting("savingsSettings", s);
  await audit("Updated savings settings");
  toast("Savings settings saved.");
}
async function saveLoanSettings() {
  const s = {
    interestRate: Number(document.getElementById("s_rate").value || 0),
    interestMethod: document.getElementById("s_method").value,
    defaultDurationMonths: Number(document.getElementById("s_dur").value || 3),
    maxLoanMultiplier: Number(document.getElementById("s_mult").value || 3)
  };
  await DB.setSetting("loanSettings", s);
  await audit("Updated loan settings");
  toast("Loan settings saved.");
}

/* ---------------------------- DEMO DATA ---------------------------- */
async function loadDemoData() {
  const names = [["Amina Hassan", "Female"], ["John Otieno", "Male"], ["Mary Nyokabi", "Female"], ["Peter Lomuria", "Male"], ["Grace Akello", "Female"]];
  const memberIds = [];
  for (const [name, gender] of names) {
    const id = await genMemberId();
    const rec = { id, fullName: name, gender, phone: "07" + Math.floor(10000000 + Math.random() * 89999999), dateJoined: todayISO(), community: "Kakuma", membershipStatus: "Active", createdAt: nowISO(), createdBy: "Demo" };
    await DB.put("members", rec); memberIds.push(id);
  }
  for (const mid of memberIds) {
    for (let i = 0; i < 3; i++) {
      const id = await genTxnId();
      await DB.put("savings", { id, memberId: mid, memberName: names[memberIds.indexOf(mid)][0], type: "Regular savings", amount: 200 + Math.round(Math.random() * 300), date: todayISO(), recordedBy: "Demo", voided: false, createdAt: nowISO() });
    }
  }
  const settings = await DB.getSetting("loanSettings", { interestRate: 10, interestMethod: "Flat interest" });
  const { interest, total } = calcLoanInterest(5000, settings.interestRate, settings.interestMethod, 3);
  const loanId = await genLoanId();
  await DB.put("loans", {
    id: loanId, memberId: memberIds[0], memberName: names[0][0], applicationDate: todayISO(), amount: 5000,
    purpose: "Small business stock (demo)", repaymentPeriod: 3, status: "Active", interestRate: settings.interestRate,
    interestMethod: settings.interestMethod, interestAmount: interest, totalRepayable: total, balance: total, disbursedDate: todayISO(), createdAt: nowISO()
  });
  await audit("Loaded demo data");
  toast("Demo data loaded — feel free to explore.");
  Router.go("dashboard");
}

/* ---------------------------- PAGE REGISTRY ---------------------------- */
const PAGES = {
  dashboard: pageDashboard,
  members: pageMembers,
  savings: pageSavings,
  loans: pageLoans,
  repayments: pageRepayments,
  fines: pageFines,
  welfare: pageWelfare,
  expenses: pageExpenses,
  meetings: pageMeetings,
  cash: pageCash,
  reports: pageReports,
  cycles: pageCycles,
  backup: pageBackup,
  audit: pageAudit,
  users: pageUsers,
  settings: pageSettings,
  search: pageSearch,
};

/* ---------------------------- BOOTSTRAP ---------------------------- */
(async function boot() {
  await DB.init();
  await tryResumeSession();
  Router.render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  initInstallPrompt();
})();
