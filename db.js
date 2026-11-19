/* ==========================================================================
   KASVIA — db.js
   IndexedDB wrapper. 100% local. No network calls anywhere in this file.
   ========================================================================== */
const DB_NAME = "kasvia_vsl_db";
const DB_VERSION = 1;

const STORES = [
  "settings",      // key/value: 'groupProfile','savingsSettings','loanSettings','counters','currentCycleId'
  "users",
  "members",
  "savings",
  "shares",
  "loans",
  "repayments",
  "fines",
  "welfare",
  "expenses",
  "meetings",
  "auditLogs",
  "cycles",
  "alerts"
];

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (name === "settings") return;
          store.createIndex("byCreatedAt", "createdAt", { unique: false });
        }
      });
      // extra indexes
      const tryIndex = (storeName, idxName, key) => {
        const store = e.target.transaction.objectStore(storeName);
        if (!store.indexNames.contains(idxName)) store.createIndex(idxName, key, { unique: false });
      };
      tryIndex("members", "byPhone", "phone");
      tryIndex("savings", "byMember", "memberId");
      tryIndex("loans", "byMember", "memberId");
      tryIndex("repayments", "byLoan", "loanId");
      tryIndex("fines", "byMember", "memberId");
      tryIndex("welfare", "byMember", "memberId");
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeNames, mode = "readonly") {
  return _db.transaction(storeNames, mode);
}

const DB = {
  async init() { if (!_db) await openDB(); return _db; },

  put(store, value) {
    return new Promise((resolve, reject) => {
      const t = tx([store], "readwrite");
      t.objectStore(store).put(value);
      t.oncomplete = () => resolve(value);
      t.onerror = (e) => reject(e.target.error);
    });
  },
  get(store, id) {
    return new Promise((resolve, reject) => {
      const t = tx([store], "readonly");
      const r = t.objectStore(store).get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = (e) => reject(e.target.error);
    });
  },
  delete(store, id) {
    return new Promise((resolve, reject) => {
      const t = tx([store], "readwrite");
      t.objectStore(store).delete(id);
      t.oncomplete = () => resolve(true);
      t.onerror = (e) => reject(e.target.error);
    });
  },
  all(store) {
    return new Promise((resolve, reject) => {
      const t = tx([store], "readonly");
      const r = t.objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = (e) => reject(e.target.error);
    });
  },
  async byIndex(store, indexName, value) {
    return new Promise((resolve, reject) => {
      const t = tx([store], "readonly");
      const idx = t.objectStore(store).index(indexName);
      const r = idx.getAll(value);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = (e) => reject(e.target.error);
    });
  },
  async clearAll() {
    return new Promise((resolve, reject) => {
      const t = tx(STORES, "readwrite");
      STORES.forEach((s) => t.objectStore(s).clear());
      t.oncomplete = () => resolve(true);
      t.onerror = (e) => reject(e.target.error);
    });
  },
  // settings are simple key/value docs {id:key, value:...}
  async getSetting(key, fallback = null) {
    const rec = await DB.get("settings", key);
    return rec ? rec.value : fallback;
  },
  async setSetting(key, value) {
    return DB.put("settings", { id: key, value });
  },
  async exportAll() {
    const dump = {};
    for (const s of STORES) dump[s] = await DB.all(s);
    dump.__meta = { app: "KASVIA", version: DB_VERSION, exportedAt: new Date().toISOString() };
    return dump;
  },
  async importAll(dump) {
    await DB.clearAll();
    for (const s of STORES) {
      if (Array.isArray(dump[s])) {
        for (const rec of dump[s]) await DB.put(s, rec);
      }
    }
    return true;
  }
};
