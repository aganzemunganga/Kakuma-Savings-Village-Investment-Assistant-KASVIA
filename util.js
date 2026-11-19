/* ==========================================================================
   KASVIA — util.js
   Formatting, ID generation, password hashing (Web Crypto, offline), audit log.
   ========================================================================== */
const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

function formatKES(amount) {
  const n = Number(amount || 0);
  const sign = n < 0 ? "-" : "";
  return sign + "KSh " + Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "2-digit" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt)) return "—";
  return dt.toLocaleString("en-KE", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- sequential ID generators ---------- */
async function nextCounter(key) {
  const counters = await DB.getSetting("counters", {});
  const n = (counters[key] || 0) + 1;
  counters[key] = n;
  await DB.setSetting("counters", counters);
  return n;
}
async function genMemberId() {
  const n = await nextCounter("member");
  return "VSL-" + String(n).padStart(4, "0");
}
async function genTxnId() {
  const n = await nextCounter("txn");
  return "TXN-" + new Date().getFullYear() + "-" + String(n).padStart(6, "0");
}
async function genLoanId() {
  const n = await nextCounter("loan");
  return "LOAN-" + new Date().getFullYear() + "-" + String(n).padStart(6, "0");
}
async function genReceiptId() {
  const n = await nextCounter("receipt");
  return "RCT-" + new Date().getFullYear() + "-" + String(n).padStart(6, "0");
}
async function genMeetingId() {
  const n = await nextCounter("meeting");
  return "MTG-" + String(n).padStart(4, "0");
}

/* ---------- password hashing (PBKDF2-SHA256 via SubtleCrypto, fully offline) ---------- */
function bufToHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
function hexToBuf(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  return arr.buffer;
}
async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const saltHexOut = saltHex || bufToHex(salt);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: typeof salt === "string" ? hexToBuf(salt) : salt, iterations: 120000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return { hash: bufToHex(bits), salt: saltHexOut };
}
async function verifyPassword(password, hash, salt) {
  const out = await hashPassword(password, salt);
  return out.hash === hash;
}
function passwordStrengthOk(pw) {
  return pw && pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

/* ---------- audit log ---------- */
async function audit(action, recordAffected, previousValue = null, newValue = null) {
  const user = Session.current ? `${Session.current.username} (${Session.current.role})` : "system";
  const entry = {
    id: uid(),
    user,
    userId: Session.current ? Session.current.id : null,
    action,
    date: nowISO(),
    device: navigator.userAgent.slice(0, 60),
    recordAffected: recordAffected || "",
    previousValue: previousValue ? JSON.stringify(previousValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    createdAt: nowISO()
  };
  await DB.put("auditLogs", entry);
  return entry;
}

async function raiseAlert(type, message, severity = "warning") {
  const a = { id: uid(), type, message, severity, date: nowISO(), acknowledged: false, createdAt: nowISO() };
  await DB.put("alerts", a);
  return a;
}

/* ---------- CSV export ---------- */
function toCSV(rows, columns) {
  const head = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const body = rows.map(r => columns.map(c => {
    let v = typeof c.get === "function" ? c.get(r) : r[c.key];
    v = v === undefined || v === null ? "" : String(v);
    return `"${v.replace(/"/g, '""')}"`;
  }).join(",")).join("\n");
  return head + "\n" + body;
}
function downloadFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function calcAge(dob) {
  if (!dob) return "";
  const d = new Date(dob), t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}
