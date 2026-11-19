/* ==========================================================================
   KASVIA — modules.js
   Members module + generic transaction modules (savings, shares, fines,
   welfare, expenses). Financial records are never hard-deleted — only
   voided/reversed, per the group's accounting principle.
   ========================================================================== */

async function activeMembers() {
  const all = await DB.all("members");
  return all.filter(m => m.membershipStatus !== "Deactivated");
}
async function memberById(id) { return DB.get("members", id); }
async function memberOptions() {
  const ms = await activeMembers();
  return ms.sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => ({ value: m.id, label: `${m.fullName} (${m.id})` }));
}

/* ============================= MEMBERS ============================= */
const MEMBER_FIELDS = [
  { key: "fullName", label: "Full name", required: true },
  { key: "gender", label: "Gender", type: "select", options: ["Female", "Male", "Other"], required: true },
  { key: "phone", label: "Phone number", required: true, placeholder: "07XXXXXXXX" },
  { key: "altPhone", label: "Alternative phone number" },
  { key: "dob", label: "Date of birth", type: "date" },
  { key: "community", label: "Community / location" },
  { key: "refugeeStatus", label: "Refugee / host-community status", type: "select", options: ["", "Refugee", "Host community", "Prefer not to say"], hint: "Only record if the group genuinely needs this." },
  { key: "dateJoined", label: "Date joined", type: "date", default: todayISO(), required: true },
  { key: "emergencyContact", label: "Emergency contact" },
  { key: "nextOfKin", label: "Next of kin" },
  { key: "notes", label: "Notes", type: "textarea" },
];

