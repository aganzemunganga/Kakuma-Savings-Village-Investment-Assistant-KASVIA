/* ==========================================================================
   KASVIA — auth.js
   Roles, session handling, login lockout, auto-logout, first-time setup.
   ========================================================================== */
const ROLES = {
  ADMIN: "Administrator",
  TREASURER: "Treasurer",
  SECRETARY: "Secretary"
};

// Permission map: which roles can do which action keys
const PERMS = {
  members_create: [ROLES.ADMIN, ROLES.SECRETARY],
  members_edit: [ROLES.ADMIN, ROLES.SECRETARY],
  members_deactivate: [ROLES.ADMIN],
  savings_record: [ROLES.ADMIN, ROLES.TREASURER],
  savings_void: [ROLES.ADMIN],
  loans_apply: [ROLES.ADMIN, ROLES.SECRETARY, ROLES.TREASURER],
  loans_approve: [ROLES.ADMIN],
  loans_disburse: [ROLES.ADMIN, ROLES.TREASURER],
  repayments_record: [ROLES.ADMIN, ROLES.TREASURER],
  fines_record: [ROLES.ADMIN, ROLES.TREASURER],
  welfare_record: [ROLES.ADMIN, ROLES.TREASURER],
  expenses_record: [ROLES.ADMIN, ROLES.TREASURER],
  meetings_record: [ROLES.ADMIN, ROLES.SECRETARY],
  reports_view: [ROLES.ADMIN, ROLES.TREASURER, ROLES.SECRETARY],
  reports_financial: [ROLES.ADMIN, ROLES.TREASURER],
  backup_create: [ROLES.ADMIN],
  backup_restore: [ROLES.ADMIN],
  users_manage: [ROLES.ADMIN],
  settings_manage: [ROLES.ADMIN],
  cycles_manage: [ROLES.ADMIN],
  audit_view: [ROLES.ADMIN],
  transactions_delete: [], // nobody — void/reverse only
};
function can(actionKey) {
  if (!Session.current) return false;
  const allowed = PERMS[actionKey] || [];
  return allowed.includes(Session.current.role);
}
function requireRole(...roles) {
  return Session.current && roles.includes(Session.current.role);
}

const AUTOLOGOUT_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

const Session = {
  current: null,
  timer: null,

  start(user) {
    Session.current = user;
    localStorage.setItem("kasvia_session", JSON.stringify({ id: user.id, at: Date.now() }));
    Session.resetTimer();
    ["click", "keydown", "mousemove", "touchstart"].forEach(ev =>
      document.addEventListener(ev, Session.resetTimer, { passive: true })
    );
  },
  resetTimer() {
    clearTimeout(Session.timer);
    Session.timer = setTimeout(() => Session.expire(), AUTOLOGOUT_MS);
  },
  async expire() {
    if (!Session.current) return;
    await audit("Auto-logout due to inactivity", Session.current.username);
    Session.end();
    toast("Session expired due to inactivity. Please log in again.", "err");
    Router.go("login");
  },
  end() {
    Session.current = null;
    clearTimeout(Session.timer);
    localStorage.removeItem("kasvia_session");
  }
};

/* ---------- Login attempt tracking (per-username, persisted in localStorage) ---------- */
function getLoginAttempts(username) {
  try { return JSON.parse(localStorage.getItem("kasvia_attempts_" + username) || "null") || { count: 0, lockedUntil: 0 }; }
  catch (e) { return { count: 0, lockedUntil: 0 }; }
}
function setLoginAttempts(username, data) {
  localStorage.setItem("kasvia_attempts_" + username, JSON.stringify(data));
}
function clearLoginAttempts(username) {
  localStorage.removeItem("kasvia_attempts_" + username);
}

async function attemptLogin(username, password) {
  const uname = username.trim();
  const attempts = getLoginAttempts(uname);
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const secs = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    await raiseAlert("login_locked", `Login blocked for "${uname}" — too many failed attempts (${secs}s remaining).`, "danger");
    return { ok: false, error: `Too many failed attempts. Try again in ${Math.ceil(secs / 60)} min.` };
  }
  const users = await DB.all("users");
  const user = users.find(u => u.username.toLowerCase() === uname.toLowerCase() || u.phone === uname);
  if (!user || !user.active) {
    attempts.count++;
    if (attempts.count >= LOCKOUT_ATTEMPTS) attempts.lockedUntil = Date.now() + LOCKOUT_MS;
    setLoginAttempts(uname, attempts);
    await raiseAlert("login_failed", `Failed login attempt for unknown/inactive username "${uname}".`, "warning");
    return { ok: false, error: "Invalid username/phone or password." };
  }
  const valid = await verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    attempts.count++;
    if (attempts.count >= LOCKOUT_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_MS;
      await raiseAlert("login_locked", `Account "${uname}" locked for 5 minutes after ${LOCKOUT_ATTEMPTS} failed attempts.`, "danger");
    }
    setLoginAttempts(uname, attempts);
    await raiseAlert("login_failed", `Failed login attempt for "${uname}".`, "warning");
    return { ok: false, error: "Invalid username/phone or password." };
  }
  clearLoginAttempts(uname);
  await audit("Login success", user.username);
  Session.start(user);
  return { ok: true, user };
}

async function isFirstTimeSetup() {
  const users = await DB.all("users");
  return users.length === 0;
}

async function tryResumeSession() {
  try {
    const raw = localStorage.getItem("kasvia_session");
    if (!raw) return false;
    const { id } = JSON.parse(raw);
    const user = await DB.get("users", id);
    if (user && user.active) { Session.start(user); return true; }
  } catch (e) {}
  return false;
}
