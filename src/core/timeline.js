// حسابات الزمن: مدة كل مقطع بعد السرعة والمنحنى، ومواضع المقاطع مع الانتقالات،
// وتحويل زمن الخط الزمني إلى زمن داخل الملف الأصلي. دوال صافية قابلة للاختبار.

export const MIN_CLIP = 0.1; // أقصر مقطع مسموح (ثانية)
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

// منحنيات السرعة: مضاعِف السرعة على طول المقطع (من 0 إلى 1 في الملف الأصلي)
export const CURVES = {
  none: { label: 'بلا منحنى', pts: [1, 1] },
  slowfast: { label: 'بطيء ثم سريع', pts: [0.4, 0.6, 1.4, 2.2] },
  fastslow: { label: 'سريع ثم بطيء', pts: [2.2, 1.4, 0.6, 0.4] },
  bullet: { label: 'لقطة مثيرة', pts: [1.6, 1.6, 0.3, 0.3, 1.6, 1.6] },
  montage: { label: 'مونتاج', pts: [1.8, 0.5, 1.8, 0.5, 1.8] },
  jump: { label: 'قفزة', pts: [1, 3, 0.35, 3, 1] },
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function curveAt(pts, u) {
  if (pts.length === 1) return pts[0];
  const x = clamp(u, 0, 1) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(x));
  const f = x - i;
  return pts[i] * (1 - f) + pts[i + 1] * f;
}

const N = 96; // دقة جدول المنحنى
const tableCache = new Map();

// جدول تراكمي: لكل نقطة u في المصدر، كم ثانية من الإخراج انقضت (لكل ثانية مصدر)
function curveTable(curve) {
  if (tableCache.has(curve)) return tableCache.get(curve);
  const pts = (CURVES[curve] || CURVES.none).pts;
  const T = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const um = (i - 0.5) / N;
    T[i] = T[i - 1] + 1 / N / curveAt(pts, um);
  }
  tableCache.set(curve, T);
  return T;
}

export function srcLength(clip) {
  if (clip.type === 'image' || clip.type === 'freeze') return 0;
  return Math.max(0, clip.out - clip.in);
}

export function clipDuration(clip) {
  if (clip.type === 'image' || clip.type === 'freeze') return Math.max(MIN_CLIP, clip.duration || 0);
  const L = srcLength(clip);
  const s = clamp(clip.speed || 1, SPEED_MIN, SPEED_MAX);
  if (!clip.curve || clip.curve === 'none') return L / s;
  return (L * curveTable(clip.curve)[N]) / s;
}

// السرعة اللحظية (للمعاينة والصوت)
export function speedAt(clip, localT) {
  const s = clamp(clip.speed || 1, SPEED_MIN, SPEED_MAX);
  if (!clip.curve || clip.curve === 'none') return s;
  const u = progressToSrcU(clip, localT);
  return s * curveAt((CURVES[clip.curve] || CURVES.none).pts, u);
}

// من زمن محلي في المقطع (إخراج) إلى نسبة u في المصدر
function progressToSrcU(clip, localT) {
  const D = clipDuration(clip);
  if (D <= 0) return 0;
  const p = clamp(localT / D, 0, 1);
  if (!clip.curve || clip.curve === 'none') return p;
  const T = curveTable(clip.curve);
  const target = p * T[N];
  let lo = 0, hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (T[mid] <= target) lo = mid; else hi = mid;
  }
  const seg = T[hi] - T[lo];
  const f = seg > 0 ? (target - T[lo]) / seg : 0;
  return (lo + f) / N;
}

// زمن الملف الأصلي المقابل لزمن محلي داخل المقطع
export function sourceTime(clip, localT) {
  if (clip.type === 'freeze') return clip.freezeAt || 0;
  if (clip.type === 'image') return 0;
  const u = progressToSrcU(clip, localT);
  const L = srcLength(clip);
  return clip.reverse ? clip.out - u * L : clip.in + u * L;
}

// عكس العملية: زمن محلي من زمن مصدر (للتقسيم عند موضع في الملف)
export function localTimeForSource(clip, src) {
  const L = srcLength(clip);
  if (L <= 0) return 0;
  let u = clip.reverse ? (clip.out - src) / L : (src - clip.in) / L;
  u = clamp(u, 0, 1);
  const D = clipDuration(clip);
  if (!clip.curve || clip.curve === 'none') return u * D;
  const T = curveTable(clip.curve);
  const x = u * N, i = Math.min(N - 1, Math.floor(x));
  return ((T[i] + (T[i + 1] - T[i]) * (x - i)) / T[N]) * D;
}

export function transitionDur(clips, i) {
  const a = clips[i], b = clips[i + 1];
  if (!a || !b || !a.transition || a.transition.type === 'none') return 0;
  const maxD = Math.min(clipDuration(a), clipDuration(b)) / 2;
  return clamp(a.transition.dur || 0.5, 0, maxD);
}

// مواضع المقاطع على الخط الزمني، مع تداخل الانتقالات
export function layout(project) {
  const clips = project.clips;
  const items = [];
  let t = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clipDuration(clips[i]);
    const tin = i > 0 ? transitionDur(clips, i - 1) : 0;
    const start = i === 0 ? 0 : t - tin;
    items.push({ clip: clips[i], index: i, start, end: start + d, dur: d, transIn: tin, transOut: transitionDur(clips, i) });
    t = start + d;
  }
  return { items, duration: t };
}

export function projectDuration(project) {
  return layout(project).duration;
}

// المقاطع الظاهرة عند زمن t (واحد عادة، واثنان أثناء الانتقال)
export function activeAt(lay, t) {
  const res = [];
  for (const it of lay.items) {
    if (t >= it.start && t < it.end) res.push(it);
  }
  if (!res.length && lay.items.length && t >= lay.duration) res.push(lay.items[lay.items.length - 1]);
  return res;
}

// المقطع الموجود تحت المؤشر (الأحدث عند التداخل)
export function itemAt(lay, t) {
  const a = activeAt(lay, t);
  return a[a.length - 1] || null;
}

export function clipStart(project, clipId) {
  const it = layout(project).items.find((x) => x.clip.id === clipId);
  return it ? it.start : 0;
}

// الالتصاق بعلامات الإيقاع
export function snap(t, beats, tolerance = 0.15) {
  if (!beats || !beats.length) return t;
  let best = t, bd = tolerance;
  for (const b of beats) {
    const d = Math.abs(b - t);
    if (d <= bd) { bd = d; best = b; }
  }
  return best;
}

export function fmtTime(s, withMs = false) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const ss = withMs ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return `${m}:${ss}`;
}
