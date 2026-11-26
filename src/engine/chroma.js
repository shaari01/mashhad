// إزالة الخلفية الخضراء (Chroma Key): حساب الشفافية من بُعد لون البكسل عن لون المفتاح
// في فضاء الألوان YCbCr (يتجاهل الإضاءة فيعمل مع الظلال على الشاشة الخضراء).
const pool = new Map();
function canvasFor(key, w, h) {
  let c = pool.get(key);
  if (!c) { c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); pool.set(key, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#00ff00');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 255, 0];
}

const cb = (r, g, b) => -0.168736 * r - 0.331264 * g + 0.5 * b;
const cr = (r, g, b) => 0.5 * r - 0.418688 * g - 0.081312 * b;

// تعديل بيانات بكسلات مباشرة (دالة صافية قابلة للاختبار)
export function keyPixels(data, key, tol = 0.3, soft = 0.12, spill = true) {
  const [kr, kg, kb] = key;
  const kcb = cb(kr, kg, kb), kcr = cr(kr, kg, kb);
  const t0 = tol * 180, t1 = (tol + soft) * 180;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = Math.hypot(cb(r, g, b) - kcb, cr(r, g, b) - kcr);
    let a = d <= t0 ? 0 : d >= t1 ? 1 : (d - t0) / (t1 - t0);
    data[i + 3] = Math.round(data[i + 3] * a);
    // إزالة الانعكاس الأخضر على الحواف
    if (spill && a > 0 && kg > kr && kg > kb) { const lim = Math.max(r, b); if (g > lim) data[i + 1] = lim + (g - lim) * (1 - (1 - a) * 0.9) * 0.5; }
  }
  return data;
}

export function chromaKey(img, w, h, opts, maxW = 480) {
  const s = Math.min(1, maxW / w);
  const cw = Math.max(2, Math.round(w * s)), ch = Math.max(2, Math.round(h * s));
  const c = canvasFor(cw + 'x' + ch, cw, ch);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, cw, ch);
  g.drawImage(img, 0, 0, cw, ch);
  const id = g.getImageData(0, 0, cw, ch);
  keyPixels(id.data, hexToRgb(opts.color), opts.tol ?? 0.3, opts.soft ?? 0.12);
  g.putImageData(id, 0, 0);
  return c;
}
