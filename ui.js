/* ==========================================================================
   KASVIA — ui.js
   Router, shell layout, toast/modal, generic table + form renderers.
   ========================================================================== */
function toast(msg, kind = "ok") {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = "toast " + (kind === "err" ? "err" : kind === "info" ? "" : "ok");
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function closeModal() {
  const b = document.querySelector(".modal-backdrop");
  if (b) b.remove();
}
function openModal({ title, bodyHTML, wide = false, footHTML = "" }) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `
    <div class="modal ${wide ? "wide" : ""}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">${bodyHTML}</div>
      ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ""}
    </div>`;
  back.addEventListener("click", (e) => { if (e.target === back) closeModal(); });
  document.body.appendChild(back);
  return back;
}
function confirmAction(message, onConfirm, opts = {}) {
  openModal({
    title: opts.title || "Please confirm",
    bodyHTML: `<p>${esc(message)}</p>${opts.extraHTML || ""}`,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" id="confirmBtn">${opts.confirmLabel || "Confirm"}</button>`
  });
  document.getElementById("confirmBtn").onclick = async () => { await onConfirm(); closeModal(); };
}

/* Two-step admin authorization for sensitive actions */
function requireAdminAuth(actionLabel, onConfirm) {
  openModal({
    title: "Administrator authorization required",
    bodyHTML: `
      <p class="msg msg-info">This action ("${esc(actionLabel)}") is sensitive and must be authorized by an Administrator.</p>
      <div class="field"><label>Administrator username or phone</label><input id="authUser" placeholder="Administrator username"></div>
      <div class="field"><label>Administrator password</label><input id="authPass" type="password"></div>
      <div id="authErr" class="msg msg-error" style="display:none"></div>
    `,
    footHTML: `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" id="authBtn">Authorize</button>`
  });
  document.getElementById("authBtn").onclick = async () => {
    const uname = document.getElementById("authUser").value.trim();
    const pass = document.getElementById("authPass").value;
    const users = await DB.all("users");
    const admin = users.find(u => (u.username.toLowerCase() === uname.toLowerCase() || u.phone === uname) && u.role === ROLES.ADMIN && u.active);
    const errEl = document.getElementById("authErr");
    if (!admin) { errEl.textContent = "No matching active Administrator account."; errEl.style.display = "block"; return; }
    const ok = await verifyPassword(pass, admin.passwordHash, admin.salt);
    if (!ok) { errEl.textContent = "Incorrect password."; errEl.style.display = "block"; return; }
    await audit(`Administrator authorization granted: ${actionLabel}`, admin.username);
    closeModal();
    onConfirm(admin);
  };
}

/* ---------------- Router ---------------- */
const Router = {
  routes: {},
  add(path, fn) { Router.routes[path] = fn; },
  async go(path) { location.hash = "#/" + path; },
  async render() {
    const hash = location.hash.replace(/^#\/?/, "") || "";
    const [path, query] = hash.split("?");
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    const container = document.getElementById("app");

    if (!Session.current) {
      const setupNeeded = await isFirstTimeSetup();
      if (setupNeeded) return renderSetupWizard(container);
      return renderLogin(container, path === "forgot");
    }
    // authenticated
    Session.resetTimer();
    const seg = path || "dashboard";
    const [page] = seg.split("/");
    renderShell(container, page, params, seg);
  }
};
window.addEventListener("hashchange", Router.render);

/* ---------------- Shell (sidebar + topbar) ---------------- */
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "🏠" },
  { key: "members", label: "Members", icon: "👥" },
  { key: "savings", label: "Savings & Shares", icon: "💰" },
  { key: "loans", label: "Loans", icon: "🏦" },
  { key: "repayments", label: "Repayments", icon: "↩️" },
  { key: "fines", label: "Fines", icon: "⚠️" },
  { key: "welfare", label: "Welfare Fund", icon: "🤝" },
  { key: "expenses", label: "Expenses", icon: "🧾" },
  { key: "meetings", label: "Meetings", icon: "📅" },
  { key: "cash", label: "Cash Management", icon: "🏛️" },
  { key: "reports", label: "Reports", icon: "📊" },
  { key: "cycles", label: "VSL Cycles", icon: "🔄" },
  { key: "backup", label: "Backup & Restore", icon: "💾" },
  { key: "audit", label: "Audit Log", icon: "🛡️", roles: [ROLES.ADMIN] },
  { key: "users", label: "Users", icon: "🔐", roles: [ROLES.ADMIN] },
  { key: "settings", label: "Settings", icon: "⚙️", roles: [ROLES.ADMIN] },
];

