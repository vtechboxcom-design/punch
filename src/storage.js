// Persistent local storage backed by IndexedDB.
//
// This gives the app a real on-device database: data written here survives
// closing the tab, closing the browser, restarting the device, and reopening
// the app later. It is NOT sent to any server — everything stays in this
// browser's IndexedDB storage for this site's origin.
//
// Two caveats worth knowing about (true of any browser storage, not specific
// to this app):
//  - Data lives in this browser, on this device. It will not appear if you
//    open the app in a different browser or on a different device, unless
//    you add your own sync/export feature later.
//  - Browsers can clear site data if the user explicitly clears browsing
//    data/history, or (rarely) under extreme device storage pressure. Normal
//    restarts, force-closes, or turning the device off do NOT clear it.

const DB_NAME = "punch-app-db";
const STORE_NAME = "kv";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function withStore(mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const storage = {
  // Signature matches the Claude-artifact window.storage API (key, shared) so
  // the app code that was written against that API works unchanged. The
  // `shared` flag has no meaning for a single-device local app and is ignored.
  async get(key /*, shared */) {
    const value = await withStore("readonly", (store) => store.get(key));
    if (value === undefined) {
      throw new Error(`Key not found: ${key}`);
    }
    return { key, value, shared: false };
  },

  async set(key, value /*, shared */) {
    await withStore("readwrite", (store) => store.put(value, key));
    return { key, value, shared: false };
  },

  async delete(key /*, shared */) {
    await withStore("readwrite", (store) => store.delete(key));
    return { key, deleted: true, shared: false };
  },

  async list(prefix = "" /*, shared */) {
    const allKeys = await withStore("readonly", (store) => store.getAllKeys());
    const keys = allKeys.filter((k) => typeof k === "string" && k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
