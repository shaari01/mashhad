// خطوطك: استيراد ملف خط (TTF أو OTF أو WOFF) يُحفظ داخل البرنامج ويعمل بلا إنترنت، وحذفه.
import * as db from '../storage/db.js';
import { FONTS } from '../fontlist.js';

const KEY = 'userFonts';
async function list() { return (await db.get('kv', KEY)) || []; }

async function register(f) {
  try {
    const face = new FontFace(f.id, await f.blob.arrayBuffer());
    await face.load();
    document.fonts.add(face);
  } catch (e) { return false; }
  if (!FONTS.some((x) => x.id === f.id)) FONTS.push({ id: f.id, label: f.label, kind: 'خطك', user: true, bold: false });
  return true;
}

export async function loadUserFonts() {
  for (const f of await list()) await register(f);
}

export async function addFontFile(file) {
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').slice(0, 40) || 'خطي';
  const f = { id: 'u-' + Math.random().toString(36).slice(2, 9), label, blob: file, createdAt: Date.now() };
  if (!(await register(f))) throw new Error('هذا الملف ليس خطًا صالحًا');
  await db.put('kv', [...(await list()), f], KEY);
  return f;
}

export async function removeFont(id) {
  await db.put('kv', (await list()).filter((f) => f.id !== id), KEY);
  const i = FONTS.findIndex((x) => x.id === id);
  if (i >= 0) FONTS.splice(i, 1);
  for (const face of document.fonts) if (face.family === id || face.family === `"${id}"`) document.fonts.delete(face);
}
