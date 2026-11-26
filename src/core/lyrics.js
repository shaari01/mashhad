// كلمات الأغاني بالنقر، وعلامات الإيقاع (دوال صافية قابلة للاختبار)
import { newText } from '../engine/text.js';
import { uid } from './project.js';

export function defaultLyricStyle() {
  return { font: 'Cairo', bold: true, size: 0.075, color: '#ffffff', kcolor: '#ffd400', karaoke: true, y: 0.82, anim: 'fade', bg: false, stroke: 0.7 };
}

export function parseLyrics(text) {
  return String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((t) => ({ id: uid('lyr'), text: t, start: null, end: null }));
}

// تسجيل نقرة: السطر التالي غير الموقّت يبدأ الآن، والسابق ينتهي الآن
export function tapLine(lyrics, t) {
  const i = lyrics.lines.findIndex((l) => l.start == null);
  if (i < 0) return -1;
  lyrics.lines[i].start = t;
  if (i > 0 && (lyrics.lines[i - 1].end == null || lyrics.lines[i - 1].end > t)) lyrics.lines[i - 1].end = t;
  return i;
}

export function untapLine(lyrics) {
  let i = -1;
  for (let k = lyrics.lines.length - 1; k >= 0; k--) if (lyrics.lines[k].start != null) { i = k; break; }
  if (i < 0) return -1;
  lyrics.lines[i].start = null;
  lyrics.lines[i].end = null;
  if (i > 0) lyrics.lines[i - 1].end = null;
  return i;
}

// إغلاق آخر سطر عند نهاية الأغنية أو بعد مدة معقولة
export function finishLyrics(lyrics, endT) {
  const timed = lyrics.lines.filter((l) => l.start != null);
  for (let k = 0; k < timed.length; k++) {
    const l = timed[k];
    if (l.end == null) l.end = k < timed.length - 1 ? timed[k + 1].start : Math.max(l.start + 0.5, Math.min(endT, l.start + 6));
  }
}

// تحويل الكلمات الموقّتة إلى نصوص على الفيديو (تُستبدل نصوص الأغنية السابقة)
export function applyLyrics(p) {
  p.texts = (p.texts || []).filter((t) => !t.lyric);
  const L = p.lyrics;
  if (!L) return 0;
  const s = { ...defaultLyricStyle(), ...(L.style || {}) };
  let n = 0;
  for (const l of L.lines) {
    if (l.start == null || l.end == null || l.end <= l.start) continue;
    p.texts.push(newText({
      id: 'txt_' + l.id,
      lyric: true,
      text: l.text,
      start: l.start,
      end: l.end,
      x: 0.5,
      y: s.y,
      font: s.font,
      bold: s.bold,
      size: s.size,
      color: s.color,
      kcolor: s.kcolor,
      karaoke: s.karaoke,
      animIn: s.anim,
      animOut: s.anim === 'none' ? 'none' : 'fade',
      animDur: 0.25,
      stroke: { color: '#000000', width: s.stroke },
      bg: s.bg ? { color: '#000000', opacity: 0.5 } : null,
      shadow: true,
    }));
    n++;
  }
  return n;
}

// ———— علامات الإيقاع ————
export function addBeat(beats, t, minGap = 0.08) {
  if (beats.some((b) => Math.abs(b - t) < minGap)) return beats;
  return [...beats, t].sort((a, b) => a - b);
}

// كشف الإيقاع تلقائيًا: مغلف الطاقة ثم القمم فوق عتبة متكيفة
export function detectBeats(data, sr, { minGap = 0.3, offset = 0, from = 0, to = null } = {}) {
  const hop = Math.round(sr / 100); // 10 ms
  const a = Math.floor(from * sr), b = Math.min(data.length, to == null ? data.length : Math.floor(to * sr));
  const n = Math.floor((b - a) / hop);
  if (n < 10) return [];
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const st = a + i * hop;
    for (let j = 0; j < hop; j++) { const v = data[st + j] || 0; s += v * v; }
    env[i] = Math.sqrt(s / hop);
  }
  // تدفق الطاقة الموجب
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
  const W = 30; // نافذة 0.3 ث
  const out = [];
  let last = -1e9;
  for (let i = 1; i < n - 1; i++) {
    let mean = 0, c = 0;
    for (let k = Math.max(0, i - W); k < Math.min(n, i + W); k++) { mean += flux[k]; c++; }
    mean /= c;
    const thr = mean * 1.6 + 1e-4;
    if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      const t = (i * hop) / sr + from;
      if (t - last >= minGap) { out.push(t + offset - from); last = t; }
    }
  }
  return out;
}
