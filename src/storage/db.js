// غلاف بسيط لـ IndexedDB: مخازن projects و media و kv
const DB_NAME = 'maqta';
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['projects', 'media', 'kv', 'templates']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? undefined : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function put(store, value, key) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const r = key !== undefined ? t.objectStore(store).put(value, key) : t.objectStore(store).put(value);
  await reqP(r);
  return value;
}
export async function get(store, key) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).get(key));
}
export async function del(store, key) {
  const db = await open();
  return reqP(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}
export async function all(store) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).getAll());
}
