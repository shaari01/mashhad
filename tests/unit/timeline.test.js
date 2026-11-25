import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, newClip } from '../../src/core/project.js';
import { layout, clipDuration, sourceTime, localTimeForSource, activeAt, snap, speedAt, CURVES } from '../../src/core/timeline.js';
import * as E from '../../src/core/edits.js';
import { History } from '../../src/core/history.js';
import { buildAudioPlan, mergeRegions, energyRegions } from '../../src/engine/audioplan.js';

const vid = (id, d) => ({ id, kind: 'video', duration: d });
const img = (id) => ({ id, kind: 'image' });
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

function proj() {
  const p = newProject();
  E.addClips(p, [vid('m1', 10), img('m2'), vid('m3', 4)]);
  return p;
}

test('المدد والتخطيط بلا انتقالات', () => {
  const p = proj();
  const lay = layout(p);
  assert.equal(lay.items.length, 3);
  near(lay.duration, 10 + 3 + 4);
  near(lay.items[2].start, 13);
});

test('السرعة تغيّر المدة وزمن المصدر', () => {
  const p = proj();
  E.setSpeed(p, p.clips[0].id, 2);
  near(clipDuration(p.clips[0]), 5);
  near(sourceTime(p.clips[0], 2.5), 5);
  E.setSpeed(p, p.clips[0].id, 0.25);
  near(clipDuration(p.clips[0]), 40);
  E.setSpeed(p, p.clips[0].id, 10);
  near(clipDuration(p.clips[0]), 2.5); // الحد الأقصى 4×
});

test('منحنى السرعة: يبدأ وينتهي في طرفي المصدر، ورتيب', () => {
  const c = newClip(vid('m', 8));
  for (const k of Object.keys(CURVES)) {
    c.curve = k;
    const D = clipDuration(c);
    near(sourceTime(c, 0), 0);
    near(sourceTime(c, D), 8, 0.01);
    let prev = -1;
    for (let i = 0; i <= 50; i++) { const s = sourceTime(c, (i / 50) * D); assert.ok(s >= prev - 1e-9); prev = s; }
    near(localTimeForSource(c, sourceTime(c, D * 0.37)), D * 0.37, 0.02);
  }
  c.curve = 'slowfast';
  assert.ok(speedAt(c, 0.01) < speedAt(c, clipDuration(c) - 0.01));
});

test('العكس', () => {
  const c = newClip(vid('m', 6));
  c.reverse = true;
  near(sourceTime(c, 0), 6);
  near(sourceTime(c, 6), 0);
});

test('التقسيم عند المؤشر', () => {
  const p = proj();
  const r = E.splitAt(p, 4);
  assert.ok(r);
  assert.equal(p.clips.length, 4);
  near(p.clips[0].out, 4);
  near(p.clips[1].in, 4);
  near(layout(p).duration, 17);
  // تقسيم صورة
  const r2 = E.splitAt(p, 11);
  assert.ok(r2);
  near(p.clips[2].duration + p.clips[3].duration, 3);
});

test('التقسيم مع الالتصاق بعلامة إيقاع', () => {
  const p = proj();
  E.splitAt(p, 4.1, [4]);
  near(p.clips[0].out, 4);
});

test('حذف جزء من الوسط', () => {
  const p = proj();
  const id = p.clips[0].id;
  assert.ok(E.deleteRange(p, id, 3, 5));
  near(layout(p).duration, 15);
  near(p.clips[0].out, 3);
  near(p.clips[1].in, 5);
});

test('القص والنقل والنسخ والحذف', () => {
  const p = proj();
  assert.ok(E.trimClip(p, p.clips[0].id, 1, 6));
  near(clipDuration(p.clips[0]), 5);
  assert.ok(!E.trimClip(p, p.clips[0].id, 3, 3.01));
  const id0 = p.clips[0].id;
  E.moveClip(p, 0, 2);
  assert.equal(p.clips[2].id, id0);
  const d = E.duplicateClip(p, id0);
  assert.equal(p.clips.length, 4);
  assert.notEqual(d.id, id0);
  E.removeClip(p, d.id);
  assert.equal(p.clips.length, 3);
});

test('الانتقالات تتداخل وتقصّر المدة', () => {
  const p = proj();
  p.clips[0].transition = { type: 'fade', dur: 1 };
  const lay = layout(p);
  near(lay.duration, 16);
  near(lay.items[1].start, 9);
  assert.equal(activeAt(lay, 9.5).length, 2);
});

test('تجميد إطار', () => {
  const p = proj();
  const fr = E.freezeAt(p, 4, 2);
  assert.ok(fr);
  assert.equal(p.clips.length, 5);
  assert.equal(p.clips[1].type, 'freeze');
  near(p.clips[1].freezeAt, 4);
  near(layout(p).duration, 19);
});

test('استبدال الملف يحافظ على التعديلات', () => {
  const p = proj();
  p.clips[0].speed = 2;
  p.clips[0].volume = 0.5;
  E.replaceMedia(p, p.clips[0].id, vid('new', 30));
  assert.equal(p.clips[0].mediaId, 'new');
  assert.equal(p.clips[0].volume, 0.5);
  near(clipDuration(p.clips[0]), 5);
});

test('مواءمة المقاطع مع الإيقاع', () => {
  const p = proj();
  p.beats = [2, 4, 9.6, 12, 15];
  E.fitClipsToBeats(p);
  const lay = layout(p);
  near(lay.items[0].end, 9.6, 0.01);
  near(lay.items[1].end, 12, 0.01);
});

test('الالتصاق', () => {
  near(snap(1.05, [1, 2]), 1);
  near(snap(1.5, [1, 2]), 1.5);
});

test('التراجع والإعادة', () => {
  const h = new History();
  const s = { a: 1 };
  h.reset(s);
  s.a = 2; h.commit(s, 'x');
  s.a = 3; h.commit(s, 'y');
  assert.equal(h.undo().state.a, 2);
  assert.equal(h.undo().state.a, 1);
  assert.equal(h.undo(), null);
  assert.equal(h.redo().state.a, 2);
  assert.ok(!h.commit({ a: 2 }));
});

test('خطة الصوت', () => {
  const p = proj();
  p.clips[0].speed = 2;
  p.clips[2].muted = true;
  p.audio.push({ id: 'a1', mediaId: 'mus', kind: 'music', start: 1, in: 0, out: 100, volume: 0.8, fadeIn: 1, fadeOut: 2 });
  const plan = buildAudioPlan(p);
  assert.equal(plan.segs.length, 2);
  const clipSeg = plan.segs.find((s) => s.kind === 'clip');
  near(clipSeg.dur, 5); near(clipSeg.rate, 2);
  const mus = plan.segs.find((s) => s.kind === 'music');
  near(mus.dur, layout(p).duration - 1);
});

test('مناطق الكلام', () => {
  assert.deepEqual(mergeRegions([[0, 1], [1.2, 2], [5, 5.1]]), [[0, 2]]);
  const sr = 1000, ch = new Float32Array(3000);
  for (let i = 1000; i < 2000; i++) ch[i] = Math.sin(i) * 0.5;
  const r = energyRegions(ch, sr, 10);
  assert.equal(r.length, 1);
  near(r[0][0], 11, 0.06); near(r[0][1], 12, 0.06);
});
