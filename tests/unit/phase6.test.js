import test from 'node:test';
import assert from 'node:assert/strict';
import { trackSequence, smoothTrack, matchPatch, patchAt } from '../../src/core/track.js';
import { parseSubtitles, splitSegments, segmentsFromResponse, applyCaptions, toSRT } from '../../src/core/captions.js';
import { keyPixels } from '../../src/engine/chroma.js';
import { newProject } from '../../src/core/project.js';
import { newOverlay, overlayPos } from '../../src/engine/overlays.js';

// إطار رمادي بخلفية مزخرفة ومربع مضيء في (x, y)
function frame(w, h, bx, by, light = 0) {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 60 + 30 * Math.sin(x * 0.7) * Math.cos(y * 0.5) + light;
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const X = bx + x, Y = by + y; if (X >= 0 && Y >= 0 && X < w && Y < h) g[Y * w + X] = (x === 0 || y === 0 ? 120 : 230) + light; }
  return g;
}

test('تتبع مربع متحرك', () => {
  const w = 120, h = 160, frames = [];
  for (let i = 0; i < 20; i++) frames.push(frame(w, h, 30 + i * 3, 40 + i * 4, i));
  const pts = trackSequence(frames, w, h, { x: 30 / (w - 1), y: 40 / (h - 1) });
  assert.equal(pts.length, 20);
  for (let i = 0; i < 20; i++) {
    assert.ok(Math.abs(pts[i].x * (w - 1) - (30 + i * 3)) <= 1.5, `x عند ${i}: ${pts[i].x * (w - 1)}`);
    assert.ok(Math.abs(pts[i].y * (h - 1) - (40 + i * 4)) <= 1.5, `y عند ${i}`);
    assert.equal(pts[i].lost, false);
  }
  const s = smoothTrack(pts, 2);
  assert.equal(s.length, 20);
});

test('فقدان الهدف يوقف التتبع', () => {
  const w = 80, h = 80;
  const a = frame(w, h, 40, 40);
  const b = new Float32Array(w * h).fill(0); for (let i = 0; i < b.length; i++) b[i] = (i * 7919) % 255; // ضجيج
  const pts = trackSequence([a, b, b], w, h, { x: 0.5, y: 0.5 }, { maxErr: 20 });
  assert.equal(pts[1].lost, true);
  assert.deepEqual([pts[2].x, pts[2].y], [pts[0].x, pts[0].y]);
});

test('مطابقة الرقعة تجد الإزاحة', () => {
  const w = 64, h = 64;
  const a = frame(w, h, 20, 20), b = frame(w, h, 26, 23);
  const p = patchAt(a, w, h, 20, 20, 6);
  const m = matchPatch(p, 6, b, w, h, 20, 20, 10);
  assert.deepEqual([m.x, m.y], [26, 23]);
});

test('الملصق المتتبَّع يتبع المسار مع الإزاحة', () => {
  const o = newOverlay({ kind: 'emoji', content: '😂', x: 0.1, y: 0.1 });
  o.track = [{ t: 0, x: 0.2, y: 0.2 }, { t: 1, x: 0.6, y: 0.4 }];
  o.dx = 0.05;
  const p = overlayPos(o, 0.5);
  assert.ok(Math.abs(p.x - 0.45) < 1e-9 && Math.abs(p.y - 0.3) < 1e-9);
});

test('قراءة SRT و VTT', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,500\nمرحبا بكم\n\n2\n00:00:03,000 --> 00:00:04,000\n<i>سطر</i> ثانٍ\n';
  assert.deepEqual(parseSubtitles(srt), [{ start: 1, end: 2.5, text: 'مرحبا بكم' }, { start: 3, end: 4, text: 'سطر ثانٍ' }]);
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000 align:start\nأهلا\n';
  assert.deepEqual(parseSubtitles(vtt), [{ start: 1, end: 2, text: 'أهلا' }]);
});

test('تقسيم الأسطر الطويلة وتحويل رد الخدمة', () => {
  const long = { start: 0, end: 10, text: 'واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة أحد عشر اثنا عشر' };
  const parts = splitSegments([long], 7);
  assert.ok(parts.length >= 2);
  assert.ok(Math.abs(parts.at(-1).end - 10) < 1e-9 && parts[0].start === 0);
  assert.equal(segmentsFromResponse({ segments: [{ start: 0.5, end: 1.5, text: ' السلام عليكم ' }] }).length, 1);
  assert.deepEqual(segmentsFromResponse('{"text":"نص كامل"}', 5), [{ start: 0, end: 5, text: 'نص كامل' }]);
  assert.equal(segmentsFromResponse('1\n00:00:00,000 --> 00:00:01,000\nأ\n').length, 1);
});

test('إضافة الترجمة تستبدل القديمة وتُصدَّر SRT', () => {
  const p = newProject();
  p.texts = [{ id: 'x', text: 'عنوان', start: 0, end: 1 }];
  applyCaptions(p, [{ start: 0, end: 1, text: 'أ' }, { start: 1, end: 2, text: 'ب' }]);
  applyCaptions(p, [{ start: 0, end: 1.25, text: 'ج' }]);
  assert.equal(p.texts.length, 2);
  assert.ok(p.texts.find((t) => t.caption).text === 'ج');
  assert.equal(toSRT(p.texts), '1\n00:00:00,000 --> 00:00:01,250\nج\n');
});

test('إزالة الخضراء تجعل الأخضر شفافًا وتبقي غيره', () => {
  const d = new Uint8ClampedArray([0, 220, 0, 255, 230, 40, 40, 255, 30, 150, 40, 255]);
  keyPixels(d, [0, 208, 0], 0.3, 0.12);
  assert.equal(d[3], 0, 'الأخضر شفاف');
  assert.equal(d[7], 255, 'الأحمر باقٍ');
  assert.ok(d[11] < 128, 'الأخضر الداكن (ظل) يُزال أيضًا');
});