async function pageMembers(el, params) {
  if (!can("members_create") && !requireRole(ROLES.ADMIN, ROLES.SECRETARY, ROLES.TREASURER)) {}
  const members = (await DB.all("members")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const canCreate = can("members_create");

  el.innerHTML = `
    <div class="toolbar">
      <input id="mSearch" placeholder="Search by name, ID or phone…" style="padding:9px 12px;border:1px solid var(--line);border-radius:8px;min-width:240px" oninput="filterMembers(this.value)">
      <div class="spacer"></div>
      ${canCreate ? `<button class="btn btn-primary" onclick="openMemberForm()">+ Register member</button>` : ""}
    </div>
    <div id="memberTableWrap"></div>
  `;
  window.__allMembers = members;
  renderMemberTable(members);
}
function renderMemberTable(members) {
  const wrap = document.getElementById("memberTableWrap");
  wrap.innerHTML = renderTable({
    columns: [
      { key: "id", label: "Member ID" },
      { key: "fullName", label: "Full name" },
      { key: "gender", label: "Gender" },
      { key: "phone", label: "Phone" },
      { key: "dateJoined", label: "Joined", render: r => fmtDate(r.dateJoined) },
      { key: "membershipStatus", label: "Status", render: r => statusBadge(r.membershipStatus || "Active") },
    ],
    rows: members,
    rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="openMemberProfile('${r.id}')">View</button>`,
    emptyText: "No members registered yet. Click “Register member” to add the first one."
  });
}
function filterMembers(q) {
  q = q.trim().toLowerCase();
  const filtered = !q ? window.__allMembers : window.__allMembers.filter(m =>
    m.fullName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || (m.phone || "").includes(q));
  renderMemberTable(filtered);
}

function openMemberForm(existing) {
  if (!can("members_create")) return toast("You do not have permission to register members.", "err");
  openModal({
    title: existing ? `Edit ${existing.fullName}` : "Register new member",
    wide: true,
    bodyHTML: `<form id="memberForm">${buildFormFields(MEMBER_FIELDS, existing || {})}</form>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="saveMember(${existing ? `'${existing.id}'` : "null"})">Save member</button>`
  });
}
async function saveMember(existingId) {
  const data = readFormFields(MEMBER_FIELDS);
  if (!data.fullName || !data.phone) return toast("Full name and phone number are required.", "err");
  if (existingId) {
    const rec = await DB.get("members", existingId);
    const before = { ...rec };
    Object.assign(rec, data);
    rec.updatedAt = nowISO();
    await DB.put("members", rec);
    await audit("Edited member", rec.id, before, rec);
    toast("Member updated.");
  } else {
    const id = await genMemberId();
    const rec = { id, ...data, membershipStatus: "Active", createdAt: nowISO(), createdBy: Session.current.username };
    await DB.put("members", rec);
    await audit("Registered member", id, null, rec);
    toast(`Member ${id} registered.`);
  }
  closeModal();
  Router.render();
}

async function deactivateMember(id) {
  if (!can("members_deactivate")) return toast("Only Administrators can deactivate members.", "err");
  requireAdminAuth("Deactivate member " + id, async () => {
    const rec = await DB.get("members", id);
    const before = { ...rec };
    rec.membershipStatus = "Deactivated";
    await DB.put("members", rec);
    await audit("Deactivated member", id, before, rec);
    toast("Member deactivated.");
    Router.render();
  });
}

async function openMemberProfile(id) {
  const m = await DB.get("members", id);
  if (!m) return;
  const savings = (await DB.byIndex("savings", "byMember", id)).filter(s => !s.voided);
  const loans = await DB.byIndex("loans", "byMember", id);
  const repayments = (await Promise.all(loans.map(l => DB.byIndex("repayments", "byLoan", l.id)))).flat();
  const fines = (await DB.byIndex("fines", "byMember", id)).filter(f => !f.voided);
  const welfare = (await DB.byIndex("welfare", "byMember", id)).filter(w => !w.voided);
  const meetings = await DB.all("meetings");
  const attended = meetings.filter(mt => (mt.present || []).includes(id)).length;

  const totalSavings = savings.reduce((s, x) => s + Number(x.amount || 0), 0);
  const currentLoan = loans.find(l => ["Active", "Disbursed"].includes(l.status));
  const totalRepaid = repayments.reduce((s, x) => s + Number(x.amountPaid || 0), 0);
  const interestPaid = repayments.reduce((s, x) => s + Number(x.interestPortion || 0), 0);
  const totalFines = fines.reduce((s, x) => s + Number(x.amount || 0), 0);
  const welfareContrib = welfare.filter(w => w.type === "Contribution").reduce((s, x) => s + Number(x.amount || 0), 0);
  const welfareWithdraw = welfare.filter(w => w.type === "Payment").reduce((s, x) => s + Number(x.amount || 0), 0);

  const txns = [
    ...savings.map(s => ({ date: s.date, type: "Savings (" + (s.type || "Regular") + ")", amount: s.amount, id: s.id })),
    ...repayments.map(r => ({ date: r.date, type: "Loan repayment", amount: r.amountPaid, id: r.id })),
    ...fines.map(f => ({ date: f.date, type: "Fine — " + f.fineType, amount: f.amount, id: f.id })),
    ...welfare.map(w => ({ date: w.date, type: "Welfare " + w.type, amount: w.amount, id: w.id })),
    ...loans.filter(l=>l.disbursedDate).map(l => ({ date: l.disbursedDate, type: "Loan disbursed", amount: -l.amount, id: l.id })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  openModal({
    title: `${m.fullName} — ${m.id}`,
    wide: true,
    bodyHTML: `
      <div class="grid grid-4" style="margin-bottom:14px">
        ${statCard("Total savings", formatKES(totalSavings))}
        ${statCard("Loan balance", formatKES(currentLoan ? currentLoan.balance : 0), { cls: currentLoan ? "clay" : "" })}
        ${statCard("Total repaid", formatKES(totalRepaid))}
        ${statCard("Meetings attended", attended)}
      </div>
      <div class="grid grid-2" style="margin-bottom:14px">
        <div class="card small">
          <b>Member details</b><br>
          Gender: ${esc(m.gender || "—")}<br>
          Phone: ${esc(m.phone || "—")} ${m.altPhone ? "/ " + esc(m.altPhone) : ""}<br>
          Community: ${esc(m.community || "—")}<br>
          Joined: ${fmtDate(m.dateJoined)}<br>
          Status: ${statusBadge(m.membershipStatus || "Active")}
        </div>
        <div class="card small">
          <b>Financial summary</b><br>
          Interest paid: ${formatKES(interestPaid)}<br>
          Fines: ${formatKES(totalFines)}<br>
          Welfare contributions: ${formatKES(welfareContrib)}<br>
          Welfare withdrawals: ${formatKES(welfareWithdraw)}
        </div>
      </div>
      <div class="section-title"><h3>Transaction history</h3></div>
      ${renderTable({
        columns: [
          { key: "date", label: "Date", render: r => fmtDate(r.date) },
          { key: "type", label: "Type" },
          { key: "id", label: "Reference" },
          { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
        ], rows: txns.slice(0, 40), emptyText: "No transactions recorded yet."
      })}
    `,
    footHTML: `
      ${can("members_edit") ? `<button class="btn btn-ghost" onclick='closeModal();openMemberForm(${JSON.stringify(m)})'>Edit</button>` : ""}
      ${can("members_deactivate") && m.membershipStatus !== "Deactivated" ? `<button class="btn btn-danger" onclick="deactivateMember('${m.id}')">Deactivate</button>` : ""}
      <button class="btn btn-gold" onclick="printMemberStatement('${m.id}')">Print member statement</button>
    `
  });
}

async function printMemberStatement(id) {
  const m = await DB.get("members", id);
  const savings = (await DB.byIndex("savings", "byMember", id)).filter(s => !s.voided);
  const loans = await DB.byIndex("loans", "byMember", id);
  const repayments = (await Promise.all(loans.map(l => DB.byIndex("repayments", "byLoan", l.id)))).flat();
  const fines = (await DB.byIndex("fines", "byMember", id)).filter(f => !f.voided);
  const welfare = (await DB.byIndex("welfare", "byMember", id)).filter(w => !w.voided);
  const profile = await DB.getSetting("groupProfile", {});
  const txns = [
    ...savings.map(s => ({ date: s.date, type: "Savings", amount: s.amount })),
    ...repayments.map(r => ({ date: r.date, type: "Loan repayment", amount: r.amountPaid })),
    ...fines.map(f => ({ date: f.date, type: "Fine", amount: f.amount })),
    ...welfare.map(w => ({ date: w.date, type: "Welfare " + w.type, amount: w.amount })),
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Statement - ${esc(m.id)}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#12211D}
    h2,h3{margin:2px 0} table{width:100%;border-collapse:collapse;margin-top:14px}
    td,th{border-bottom:1px solid #ccc;padding:6px 8px;text-align:left;font-size:.85rem}
    .right{text-align:right} .hd{display:flex;justify-content:space-between;border-bottom:2px solid #0F4C41;padding-bottom:10px}</style>
    </head><body>
    <div class="hd"><div><h2>${esc(profile.name || "VSL Group")} — Member Statement</h2>
    <div>${esc(profile.location || "")}</div></div><div>Printed: ${fmtDate(todayISO())}</div></div>
    <p><b>${esc(m.fullName)}</b> — ${esc(m.id)} · ${esc(m.phone || "")}</p>
    <table><thead><tr><th>Date</th><th>Type</th><th class="right">Amount</th></tr></thead><tbody>
    ${txns.map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.type)}</td><td class="right">${formatKES(t.amount)}</td></tr>`).join("")}
    </tbody></table>
    <p style="margin-top:40px">Authorized signature: _______________________</p>
    <script>window.print()</script>
    </body></html>`);
}

/* ===================== GENERIC TRANSACTION MODULE FACTORY ===================== */
/* Used for Fines, Welfare, Expenses. Savings/Loans/Repayments have bespoke logic
   below / in loans.js due to extra calculations. */
function makeGenericModule({ store, title, filterOptions = [] }) {
  return {
    async page(el) {
      const cfg = MODULE_REGISTRY[store];
      const rows = (await DB.all(store)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      window["__all_" + store] = rows;
      el.innerHTML = `
        <div class="toolbar">
          ${filterOptions.length ? `<div class="pillfilter" id="filterPills_${store}">
            <button class="active" data-f="__all">All</button>
            ${filterOptions.map(o => `<button data-f="${esc(o)}">${esc(o)}</button>`).join("")}
          </div>` : ""}
          <div class="spacer"></div>
          ${can(cfg.permCreate) ? `<button class="btn btn-primary" onclick="openGenericForm('${store}')">+ Record ${title.toLowerCase().replace(/s$/, "")}</button>` : ""}
        </div>
        <div id="wrap_${store}"></div>`;
      renderGenericTable(store);
      if (filterOptions.length) {
        el.querySelectorAll(`#filterPills_${store} button`).forEach(b => b.onclick = () => {
          el.querySelectorAll(`#filterPills_${store} button`).forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          const f = b.dataset.f;
          const rows2 = window["__all_" + store];
          const filtered = f === "__all" ? rows2 : rows2.filter(r => r.fineType === f || r.type === f || r.category === f);
          renderGenericTableRows(store, filtered);
        });
      }
    }
  };
}
function renderGenericTable(store) { renderGenericTableRows(store, window["__all_" + store]); }
function renderGenericTableRows(store, rows) {
  const cfg = MODULE_REGISTRY[store];
  document.getElementById("wrap_" + store).innerHTML = renderTable({
    columns: cfg.columns,
    rows,
    rowActions: r => (can(cfg.permVoid) && !r.voided) ? `<button class="btn btn-ghost btn-sm" onclick="voidGenericRecord('${store}','${r.id}')">Void</button>` : (r.voided ? `<span class="badge badge-voided">Voided</span>` : ""),
    emptyText: `No ${cfg.title.toLowerCase()} recorded yet.`
  });
}

