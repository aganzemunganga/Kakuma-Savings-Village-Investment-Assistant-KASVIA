/* KASVIA automated tests — run with:  npm test
   Loads the real app scripts (app/*.js) into a sandbox with an in-memory
   IndexedDB (fake-indexeddb) and Node's built-in Web Crypto, so the actual
   production code is exercised without a browser or any network access. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");

const store = {};
const ctx = vm.createContext({
  indexedDB, IDBKeyRange, console,
  crypto: globalThis.crypto, TextEncoder, TextDecoder, Date, Math, JSON, Promise,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, removeEventListener() {} },
  window: {}, setTimeout, clearTimeout,
});
for (const f of ["util.js", "db.js", "auth.js", "loans.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), ctx, { filename: f });
}
const run = (code) => vm.runInContext(code, ctx);

test("flat interest: KSh 10,000 at 10% -> 1,000 interest, 11,000 total", () => {
  const r = run(`calcLoanInterest(10000, 10, "Flat interest", 3)`);
  assert.equal(r.interest, 1000);
  assert.equal(r.total, 11000);
});

test("declining balance: 10,000 at 10% over 4 periods -> 2,500 interest", () => {
  const r = run(`calcLoanInterest(10000, 10, "Declining balance", 4)`);
  assert.equal(r.interest, 2500); // 1000 + 750 + 500 + 250
  assert.equal(r.total, 12500);
});

test("interest: zero rate and invalid input are safe", () => {
  assert.equal(run(`calcLoanInterest(5000, 0, "Flat interest", 1)`).total, 5000);
  assert.equal(run(`calcLoanInterest("abc", "x", "Flat interest", 1)`).total, 0);
});

test("password strength rule: 8+ chars with a letter and a number", () => {
  assert.ok(run(`passwordStrengthOk("Secure123")`));
  assert.ok(!run(`passwordStrengthOk("short1")`));
  assert.ok(!run(`passwordStrengthOk("onlyletters")`));
  assert.ok(!run(`passwordStrengthOk("12345678")`));
});

test("passwords are salted+hashed, never stored as plain text, and verify correctly", async () => {
  const a = await run(`hashPassword("Secure123")`);
  const b = await run(`hashPassword("Secure123")`);
  assert.notEqual(a.hash, b.hash, "random salt must give different hashes");
  assert.ok(!a.hash.includes("Secure123"));
  assert.equal(a.hash.length, 64);
  assert.equal(await run(`verifyPassword("Secure123", "${a.hash}", "${a.salt}")`), true);
  assert.equal(await run(`verifyPassword("Wrong1234", "${a.hash}", "${a.salt}")`), false);
});

test("sequential, unique IDs: members, transactions, loans, receipts", async () => {
  await run(`DB.init()`);
  const year = new Date().getFullYear();
  assert.equal(await run(`genMemberId()`), "VSL-0001");
  assert.equal(await run(`genMemberId()`), "VSL-0002");
  assert.equal(await run(`genTxnId()`), `TXN-${year}-000001`);
  assert.equal(await run(`genTxnId()`), `TXN-${year}-000002`);
  assert.equal(await run(`genLoanId()`), `LOAN-${year}-000001`);
  assert.equal(await run(`genReceiptId()`), `RCT-${year}-000001`);
});

test("database: put/get/all and full export -> clear -> import round trip", async () => {
  await run(`DB.put("members", {id:"m1", name:"Amina", createdAt:"2026-01-01"})`);
  await run(`DB.put("savings", {id:"s1", memberId:"m1", amount:500, createdAt:"2026-01-02"})`);
  assert.equal((await run(`DB.get("members","m1")`)).name, "Amina");
  const dump = await run(`DB.exportAll()`);
  assert.equal(dump.__meta.app, "KASVIA");
  await run(`DB.clearAll()`);
  assert.equal((await run(`DB.all("members")`)).length, 0);
  await run(`DB.importAll(${JSON.stringify(dump)})`);
  assert.equal((await run(`DB.all("savings")`))[0].amount, 500);
  assert.equal((await run(`DB.byIndex("savings","byMember","m1")`)).length, 1);
});

test("role permissions: separation of duties", () => {
  const as = (role, key) => run(`Session.current = {role:"${role}"}; can("${key}")`);
  assert.ok(as("Administrator", "loans_approve"));
  assert.ok(!as("Treasurer", "loans_approve"));
  assert.ok(!as("Secretary", "loans_approve"));
  assert.ok(as("Treasurer", "savings_record"));
  assert.ok(!as("Secretary", "savings_record"));
  assert.ok(as("Secretary", "members_create"));
  assert.ok(!as("Treasurer", "members_create"));
  for (const r of ["Treasurer", "Secretary"]) {
    assert.ok(!as(r, "backup_restore"));
    assert.ok(!as(r, "users_manage"));
    assert.ok(!as(r, "settings_manage"));
  }
});

test("nobody can delete transactions (void/reverse only)", () => {
  for (const r of ["Administrator", "Treasurer", "Secretary"])
    assert.ok(!run(`Session.current = {role:"${r}"}; can("transactions_delete")`));
});

test("no network calls in application code", () => {
  const dir = path.join(__dirname, "..", "app");
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(!/https?:\/\/(?!localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
      `${f} references an external URL`);
    assert.ok(!/\bfetch\s*\(\s*["'`]https?:/.test(src), `${f} calls fetch() on an external URL`);
  }
});
