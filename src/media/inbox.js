// صندوق الوارد المشترك بين برامجك (على نفس النطاق shaari01.github.io):
// برنامج الصوت يرسل أصواتًا، وبرنامج الصور المتحركة يرسل حركات، فتظهر هنا للاستيراد.
const DB = 'shared-media-inbox';
const STORE = 'items';

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function listInbox(type = null) {
  try {
    const db = await open();
    const items = await p(db.transaction(STORE).objectStore(STORE).getAll());
    db.close();
    return items.filter((i) => !type || i.type === type || (type === 'visual' && ['image', 'video', 'anim', 'gif'].includes(i.type))).sort((a, b) => (b.created || 0) - (a.created || 0));
  } catch (e) { return []; }
}
export async function removeInbox(id) {
  const db = await open();
  await p(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  db.close();
}
export async function putInbox(item) { // للاختبارات وللإرسال إلى البرامج الأخرى
  const db = await open();
  await p(db.transaction(STORE, 'readwrite').objectStore(STORE).put(item));
  db.close();
  try { new BroadcastChannel(DB).postMessage({ type: 'new-item', id: item.id }); } catch (e) {}
}
export function onInbox(fn) {
  try { const bc = new BroadcastChannel(DB); bc.onmessage = (e) => fn(e.data); return () => bc.close(); } catch (e) { return () => {}; }
}
export const APP_LABEL = { sada: 'برنامج الصوت', haraka: 'برنامج الصور المتحركة', suwar: 'برنامج الصور', midad: 'برنامج الخط' };