async function openGenericForm(store) {
  const cfg = MODULE_REGISTRY[store];
  if (!can(cfg.permCreate)) return toast("You do not have permission for this action.", "err");
  const memberOpts = await memberOptions();
  const fieldsResolved = cfg.fields.map(f => f.key === "memberId" ? { ...f, options: [{ value: "", label: "Select member" }, ...memberOpts] } : f);
  openModal({
    title: "Record " + cfg.title.toLowerCase().replace(/s$/, ""),
    bodyHTML: `<form id="genForm">${buildFormFields(fieldsResolved, { date: todayISO() })}</form>
      <div class="msg msg-info" style="margin-top:10px">Please confirm this transaction before saving.</div>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="saveGenericRecord('${store}')">Save transaction</button>`
  });
}
async function saveGenericRecord(store) {
  const cfg = MODULE_REGISTRY[store];
  const data = readFormFields(cfg.fields);
  for (const f of cfg.fields) if (f.required && !data[f.key] && data[f.key] !== 0) return toast(`${f.label} is required.`, "err");
  if (data.amount !== undefined && Number(data.amount) < 0) return toast("Amount cannot be negative.", "err");
  const id = await cfg.idGen();
  const member = data.memberId ? await memberById(data.memberId) : null;
  const rec = { id, ...data, memberName: member ? member.fullName : undefined, recordedBy: Session.current.username, voided: false, createdAt: nowISO() };
  await DB.put(store, rec);
  await audit(`Recorded ${cfg.title.toLowerCase()}`, id, null, rec);
  if (cfg.onSave) await cfg.onSave(rec);
  toast(cfg.title + " recorded.");
  closeModal();
  Router.render();
}
async function voidGenericRecord(store, id) {
  const cfg = MODULE_REGISTRY[store];
  if (!can(cfg.permVoid)) return toast("Only an Administrator can void a transaction.", "err");
  requireAdminAuth(`Void ${cfg.title} ${id}`, async (admin) => {
    const rec = await DB.get(store, id);
    const before = { ...rec };
    rec.voided = true;
    rec.voidedBy = admin.username;
    rec.voidedAt = nowISO();
    await DB.put(store, rec);
    await audit(`Voided ${cfg.title.toLowerCase()} (financial records are never deleted, only voided)`, id, before, rec);
    if (cfg.onVoid) await cfg.onVoid(rec);
    toast(cfg.title + " voided. Original record retained for audit.");
    Router.render();
  });
}

