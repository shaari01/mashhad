// الترجمة التلقائية: تحويل نتيجة خدمة التفريغ (أو ملف SRT/VTT) إلى نصوص على الفيديو. دوال صافية.
import { newText } from '../engine/text.js';

const ts = (s) => {
  const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s.trim());
  if (!m) return NaN;
  return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +('0.' + m[4]);
};

// قراءة SRT أو WebVTT
export function parseSubtitles(src) {
  const out = [];
  const blocks = String(src).replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lines[i].split('-->');
    const start = ts(a), end = ts(z.trim().split(/\s+/)[0]);
    const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text && isFinite(start) && isFinite(end) && end > start) out.push({ start, end, text });
  }
  return out;
}

// تقسيم المقاطع الطويلة إلى أسطر قصيرة تناسب الجوال (حد الكلمات)، مع توزيع الزمن بالنسبة لعدد الحروف
export function splitSegments(segs, maxWords = 7) {
  const out = [];
  for (const s of segs) {
    const words = String(s.text).trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) { if (words.length) out.push({ start: s.start, end: s.end, text: words.join(' ') }); continue; }
    const parts = Math.ceil(words.length / maxWords);
    const per = Math.ceil(words.length / parts);
    const chunks = [];
    for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per).join(' '));
    const total = chunks.reduce((a, c) => a + c.length, 0);
    let t = s.start;
    for (const c of chunks) { const d = ((s.end - s.start) * c.length) / total; out.push({ start: t, end: t + d, text: c }); t += d; }
  }
  return out;
}

// نتيجة الخدمة: verbose_json {segments:[{start,end,text}]} أو {text} أو SRT/VTT نصًا
export function segmentsFromResponse(r, duration = 0) {
  if (typeof r === 'string') {
    const s = r.trim();
    if (s.includes('-->')) return parseSubtitles(s);
    try { return segmentsFromResponse(JSON.parse(s), duration); } catch { return s ? [{ start: 0, end: Math.max(1, duration), text: s }] : []; }
  }
  if (Array.isArray(r?.segments) && r.segments.length) return r.segments.map((x) => ({ start: +x.start, end: +x.end, text: String(x.text || '').trim() })).filter((x) => x.text);
  if (r?.text) return [{ start: 0, end: Math.max(1, duration), text: String(r.text).trim() }];
  return [];
}

export const CAPTION_STYLE = { font: 'Cairo', size: 0.06, color: '#ffffff', y: 0.84, bg: { color: '#000000', opacity: 0.55 }, stroke: { color: '#000000', width: 0 }, animIn: 'fade', animOut: 'none', animDur: 0.15 };

// استبدال الترجمات القديمة بالجديدة (offset: زمن بدء المصدر في الخط الزمني)
export function applyCaptions(p, segs, style = CAPTION_STYLE, offset = 0) {
  p.texts = (p.texts || []).filter((t) => !t.caption);
  for (const s of splitSegments(segs)) p.texts.push(newText({ ...style, text: s.text, start: s.start + offset, end: s.end + offset, caption: true }));
  return p;
}

// إخراج SRT لحفظ الترجمة أو رفعها مع الفيديو
export function toSRT(texts) {
  const f = (t) => { const ms = Math.round(t * 1000); const p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  return texts.filter((t) => t.caption).sort((a, b) => a.start - b.start).map((t, i) => `${i + 1}\n${f(t.start)} --> ${f(t.end)}\n${t.text}\n`).join('\n');
}
