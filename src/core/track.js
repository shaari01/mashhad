// تتبع الحركة: مطابقة قالب (Template Matching) بمجموع الفروق المطلقة على صور رمادية صغيرة.
// دوال صافية قابلة للاختبار؛ فك ترميز الإطارات في engine/export.js.

// تحويل RGBA إلى رمادي
export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return g;
}

// قص رقعة حول (cx, cy) بنصف قطر half
export function patchAt(gray, w, h, cx, cy, half) {
  const n = half * 2 + 1;
  const p = new Float32Array(n * n);
  for (let y = -half, k = 0; y <= half; y++) {
    const yy = Math.min(h - 1, Math.max(0, cy + y));
    for (let x = -half; x <= half; x++, k++) p[k] = gray[yy * w + Math.min(w - 1, Math.max(0, cx + x))];
  }
  return p;
}

// البحث عن أفضل موضع للرقعة في الإطار الجديد حول (cx, cy) ضمن نصف قطر radius
// تُطرح متوسطات السطوع ليتحمل تغير الإضاءة. يعيد {x, y, err} (err: متوسط الفرق لكل بكسل)
export function matchPatch(patch, half, gray, w, h, cx, cy, radius) {
  const n = half * 2 + 1;
  let pm = 0;
  for (let i = 0; i < patch.length; i++) pm += patch[i];
  pm /= patch.length;
  let best = { x: cx, y: cy, err: Infinity };
  const x0 = Math.max(half, cx - radius), x1 = Math.min(w - 1 - half, cx + radius);
  const y0 = Math.max(half, cy - radius), y1 = Math.min(h - 1 - half, cy + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let m = 0;
      for (let yy = -half; yy <= half; yy++) { const row = (y + yy) * w + x; for (let xx = -half; xx <= half; xx++) m += gray[row + xx]; }
      m /= patch.length;
      let s = 0;
      outer: for (let yy = -half, k = 0; yy <= half; yy++) {
        const row = (y + yy) * w + x;
        for (let xx = -half; xx <= half; xx++, k++) { s += Math.abs(gray[row + xx] - m - (patch[k] - pm)); }
        if (s >= best.err * patch.length) break outer;
      }
      const e = s / patch.length;
      // تفضيل الحركة الأقل عند التساوي
      const pen = e + 0.002 * ((x - cx) ** 2 + (y - cy) ** 2);
      if (pen < best.err) best = { x, y, err: pen };
    }
  }
  if (best.err === Infinity) best = { x: cx, y: cy, err: Infinity };
  return best;
}

// تتبع نقطة عبر سلسلة إطارات رمادية. start: {x, y} بنسبة من العرض والارتفاع.
// يعيد [{x, y, lost}] بنسب، بطول الإطارات. الرقعة تتجدد تدريجيًا لتحتمل تغير الشكل.
export function trackSequence(frames, w, h, start, opts = {}) {
  const half = Math.max(3, Math.round((opts.patch ?? 0.07) * Math.min(w, h)));
  const radius = Math.max(4, Math.round((opts.search ?? 0.12) * Math.min(w, h)));
  const maxErr = opts.maxErr ?? 28;
  let cx = Math.round(start.x * (w - 1)), cy = Math.round(start.y * (h - 1));
  let patch = patchAt(frames[0], w, h, cx, cy, half);
  const out = [{ x: cx / (w - 1), y: cy / (h - 1), lost: false }];
  let lost = false;
  for (let i = 1; i < frames.length; i++) {
    if (!lost) {
      const m = matchPatch(patch, half, frames[i], w, h, cx, cy, radius);
      if (m.err > maxErr) lost = true;
      else {
        cx = m.x; cy = m.y;
        const np = patchAt(frames[i], w, h, cx, cy, half);
        for (let k = 0; k < patch.length; k++) patch[k] = patch[k] * 0.6 + np[k] * 0.4;
      }
    }
    out.push({ x: cx / (w - 1), y: cy / (h - 1), lost });
  }
  return out;
}

// تنعيم المسار (متوسط متحرك) لإزالة الارتعاش
export function smoothTrack(pts, k = 2) {
  return pts.map((p, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) { sx += pts[j].x; sy += pts[j].y; n++; }
    return { ...p, x: sx / n, y: sy / n };
  });
}
