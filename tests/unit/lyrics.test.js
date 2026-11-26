import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject } from '../../src/core/project.js';
import { parseLyrics, tapLine, untapLine, finishLyrics, applyLyrics, addBeat, detectBeats, defaultLyricStyle } from '../../src/core/lyrics.js';

test('الكلمات بالنقر', () => {
  const L = { lines: parseLyrics('السطر الأول\n\n  السطر الثاني \nالثالث'), style: defaultLyricStyle() };
  assert.equal(L.lines.length, 3);
  assert.equal(L.lines[1].text, 'السطر الثاني');
  assert.equal(tapLine(L, 1), 0);
  assert.equal(tapLine(L, 3), 1);
  assert.equal(L.lines[0].end, 3);
  assert.equal(untapLine(L), 1);
  assert.equal(L.lines[0].end, null);
  tapLine(L, 3.5); tapLine(L, 6);
  assert.equal(tapLine(L, 7), -1);
  finishLyrics(L, 20);
  assert.equal(L.lines[0].end, 3.5);
  assert.equal(L.lines[2].end, 12);
  const p = newProject();
  p.texts.push({ id: 'x', text: 'عادي', start: 0, end: 1 });
  p.lyrics = L;
  assert.equal(applyLyrics(p), 3);
  assert.equal(p.texts.length, 4);
  assert.ok(p.texts.filter((t) => t.lyric).every((t) => t.karaoke));
  p.lyrics = null;
  applyLyrics(p);
  assert.equal(p.texts.length, 1);
});

test('علامات الإيقاع: إضافة وكشف تلقائي', () => {
  assert.deepEqual(addBeat([1, 2], 1.5), [1, 1.5, 2]);
  assert.deepEqual(addBeat([1, 2], 1.02), [1, 2]);
  const sr = 8000, data = new Float32Array(sr * 6);
  for (let k = 0; k < 12; k++) { const s = Math.round((0.25 + k * 0.5) * sr); for (let i = 0; i < 200; i++) data[s + i] = Math.sin(i / 3) * 0.9; }
  const b = detectBeats(data, sr, { offset: 10 });
  assert.ok(b.length >= 10 && b.length <= 13, 'عدد ' + b.length);
  assert.ok(Math.abs(b[0] - 10.25) < 0.03, 'أول علامة ' + b[0]);
});
