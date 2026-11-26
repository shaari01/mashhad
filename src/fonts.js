// الخطوط المدمجة (نفس خطوط برنامج الخط، ملف 01): تُحمَّل مع البرنامج وتعمل بلا إنترنت،
// ولا يُثبَّت شيء على الجهاز. كلها بترخيص SIL OFL.
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-700.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/aref-ruqaa/arabic-400.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import '@fontsource/noto-nastaliq-urdu/arabic-400.css';
import '@fontsource/noto-nastaliq-urdu/arabic-700.css';
import '@fontsource/el-messiri/arabic-400.css';
import '@fontsource/el-messiri/arabic-700.css';
import '@fontsource/reem-kufi/arabic-400.css';
import '@fontsource/reem-kufi/arabic-700.css';
import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/jomhuria/arabic-400.css';

export { FONTS, fontInfo } from './fontlist.js';

// تحميل خط قبل الرسم (للتصدير خاصة)
const loaded = new Set();
export async function ensureFont(id, weight = 400, sample = 'أبجد هوز') {
  const k = id + weight;
  if (loaded.has(k)) return;
  try { await document.fonts.load(`${weight} 40px "${id}"`, sample); } catch (e) {}
  loaded.add(k);
}
export async function ensureProjectFonts(p) {
  const list = new Set((p.texts || []).map((t) => `${t.font || 'Cairo'}|${t.bold ? 700 : 400}`));
  if (p.lyrics?.style) list.add(`${p.lyrics.style.font || 'Cairo'}|${p.lyrics.style.bold ? 700 : 400}`);
  await Promise.all([...list].map((s) => { const [f, w] = s.split('|'); return ensureFont(f, +w); }));
}
