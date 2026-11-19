/* ==========================================================================
   KASVIA — loans.js
   Loan applications, approval workflow, disbursement, configurable interest,
   and repayments with automatic principal/interest split.
   ========================================================================== */

function calcLoanInterest(principal, rate, method, periods) {
  principal = Number(principal) || 0; rate = Number(rate) || 0; periods = Number(periods) || 1;
  if (method === "Declining balance") {
    // simple declining-balance approximation: interest charged on reducing balance each period
    let balance = principal, totalInterest = 0;
    const principalPerPeriod = principal / periods;
    for (let i = 0; i < periods; i++) {
      const interest = balance * (rate / 100);
      totalInterest += interest;
      balance -= principalPerPeriod;
    }
    return { interest: Math.round(totalInterest * 100) / 100, total: Math.round((principal + totalInterest) * 100) / 100 };
  }
  // Flat interest (default)
  const interest = principal * (rate / 100);
  return { interest: Math.round(interest * 100) / 100, total: Math.round((principal + interest) * 100) / 100 };
}

async function pageLoans(el) {
  const loanSettings = await DB.getSetting("loanSettings", { interestRate: 10, interestMethod: "Flat interest", maxLoanMultiplier: 3, defaultDurationMonths: 3 });
  const loans = (await DB.all("loans")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  window.__all_loans = loans;
  el.innerHTML = `
    <div class="toolbar">
      <div class="pillfilter" id="loanFilterPills">
        <button class="active" data-f="__all">All</button>
        ${["Pending", "Approved", "Disbursed", "Active", "Fully Paid", "Rejected", "Defaulted"].map(s => `<button data-f="${s}">${s}</button>`).join("")}
      </div>
      <div class="spacer"></div>
      <span class="tag">Rate: ${loanSettings.interestRate}% · ${esc(loanSettings.interestMethod)}</span>
      ${can("loans_apply") ? `<button class="btn btn-primary" onclick="openLoanApplicationForm()">+ New loan application</button>` : ""}
    </div>
    <div id="loanTableWrap"></div>
  `;
  renderLoanTable(loans);
  el.querySelectorAll("#loanFilterPills button").forEach(b => b.onclick = () => {
    el.querySelectorAll("#loanFilterPills button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    const f = b.dataset.f;
    renderLoanTable(f === "__all" ? loans : loans.filter(l => l.status === f));
  });
}
function renderLoanTable(rows) {
  document.getElementById("loanTableWrap").innerHTML = renderTable({
    columns: [
      { key: "id", label: "Loan ID" }, { key: "memberName", label: "Member" },
      { key: "amount", label: "Amount", right: true, render: r => formatKES(r.amount) },
      { key: "totalRepayable", label: "Total repayable", right: true, render: r => formatKES(r.totalRepayable) },
      { key: "balance", label: "Balance", right: true, render: r => formatKES(r.balance) },
      { key: "status", label: "Status", render: r => statusBadge(r.status) },
    ],
    rows,
    rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="openLoanDetail('${r.id}')">View</button>`,
    emptyText: "No loan applications yet."
  });
}

async function openLoanApplicationForm() {
  if (!can("loans_apply")) return toast("You do not have permission to submit loan applications.", "err");
  const opts = await memberOptions();
  const settings = await DB.getSetting("loanSettings", { interestRate: 10, interestMethod: "Flat interest", defaultDurationMonths: 3 });
  const fields = [
    { key: "memberId", label: "Member", type: "select", required: true, options: [{ value: "", label: "Select member" }, ...opts] },
    { key: "applicationDate", label: "Application date", type: "date", required: true, default: todayISO() },
    { key: "amount", label: "Requested amount (KSh)", type: "number", min: 1, step: "0.01", required: true },
    { key: "purpose", label: "Purpose", required: true },
    { key: "repaymentPeriod", label: "Repayment period (months)", type: "number", min: 1, default: settings.defaultDurationMonths, required: true },
    { key: "guarantors", label: "Guarantor(s)", hint: "Names of members guaranteeing this loan, if required by group rules." },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  openModal({
    title: "New loan application", wide: true,
    bodyHTML: `<form id="loanForm">${buildFormFields(fields, { applicationDate: todayISO(), repaymentPeriod: settings.defaultDurationMonths })}</form>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="submitLoanApplication()">Submit application</button>`
  });
  window.__loanAppFields = fields;
}
async function submitLoanApplication() {
  const data = readFormFields(window.__loanAppFields);
  if (!data.memberId || !data.amount || !data.purpose) return toast("Please complete all required fields.", "err");
  const member = await memberById(data.memberId);
  const settings = await DB.getSetting("loanSettings", { interestRate: 10, interestMethod: "Flat interest" });
  const { interest, total } = calcLoanInterest(data.amount, settings.interestRate, settings.interestMethod, data.repaymentPeriod);
  const id = await genLoanId();
  const rec = {
    id, memberId: data.memberId, memberName: member.fullName, applicationDate: data.applicationDate,
    amount: data.amount, purpose: data.purpose, repaymentPeriod: data.repaymentPeriod, guarantors: data.guarantors || "",
    notes: data.notes || "", status: "Pending", interestRate: settings.interestRate, interestMethod: settings.interestMethod,
    interestAmount: interest, totalRepayable: total, balance: total, createdAt: nowISO(), createdBy: Session.current.username
  };
  await DB.put("loans", rec);
  await audit("Loan application submitted", id, null, rec);
  toast(`Loan application ${id} submitted — pending approval.`);
  closeModal();
  Router.render();
}

async function loanEligibilityInfo(memberId, requestAmount) {
  const savings = (await DB.byIndex("savings", "byMember", memberId)).filter(s => !s.voided);
  const totalSavings = savings.reduce((s, x) => s + Number(x.amount || 0), 0);
  const loans = await DB.byIndex("loans", "byMember", memberId);
  const existing = loans.filter(l => ["Active", "Disbursed"].includes(l.status));
  const existingBalance = existing.reduce((s, l) => s + Number(l.balance || 0), 0);
  const settings = await DB.getSetting("loanSettings", { maxLoanMultiplier: 3 });
  const maxAllowed = totalSavings * (settings.maxLoanMultiplier || 3);
  const paidLoans = loans.filter(l => l.status === "Fully Paid").length;
  const defaulted = loans.filter(l => l.status === "Defaulted").length;
  return { totalSavings, existingBalance, maxAllowed, paidLoans, defaulted, exceedsLimit: Number(requestAmount) > maxAllowed };
}

async function openLoanDetail(id) {
  const loan = await DB.get("loans", id);
  const member = await memberById(loan.memberId);
  const elig = await loanEligibilityInfo(loan.memberId, loan.amount);
  const repayments = await DB.byIndex("repayments", "byLoan", id);

  let actionButtons = "";
  if (loan.status === "Pending" && can("loans_approve")) {
    actionButtons += `<button class="btn btn-primary" onclick="approveLoan('${id}')">Approve loan</button>
                       <button class="btn btn-danger" onclick="rejectLoan('${id}')">Reject</button>`;
  }
  if (loan.status === "Approved" && can("loans_disburse")) {
    actionButtons += `<button class="btn btn-gold" onclick="disburseLoan('${id}')">Disburse loan</button>`;
  }
  if (["Disbursed", "Active"].includes(loan.status) && can("repayments_record")) {
    actionButtons += `<button class="btn btn-primary" onclick="closeModal();openRepaymentForm('${id}')">Record repayment</button>`;
  }

  openModal({
    title: `Loan ${id} — ${member.fullName}`, wide: true,
    bodyHTML: `
      <div class="grid grid-4" style="margin-bottom:14px">
        ${statCard("Requested", formatKES(loan.amount))}
        ${statCard("Interest (" + loan.interestMethod + ")", formatKES(loan.interestAmount))}
        ${statCard("Total repayable", formatKES(loan.totalRepayable))}
        ${statCard("Balance", formatKES(loan.balance), { cls: loan.balance > 0 ? "clay" : "" })}
      </div>
      <div class="grid grid-2" style="margin-bottom:14px">
        <div class="card small">
          <b>Application</b><br>
          Status: ${statusBadge(loan.status)}<br>
          Purpose: ${esc(loan.purpose)}<br>
          Repayment period: ${esc(loan.repaymentPeriod)} months<br>
          Guarantors: ${esc(loan.guarantors || "—")}<br>
          Applied: ${fmtDate(loan.applicationDate)}
          ${loan.approvedBy ? `<br>Approved by: ${esc(loan.approvedBy)} on ${fmtDate(loan.approvedDate)}` : ""}
          ${loan.disbursedDate ? `<br>Disbursed: ${fmtDate(loan.disbursedDate)}` : ""}
        </div>
        <div class="card small">
          <b>Member eligibility</b><br>
          Total savings: ${formatKES(elig.totalSavings)}<br>
          Existing loan balance: ${formatKES(elig.existingBalance)}<br>
          Maximum permitted loan: ${formatKES(elig.maxAllowed)}<br>
          Previous loans fully paid: ${elig.paidLoans} · Defaulted: ${elig.defaulted}
          ${elig.exceedsLimit ? `<div class="msg msg-error" style="margin-top:6px">⚠ Requested amount exceeds the group's configured borrowing limit.</div>` : ""}
        </div>
      </div>
      <div class="section-title"><h3>Repayment history</h3></div>
      ${renderTable({
        columns: [
          { key: "date", label: "Date", render: r => fmtDate(r.date) }, { key: "id", label: "Receipt" },
          { key: "principalPortion", label: "Principal", right: true, render: r => formatKES(r.principalPortion) },
          { key: "interestPortion", label: "Interest", right: true, render: r => formatKES(r.interestPortion) },
          { key: "amountPaid", label: "Total paid", right: true, render: r => formatKES(r.amountPaid) },
          { key: "method", label: "Method" },
        ], rows: repayments, emptyText: "No repayments recorded yet."
      })}
    `,
    footHTML: actionButtons || `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
  });
}

async function approveLoan(id) {
  if (!can("loans_approve")) return toast("Only Administrators can approve loans.", "err");
  const loan = await DB.get("loans", id);
  const elig = await loanEligibilityInfo(loan.memberId, loan.amount);
  requireAdminAuth(`Approve loan ${id}`, async (admin) => {
    const before = { ...loan };
    loan.status = "Approved"; loan.approvedBy = admin.username; loan.approvedDate = todayISO();
    if (elig.exceedsLimit) await raiseAlert("loan_limit", `Loan ${id} approved despite exceeding the configured borrowing limit.`, "warning");
    await DB.put("loans", loan);
    await audit("Approved loan", id, before, loan);
    toast(`Loan ${id} approved.`);
    closeModal(); Router.render();
  });
}
async function rejectLoan(id) {
  if (!can("loans_approve")) return toast("Only Administrators can reject loans.", "err");
  confirmAction(`Reject loan application ${id}?`, async () => {
    const loan = await DB.get("loans", id);
    const before = { ...loan };
    loan.status = "Rejected";
    await DB.put("loans", loan);
    await audit("Rejected loan", id, before, loan);
    toast(`Loan ${id} rejected.`);
    Router.render();
  }, { danger: true, confirmLabel: "Reject loan" });
}
async function disburseLoan(id) {
  if (!can("loans_disburse")) return toast("You do not have permission to disburse loans.", "err");
  confirmAction(`Confirm disbursement of loan ${id}? This will mark it Active and release funds.`, async () => {
    const loan = await DB.get("loans", id);
    const before = { ...loan };
    loan.status = "Active"; loan.disbursedDate = todayISO(); loan.disbursedBy = Session.current.username;
    await DB.put("loans", loan);
    await audit("Disbursed loan", id, before, loan);
    toast(`Loan ${id} disbursed. Funds released.`);
    Router.render();
  }, { confirmLabel: "Confirm disbursement" });
}

/* ------------------------------ Repayments ------------------------------ */
async function pageRepayments(el) {
  const repayments = (await DB.all("repayments")).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  el.innerHTML = `
    <div class="toolbar"><div class="spacer"></div>
      ${can("repayments_record") ? `<button class="btn btn-primary" onclick="openRepaymentForm()">+ Record repayment</button>` : ""}
    </div>
    <div id="repayWrap"></div>`;
  document.getElementById("repayWrap").innerHTML = renderTable({
    columns: [
      { key: "id", label: "Receipt" }, { key: "date", label: "Date", render: r => fmtDate(r.date) },
      { key: "memberName", label: "Member" }, { key: "loanId", label: "Loan" },
      { key: "principalPortion", label: "Principal", right: true, render: r => formatKES(r.principalPortion) },
      { key: "interestPortion", label: "Interest", right: true, render: r => formatKES(r.interestPortion) },
      { key: "amountPaid", label: "Total", right: true, render: r => formatKES(r.amountPaid) },
      { key: "method", label: "Method" },
    ],
    rows: repayments,
    rowActions: r => `<button class="btn btn-ghost btn-sm" onclick="printReceipt('repayments','${r.id}')">Receipt</button>`,
    emptyText: "No repayments recorded yet."
  });
}

async function openRepaymentForm(preselectLoanId) {
  if (!can("repayments_record")) return toast("You do not have permission to record repayments.", "err");
  const activeLoans = (await DB.all("loans")).filter(l => ["Active", "Disbursed"].includes(l.status));
  if (!activeLoans.length) return toast("There are no active loans to repay.", "err");
  const fields = [
    { key: "loanId", label: "Loan", type: "select", required: true, options: activeLoans.map(l => ({ value: l.id, label: `${l.id} — ${l.memberName} (bal. ${formatKES(l.balance)})` })) },
    { key: "amountPaid", label: "Amount paid (KSh)", type: "number", min: 0.01, step: "0.01", required: true },
    { key: "date", label: "Date", type: "date", required: true, default: todayISO() },
    { key: "method", label: "Payment method", type: "select", required: true, options: ["Cash", "M-Pesa"] },
    { key: "mpesaCode", label: "M-Pesa transaction code", hint: "Enter manually — no internet or API connection required." },
  ];
  openModal({
    title: "Record loan repayment",
    bodyHTML: `<form id="repayForm">${buildFormFields(fields, { date: todayISO(), loanId: preselectLoanId || "" })}</form>`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" onclick="saveRepayment()">Confirm & save</button>`
  });
  window.__repayFields = fields;
  window.__loansForRepay = activeLoans;
}
async function saveRepayment() {
  const data = readFormFields(window.__repayFields);
  if (!data.loanId || !data.amountPaid || !data.method) return toast("Please complete all required fields.", "err");
  const loan = await DB.get("loans", data.loanId);
  if (Number(data.amountPaid) > Number(loan.balance) + 0.01) {
    return toast(`Payment exceeds remaining balance of ${formatKES(loan.balance)}. Use an authorized adjustment if this is intentional.`, "err");
  }
  // split payment proportionally between remaining interest and principal
  const interestRemaining = Math.max(0, loan.totalRepayable - loan.amount - (loan.interestPaidSoFar || 0));
  let interestPortion = Math.min(data.amountPaid, interestRemaining);
  let principalPortion = data.amountPaid - interestPortion;

  const member = await memberById(loan.memberId);
  const id = await genReceiptId();
  const rec = {
    id, loanId: loan.id, memberId: loan.memberId, memberName: member.fullName, amountPaid: data.amountPaid,
    principalPortion: Math.round(principalPortion * 100) / 100, interestPortion: Math.round(interestPortion * 100) / 100,
    date: data.date, method: data.method, mpesaCode: data.mpesaCode || "", receiptNumber: id,
    recordedBy: Session.current.username, createdAt: nowISO()
  };
  await DB.put("repayments", rec);

  const before = { ...loan };
  loan.balance = Math.round((loan.balance - data.amountPaid) * 100) / 100;
  loan.interestPaidSoFar = (loan.interestPaidSoFar || 0) + interestPortion;
  if (loan.balance <= 0.5) { loan.balance = 0; loan.status = "Fully Paid"; }
  await DB.put("loans", loan);
  await audit("Recorded loan repayment", id, before, loan);

  toast(`Repayment ${id} recorded. Remaining balance: ${formatKES(loan.balance)}.`);
  closeModal();
  Router.render();
}

async function printReceipt(store, id) {
  const rec = await DB.get(store, id);
  const profile = await DB.getSetting("groupProfile", {});
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Receipt ${esc(id)}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:380px;margin:0 auto}
    h3{text-align:center;margin:2px 0}.sub{text-align:center;color:#555;font-size:.8rem;margin-bottom:14px}
    table{width:100%}td{padding:4px 0;font-size:.88rem}.tot{border-top:1px solid #999;font-weight:700}
    .sig{margin-top:36px;border-top:1px solid #000;padding-top:4px;font-size:.75rem;text-align:center;width:60%;margin-left:auto;margin-right:auto}</style>
    </head><body>
    <h3>${esc(profile.name || "VSL Group")}</h3>
    <div class="sub">${esc(profile.location || "")} · Official Receipt</div>
    <table>
      <tr><td>Receipt No.</td><td style="text-align:right">${esc(id)}</td></tr>
      <tr><td>Date</td><td style="text-align:right">${fmtDate(rec.date)}</td></tr>
      <tr><td>Member</td><td style="text-align:right">${esc(rec.memberName || "")}</td></tr>
      ${rec.loanId ? `<tr><td>Loan</td><td style="text-align:right">${esc(rec.loanId)}</td></tr>` : ""}
      <tr><td>Payment method</td><td style="text-align:right">${esc(rec.method || "Cash")}</td></tr>
      <tr class="tot"><td>Amount</td><td style="text-align:right">${formatKES(rec.amountPaid ?? rec.amount)}</td></tr>
      <tr><td>Recorded by</td><td style="text-align:right">${esc(rec.recordedBy || "")}</td></tr>
    </table>
    <div class="sig">Authorized signature</div>
    <script>window.print()</script>
    </body></html>`);
}
