import test from 'node:test';
import assert from 'node:assert/strict';
import { karaokeProgress, newText, ANIMS } from '../../src/engine/text.js';
import { TRANSITIONS } from '../../src/engine/transitions.js';

test('تقدم الكاراوكي يتوزع على الأسطر بعدد الحروف', () => {
  assert.deepEqual(karaokeProgress(['ab', 'cd'], 0), [0, 0]);
  assert.deepEqual(karaokeProgress(['ab', 'cd'], 0.5), [1, 0]);
  assert.deepEqual(karaokeProgress(['ab', 'cd'], 1), [1, 1]);
  const r = karaokeProgress(['مرحبا بكم'], 0.5);
  assert.ok(r[0] > 0.49 && r[0] < 0.51);
});

test('النص الافتراضي وقوائم الحركات والانتقالات', () => {
  const t = newText({ text: 'سلام' });
  assert.equal(t.text, 'سلام');
  assert.ok(t.end > t.start);
  assert.ok(Object.keys(ANIMS).length >= 8);
  assert.ok(['fade', 'slideL', 'zoomIn', 'spin', 'blur', 'flash'].every((k) => k in TRANSITIONS));
});