async function renderShell(container, page, params, fullSeg) {
  const profile = await DB.getSetting("groupProfile", { name: "KASVIA Group" });
  const initials = Session.current.username.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const navHTML = NAV.filter(n => !n.roles || n.roles.includes(Session.current.role)).map(n => `
    <li><a href="#/${n.key}" class="${page === n.key ? "active" : ""}" onclick="document.getElementById('sidebar').classList.remove('open')">
      <span class="navicon">${n.icon}</span>${n.label}</a></li>`).join("");

  container.innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brandmark">K</div>
        <div class="brandtext">
          <div class="k">KASVIA</div>
          <div class="sub">${esc(profile.name || "VSL Group")}</div>
        </div>
      </div>
      <ul class="navlist">${navHTML}</ul>
      <div class="sidebar-foot">
        <div class="userchip">
          <div class="avatar">${esc(initials)}</div>
          <div>
            <div style="font-weight:700;color:#fff;font-size:.85rem">${esc(Session.current.username)}</div>
            <div style="font-size:.72rem">${esc(Session.current.role)}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-block btn-sm" style="border-color:rgba(255,255,255,.25);color:#EFEBDC" onclick="doLogout()">Log out</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar noprint">
        <button class="menubtn" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button>
        <h2>${esc(NAV.find(n => n.key === page)?.label || "KASVIA")}</h2>
        <div class="spacer"></div>
        <div class="searchbox"><input id="globalSearch" placeholder="Search members, loans, receipts…" onkeydown="if(event.key==='Enter')doGlobalSearch(this.value)"></div>
      </div>
      <div class="content" id="pageContent"><div class="empty">Loading…</div></div>
    </div>
  </div>`;

  const target = document.getElementById("pageContent");
  const renderer = PAGES[page] || PAGES["dashboard"];
  try { await renderer(target, params, fullSeg); }
  catch (err) {
    console.error(err);
    target.innerHTML = `<div class="msg msg-error">Something went wrong loading this page: ${esc(err.message)}</div>`;
  }
}

async function doLogout() {
  await audit("Logout");
  Session.end();
  Router.go("login");
}

async function doGlobalSearch(q) {
  if (!q.trim()) return;
  Router.go("search?q=" + encodeURIComponent(q.trim()));
}

/* ---------------- Generic list/table renderer with search+filter ---------------- */
function renderTable({ columns, rows, rowActions, emptyText = "No records yet." }) {
  if (!rows.length) return `<div class="empty"><div class="big">🗂️</div>${esc(emptyText)}</div>`;
  const head = columns.map(c => `<th class="${c.right ? "right" : ""}">${esc(c.label)}</th>`).join("") + (rowActions ? `<th class="right">Actions</th>` : "");
  const body = rows.map(r => {
    const cells = columns.map(c => `<td class="${c.right ? "right mono" : ""}">${c.render ? c.render(r) : esc(r[c.key] ?? "")}</td>`).join("");
    const actions = rowActions ? `<td class="right">${rowActions(r)}</td>` : "";
    return `<tr>${cells}${actions}</tr>`;
  }).join("");
  return `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function statCard(label, value, opts = {}) {
  return `<div class="stat-card"><div class="label">${esc(label)}</div><div class="value ${opts.cls || ""}">${value}</div>${opts.sub ? `<div class="sub">${opts.sub}</div>` : ""}</div>`;
}

function statusBadge(status) {
  const cls = {
    Pending: "badge-pending", Approved: "badge-approved", Rejected: "badge-rejected",
    Disbursed: "badge-disbursed", Active: "badge-active", "Fully Paid": "badge-paid",
    Defaulted: "badge-defaulted", Overdue: "badge-overdue", Voided: "badge-voided", Reversed: "badge-voided"
  }[status] || "badge-pending";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

/* ---------------- Generic field-driven form builder ---------------- */
function buildFormFields(fields, values = {}) {
  return fields.map(f => {
    const v = values[f.key] ?? f.default ?? "";
    const req = f.required ? "required" : "";
    let input;
    if (f.type === "select") {
      const opts = (typeof f.options === "function" ? f.options() : f.options)
        .map(o => `<option value="${esc(o.value ?? o)}" ${String(v) === String(o.value ?? o) ? "selected" : ""}>${esc(o.label ?? o)}</option>`).join("");
      input = `<select id="f_${f.key}" ${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ""}${opts}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea id="f_${f.key}" rows="${f.rows || 3}" ${req}>${esc(v)}</textarea>`;
    } else {
      input = `<input id="f_${f.key}" type="${f.type || "text"}" value="${esc(v)}" ${req} ${f.step ? `step="${f.step}"` : ""} ${f.min !== undefined ? `min="${f.min}"` : ""} placeholder="${esc(f.placeholder || "")}">`;
    }
    return `<div class="field"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</div>`;
  }).join("");
}
function readFormFields(fields) {
  const out = {};
  fields.forEach(f => {
    const el = document.getElementById("f_" + f.key);
    if (!el) return;
    let val = el.value;
    if (f.type === "number") val = val === "" ? null : Number(val);
    out[f.key] = val;
  });
  return out;
}
