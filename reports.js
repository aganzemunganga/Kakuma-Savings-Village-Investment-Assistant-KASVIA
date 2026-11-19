/* ==========================================================================
   KASVIA — reports.js
   Configurable reports covering financial, member and meeting data.
   Every report can be filtered by date range, printed, or exported to CSV.
   ========================================================================== */

const REPORT_DEFS = {
  savings: { label: "Savings report", store: "savings", dateKey: "date",
    cols: [{ key: "id", label: "Txn ID" }, { key: "date", label: "Date" }, { key: "memberName", label: "Member" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", get: r => formatKES(r.amount) }] },
  loans: { label: "Loan report", store: "loans", dateKey: "applicationDate",
    cols: [{ key: "id", label: "Loan ID" }, { key: "memberName", label: "Member" }, { key: "amount", label: "Amount", get: r => formatKES(r.amount) }, { key: "status", label: "Status" }, { key: "balance", label: "Balance", get: r => formatKES(r.balance) }] },
  repayments: { label: "Repayment report", store: "repayments", dateKey: "date",
    cols: [{ key: "id", label: "Receipt" }, { key: "date", label: "Date" }, { key: "memberName", label: "Member" }, { key: "loanId", label: "Loan" }, { key: "principalPortion", label: "Principal", get: r => formatKES(r.principalPortion) }, { key: "interestPortion", label: "Interest", get: r => formatKES(r.interestPortion) }, { key: "amountPaid", label: "Total", get: r => formatKES(r.amountPaid) }] },
  interest: { label: "Interest report", store: "loans", dateKey: "applicationDate",
    cols: [{ key: "id", label: "Loan ID" }, { key: "memberName", label: "Member" }, { key: "interestRate", label: "Rate", get: r => r.interestRate + "%" }, { key: "interestMethod", label: "Method" }, { key: "interestAmount", label: "Interest", get: r => formatKES(r.interestAmount) }] },
  fines: { label: "Fine report", store: "fines", dateKey: "date",
    cols: [{ key: "id", label: "Ref" }, { key: "date", label: "Date" }, { key: "memberName", label: "Member" }, { key: "fineType", label: "Type" }, { key: "amount", label: "Amount", get: r => formatKES(r.amount) }] },
  welfare: { label: "Welfare report", store: "welfare", dateKey: "date",
    cols: [{ key: "id", label: "Ref" }, { key: "date", label: "Date" }, { key: "memberName", label: "Member" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", get: r => formatKES(r.amount) }] },
  expenses: { label: "Expense report", store: "expenses", dateKey: "date",
    cols: [{ key: "id", label: "Ref" }, { key: "date", label: "Date" }, { key: "description", label: "Description" }, { key: "category", label: "Category" }, { key: "amount", label: "Amount", get: r => formatKES(r.amount) }] },
  members: { label: "Member list", store: "members", dateKey: "dateJoined",
    cols: [{ key: "id", label: "ID" }, { key: "fullName", label: "Name" }, { key: "phone", label: "Phone" }, { key: "dateJoined", label: "Joined" }, { key: "membershipStatus", label: "Status" }] },
  meetings: { label: "Meeting summary", store: "meetings", dateKey: "date",
    cols: [{ key: "id", label: "Meeting" }, { key: "date", label: "Date" }, { key: "location", label: "Location" }, { key: "presentCount", label: "Present", get: r => (r.present || []).length }, { key: "absentCount", label: "Absent", get: r => (r.absent || []).length }] },
};

async function pageReports(el) {
  const opts = Object.entries(REPORT_DEFS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="formrow">
        <div class="field"><label>Report type</label><select id="repType">${opts}</select></div>
        <div class="field"><label>Quick range</label>
          <select id="repRange" onchange="applyQuickRange()">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="cycle">Current cycle</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
      </div>
      <div class="formrow">
        <div class="field"><label>From</label><input type="date" id="repFrom"></div>
        <div class="field"><label>To</label><input type="date" id="repTo"></div>
      </div>
      <button class="btn btn-primary" onclick="runReport()">Generate report</button>
      <button class="btn btn-ghost" onclick="exportReportCSV()">Export CSV</button>
      <button class="btn btn-ghost" onclick="window.print()">Print</button>
    </div>
    <div id="reportOut"></div>
  `;
}
function applyQuickRange() {
  const v = document.getElementById("repRange").value;
  const from = document.getElementById("repFrom"), to = document.getElementById("repTo");
  const now = new Date();
  if (v === "today") { from.value = todayISO(); to.value = todayISO(); }
  else if (v === "week") { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); from.value = d.toISOString().slice(0, 10); to.value = todayISO(); }
  else if (v === "month") { from.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); to.value = todayISO(); }
  else if (v === "all") { from.value = ""; to.value = ""; }
}
async function runReport() {
  const type = document.getElementById("repType").value;
  const def = REPORT_DEFS[type];
  const from = document.getElementById("repFrom").value;
  const to = document.getElementById("repTo").value;
  const range = document.getElementById("repRange").value;
  let rows = await DB.all(def.store);
  if (range === "cycle") {
    const cycleId = await DB.getSetting("currentCycleId");
    const cycle = cycleId ? await DB.get("cycles", cycleId) : null;
    if (cycle) rows = rows.filter(r => (r[def.dateKey] || "") >= cycle.startDate && (r[def.dateKey] || "") <= (cycle.endDate || "9999-12-31"));
  } else {
    if (from) rows = rows.filter(r => (r[def.dateKey] || "") >= from);
    if (to) rows = rows.filter(r => (r[def.dateKey] || "") <= to);
  }
  rows = rows.filter(r => !r.voided);
  window.__reportRows = rows; window.__reportDef = def;
  const total = rows.reduce((s, r) => s + Number(r.amount ?? r.amountPaid ?? 0), 0);
  document.getElementById("reportOut").innerHTML = `
    <div class="section-title"><h3>${esc(def.label)} — ${rows.length} record(s)</h3>
      ${total ? `<span class="tag">Total: ${formatKES(total)}</span>` : ""}</div>
    ${renderTable({ columns: def.cols.map(c => ({ key: c.key, label: c.label, render: c.get })), rows, emptyText: "No records match this filter." })}
  `;
}
function exportReportCSV() {
  if (!window.__reportRows) return toast("Generate a report first.", "err");
  const csv = toCSV(window.__reportRows, window.__reportDef.cols.map(c => ({ label: c.label, get: c.get || (r => r[c.key]) })));
  downloadFile(`kasvia_${window.__reportDef.label.replace(/\s+/g, "_").toLowerCase()}_${todayISO()}.csv`, csv, "text/csv");
}

/* ---------------- Global search ---------------- */
async function pageSearch(el, params) {
  const q = (params.q || "").toLowerCase().trim();
  if (!q) { el.innerHTML = `<div class="empty">Type a search term in the top bar.</div>`; return; }
  const [members, loans, savings, repayments, fines, welfare, expenses] = await Promise.all(
    ["members", "loans", "savings", "repayments", "fines", "welfare", "expenses"].map(s => DB.all(s))
  );
  const memberHits = members.filter(m => m.fullName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || (m.phone || "").includes(q));
  const loanHits = loans.filter(l => l.id.toLowerCase().includes(q) || (l.memberName || "").toLowerCase().includes(q));
  const txnHits = [...savings, ...repayments, ...fines, ...welfare, ...expenses].filter(t =>
    (t.id || "").toLowerCase().includes(q) || (t.receiptNumber || "").toLowerCase().includes(q) || (t.memberName || "").toLowerCase().includes(q));

  el.innerHTML = `
    <div class="section-title"><h3>Members (${memberHits.length})</h3></div>
    ${renderTable({
      columns: [{ key: "id", label: "ID" }, { key: "fullName", label: "Name" }, { key: "phone", label: "Phone" }],
      rows: memberHits.slice(0, 20), rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="openMemberProfile('${r.id}')">View</button>`, emptyText: "No matching members."
    })}
    <div class="section-title"><h3>Loans (${loanHits.length})</h3></div>
    ${renderTable({
      columns: [{ key: "id", label: "Loan ID" }, { key: "memberName", label: "Member" }, { key: "status", label: "Status", render: r => statusBadge(r.status) }],
      rows: loanHits.slice(0, 20), rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="openLoanDetail('${r.id}')">View</button>`, emptyText: "No matching loans."
    })}
    <div class="section-title"><h3>Transactions (${txnHits.length})</h3></div>
    ${renderTable({
      columns: [{ key: "id", label: "Ref" }, { key: "date", label: "Date", render: r => fmtDate(r.date) }, { key: "memberName", label: "Member" }, { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount ?? r.amountPaid) }],
      rows: txnHits.slice(0, 30), emptyText: "No matching transactions."
    })}
  `;
}
