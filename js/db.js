// Basit IndexedDB anahtar-değer deposu. Tarayıcıdaki yerel kopya burada durur.
const DB_NAME = 'besin-takip';
const STORE = 'kv';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export function idbGet(key) {
  return tx('readonly', store => new Promise(res => {
    const r = store.get(key);
    r.onsuccess = () => res(r.result);
  }));
}

export function idbSet(key, value) {
  return tx('readwrite', store => { store.put(value, key); });
}

export function idbDel(key) {
  return tx('readwrite', store => { store.delete(key); });
}

export function idbAll() {
  return tx('readonly', store => new Promise(res => {
    const out = new Map();
    const r = store.openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) { out.set(c.key, c.value); c.continue(); } else res(out);
    };
  }));
}
