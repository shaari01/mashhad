import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject } from '../../src/core/project.js';
import { layout } from '../../src/core/timeline.js';
import { BUILTIN_TEMPLATES, applyTemplate, templateFromProject } from '../../src/core/templates.js';
import { matchAdjust, FILTERS, EFFECTS, FRAMES, clipFilter } from '../../src/engine/effects.js';

const recs = [{ id: 'm1', kind: 'image' }, { id: 'm2', kind: 'video', duration: 20 }, { id: 'm3', kind: 'image' }, { id: 'm4', kind: 'image' }];

test('القالب يبني مشروعًا كاملًا', () => {
  for (const tpl of BUILTIN_TEMPLATES) {
    const p = newProject();
    const musicRec = { id: 'mus', duration: 60 };
    const sfxRecs = new Map((tpl.sfxOnCuts || []).map((id) => [id, { id: 'sfx-' + id, duration: 0.5 }]));
    applyTemplate(p, tpl, recs, { musicRec, sfxRecs });
    assert.equal(p.clips.length, 4);
    assert.equal(p.aspect, tpl.aspect);
    assert.ok(p.clips.every((c) => c.filter === tpl.filter));
    assert.equal(p.clips.at(-1).transition, null);
    assert.ok(p.clips[0].transition?.type);
    const vid = p.clips.find((c) => c.type === 'video');
    assert.ok((vid.out - vid.in) / vid.speed <= tpl.videoMax + 1e-6, 'قُصّ الفيديو الطويل');
    const T = layout(p).duration;
    const music = p.audio.find((a) => a.kind === 'music');
    assert.ok(music && Math.abs(music.out - T) < 1e-6, 'الموسيقى بطول الفيديو');
    assert.ok(p.texts.some((t) => t.text === tpl.title.text));
    if (tpl.sfxOnCuts) assert.ok(p.audio.some((a) => a.kind === 'sfx'));
    if (tpl.stickers) assert.equal(p.overlays.length, tpl.stickers.length);
  }
});

test('القالب يطابق القطعات مع الإيقاع', () => {
  const p = newProject();
  const beats = []; for (let t = 0; t < 30; t += 0.5) beats.push(t);
  applyTemplate(p, BUILTIN_TEMPLATES[1], recs, { beats });
  assert.ok(p.beats.length > 10);
  for (const it of layout(p).items.slice(0, -1)) {
    const d = Math.min(...beats.map((b) => Math.abs(b - it.end)));
    assert.ok(d < 0.02, `نهاية ${it.end} على إيقاع`);
  }
});

test('حفظ المشروع كقالب ثم تطبيقه يعيد نفس الأسلوب', () => {
  const p = newProject();
  applyTemplate(p, BUILTIN_TEMPLATES[2], recs, {});
  const tpl = templateFromProject(p, 'قالبي');
  assert.equal(tpl.name, 'قالبي');
  assert.equal(tpl.filter, 'gold');
  assert.equal(tpl.frame, 'ornament');
  assert.ok(tpl.transitions.length >= 1);
  assert.equal(tpl.title.text, 'مبارك');
  const q = newProject();
  applyTemplate(q, tpl, recs.slice(0, 2), {});
  assert.equal(q.frame, 'ornament');
  assert.ok(q.clips.every((c) => c.filter === 'gold'));
});

test('موازنة الألوان تقرّب المقاطع من المتوسط', () => {
  const adj = matchAdjust([{ luma: 0.2, sat: 0.3 }, { luma: 0.5, sat: 0.3 }, { luma: 0.8, sat: 0.6 }]);
  assert.ok(adj[0].brightness > 0, 'الداكن يُفتَّح');
  assert.ok(adj[2].brightness < 0, 'الفاتح يُغمَّق');
  assert.ok(adj[2].saturation < 0);
  assert.ok(adj.every((a) => Math.abs(a.brightness) <= 0.6 && Math.abs(a.saturation) <= 0.6));
  assert.deepEqual(matchAdjust([]), []);
});

test('قوائم الفلاتر والمؤثرات والإطارات', () => {
  assert.ok(Object.keys(FILTERS).length >= 10 && FILTERS.none);
  assert.ok(Object.keys(EFFECTS).length >= 6);
  assert.ok(Object.keys(FRAMES).length >= 6);
  const css = clipFilter({ filter: 'bw', adjust: { brightness: 0.2, contrast: 0, saturation: 0, temperature: 0 } });
  assert.equal(typeof css, 'string');
});
