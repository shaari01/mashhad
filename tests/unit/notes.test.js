import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../../src/core/history.js';
import { buildAudioPlan, audioItemDuration } from '../../src/engine/audioplan.js';
import { newProject } from '../../src/core/project.js';
import { ANIMS, ANIMS_PRO } from '../../src/engine/text.js';
import { FILTERS } from '../../src/engine/effects.js';

test('زر ✕ يرجع إلى حال فتح اللوحة ويحذف خطواتها من التراجع', () => {
  const h = new History();
  h.reset({ a: 1 });
  h.commit({ a: 2 }, 'x');
  const m = h.mark();
  h.commit({ a: 3 }, 'y');
  h.commit({ a: 4 }, 'z');
  assert.deepEqual(h.rollback(m), { a: 2 });
  assert.equal(h.undoStack.length, 1);
  assert.deepEqual(h.undo().state, { a: 1 });
});

test('سرعة الصوت تغيّر مدته ومعدل تشغيله', () => {
  const p = newProject();
  p.audio = [{ id: 'a', mediaId: 'm', kind: 'voice', start: 0, in: 0, out: 6, speed: 1.5, volume: 1, fadeIn: 0, fadeOut: 1 }];
  assert.equal(audioItemDuration(p.audio[0]), 4);
  const seg = buildAudioPlan(p, 10).segs[0];
  assert.equal(seg.dur, 4);
  assert.equal(seg.srcDur, 6);
  assert.equal(seg.rate, 1.5);
  assert.equal(seg.fadeOut, 1);
});

test('حركات النص الأساسية والإضافية وفلاتر النهار والليل', () => {
  assert.ok(ANIMS.type && ANIMS.fade && !ANIMS.spin);
  assert.ok(Object.keys(ANIMS_PRO).length >= 10);
  for (const k of ['dayshot', 'nightshot', 'clear', 'colorup', 'colordown']) assert.ok(FILTERS[k]?.css, k);
});