/* ---- module field/column definitions ---- */
const MODULE_REGISTRY = {
  savings: {
    title: "Savings", permCreate: "savings_record", permVoid: "savings_void", idGen: genTxnId,
    fields: [
      { key: "memberId", label: "Member", type: "select", required: true },
      { key: "type", label: "Savings type", type: "select", required: true, options: ["Regular savings", "Additional savings", "Savings adjustment"] },
      { key: "amount", label: "Amount (KSh)", type: "number", step: "0.01", min: 0, required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "meetingNumber", label: "Meeting number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "id", label: "Txn ID" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
      { key: "memberName", label: "Member" }, { key: "type", label: "Type" },
      { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
      { key: "status", label: "Status", render: r => r.voided ? statusBadge("Voided") : statusBadge("Active") },
    ]
  },
  fines: {
    title: "Fines", permCreate: "fines_record", permVoid: "savings_void", idGen: genTxnId,
    fields: [
      { key: "memberId", label: "Member", type: "select", required: true },
      { key: "fineType", label: "Fine type", type: "select", required: true, options: ["Late attendance", "Missing a meeting", "Late loan repayment", "Other"] },
      { key: "amount", label: "Amount (KSh)", type: "number", step: "0.01", min: 0, required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "reason", label: "Reason", type: "textarea" },
    ],
    columns: [
      { key: "id", label: "Ref" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
      { key: "memberName", label: "Member" }, { key: "fineType", label: "Fine type" },
      { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
      { key: "status", label: "Status", render: r => r.voided ? statusBadge("Voided") : statusBadge("Active") },
    ]
  },
  welfare: {
    title: "Welfare", permCreate: "welfare_record", permVoid: "savings_void", idGen: genTxnId,
    fields: [
      { key: "memberId", label: "Member", type: "select", required: true },
      { key: "type", label: "Entry type", type: "select", required: true, options: ["Contribution", "Payment"], hint: "Payment = welfare assistance paid out to a member." },
      { key: "amount", label: "Amount (KSh)", type: "number", step: "0.01", min: 0, required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "notes", label: "Notes / reason", type: "textarea" },
    ],
    columns: [
      { key: "id", label: "Ref" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
      { key: "memberName", label: "Member" }, { key: "type", label: "Type" },
      { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
      { key: "status", label: "Status", render: r => r.voided ? statusBadge("Voided") : statusBadge("Active") },
    ]
  },
  expenses: {
    title: "Expenses", permCreate: "expenses_record", permVoid: "savings_void", idGen: genTxnId,
    fields: [
      { key: "description", label: "Description", required: true },
      { key: "category", label: "Category", type: "select", required: true, options: ["Stationery", "Meeting expenses", "Transport", "Bank/M-Pesa charges", "Administrative", "Other"] },
      { key: "amount", label: "Amount (KSh)", type: "number", step: "0.01", min: 0, required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "method", label: "Payment method", type: "select", options: ["Cash", "M-Pesa"] },
      { key: "authorizedBy", label: "Authorized by" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "id", label: "Ref" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
      { key: "description", label: "Description" }, { key: "category", label: "Category" },
      { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
      { key: "status", label: "Status", render: r => r.voided ? statusBadge("Voided") : statusBadge("Active") },
    ]
  }
};

const pageFines = makeGenericModule({ store: "fines", title: "Fines" }).page;
const pageWelfare = makeGenericModule({ store: "welfare", title: "Welfare" }).page;
const pageExpenses = makeGenericModule({ store: "expenses", title: "Expenses" }).page;

/* ============================= SAVINGS + SHARES ============================= */
async function pageSavings(el) {
  const savingsSettings = await DB.getSetting("savingsSettings", { shareValue: 100, minWeekly: 100, maxWeekly: "", meetingFrequency: "Weekly", cycle: "" });
  const shares = (await DB.all("shares"));
  const members = await activeMembers();
  const totalSharesByMember = {};
  shares.forEach(s => { if (!s.voided) totalSharesByMember[s.memberId] = (totalSharesByMember[s.memberId] || 0) + Number(s.numberOfShares || 0); });

  el.innerHTML = `
    <div class="toolbar">
      <div class="pillfilter">
        <button class="active" data-tab="savings" onclick="switchSavingsTab('savings')">Savings transactions</button>
        <button data-tab="shares" onclick="switchSavingsTab('shares')">Share ledger</button>
      </div>
      <div class="spacer"></div>
      <span class="tag">1 share = ${formatKES(savingsSettings.shareValue)}</span>
    </div>
    <div id="savingsTabContent"></div>
  `;
  window.__savingsSettings = savingsSettings;
  window.__shareBalances = totalSharesByMember;
  window.__membersForShares = members;
  switchSavingsTab("savings");
}
async function switchSavingsTab(tab) {
  document.querySelectorAll(".pillfilter button[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const wrap = document.getElementById("savingsTabContent");
  if (tab === "savings") {
    const rows = (await DB.all("savings")).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    window.__all_savings = rows;
    wrap.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        ${can("savings_record") ? `<button class="btn btn-primary" onclick="openGenericForm('savings')">+ Record savings</button>` : ""}
      </div>
      <div id="wrap_savings"></div>`;
    renderGenericTable("savings");
  } else {
    const balances = window.__shareBalances;
    const members = window.__membersForShares;
    const rows = members.map(m => ({ ...m, shares: balances[m.id] || 0, value: (balances[m.id] || 0) * window.__savingsSettings.shareValue }));
    wrap.innerHTML = `
      <div class="toolbar"><div class="spacer"></div>
        ${can("savings_record") ? `<button class="btn btn-primary" onclick="openShareForm()">+ Record share purchase</button>` : ""}
      </div>
      ${renderTable({
        columns: [
          { key: "id", label: "Member ID" }, { key: "fullName", label: "Member" },
          { key: "shares", label: "Total shares", right: true },
          { key: "value", label: "Share value (KSh)", right: true, render: r => formatKES(r.value) },
        ], rows, emptyText: "No share purchases recorded yet."
      })}
    `;
  }
}
async function openShareForm() {
  if (!can("savings_record")) return toast("You do not have permission for this action.", "err");
  const settings = await DB.getSetting("savingsSettings", { shareValue: 100 });
  const opts = await memberOptions();
  const fields = [
    { key: "memberId", label: "Member", type: "select", required: true, options: [{ value: "", label: "Select member" }, ...opts] },
    { key: "numberOfShares", label: "Number of shares", type: "number", min: 1, required: true },
    { key: "date", label: "Date", type: "date", required: true, default: todayISO() },
  ];
  openModal({
    title: `Record share purchase (1 share = ${formatKES(settings.shareValue)})`,
    bodyHTML: `<form id="shareForm">${buildFormFields(fields, { date: todayISO() })}</form>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="saveShare(${settings.shareValue})">Save</button>`
  });
  window.__shareFields = fields;
}
async function saveShare(shareValue) {
  const data = readFormFields(window.__shareFields);
  if (!data.memberId || !data.numberOfShares) return toast("Please select a member and number of shares.", "err");
  const member = await memberById(data.memberId);
  const id = await genTxnId();
  const rec = { id, memberId: data.memberId, memberName: member.fullName, numberOfShares: data.numberOfShares, shareValue, amount: data.numberOfShares * shareValue, date: data.date, recordedBy: Session.current.username, voided: false, createdAt: nowISO() };
  await DB.put("shares", rec);
  await audit("Recorded share purchase", id, null, rec);
  toast(`${data.numberOfShares} shares (${formatKES(rec.amount)}) recorded for ${member.fullName}.`);
  closeModal();
  Router.render();
}
