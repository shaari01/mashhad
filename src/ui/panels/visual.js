// الفلاتر بمعاينة، والتعديل البسيط، وتوحيد الألوان، والمؤثرات المرئية، والإطارات الزخرفية، والقوالب.
import { app, edit, live, commit, targetClip, newProj, saveNow } from '../../app.js';
import { layout } from '../../core/timeline.js';
import { FILTERS, EFFECTS, FRAMES, matchAdjust } from '../../engine/effects.js';
import { BUILTIN_TEMPLATES, applyTemplate, templateFromProject } from '../../core/templates.js';
import { renderMusic, MUSIC } from '../../engine/music.js';
import { encodeWav } from '../../engine/audio.js';
import * as db from '../../storage/db.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast, closeSheet, modal, closeModal, confirmBox } from '../dom.js';
import { sfxMedia } from './sound.js';

function filteredThumb(src, css, size = 64) {
  const c = h('canvas', { width: size, height: size });
  if (!src) return c;
  const im = new Image();
  im.onload = () => {
    const g = c.getContext('2d');
    g.filter = css || 'none';
    const s = Math.max(size / im.width, size / im.height);
    g.drawImage(im, (size - im.width * s) / 2, (size - im.height * s) / 2, im.width * s, im.height * s);
  };
  im.src = src;
  return c;
}

export function openFilterPanel() {
  const c0 = targetClip();
  if (!c0) return toast('أضف مقطعًا أولًا');
  let tab = 'filter';
  openSheet('filter', 'فلتر وألوان', (body) => {
    const clip = app.project.clips.find((x) => x.id === c0.id) || targetClip();
    if (!clip) return;
    const thumb = lib.cachedRecord(clip.mediaId)?.thumb;
    body.append(seg([['filter', 'فلاتر'], ['adjust', 'تعديل'], ['unify', 'توحيد الألوان']], tab, (v) => { tab = v; refreshSheet(); }));
    if (tab === 'filter') {
      const chips = h('div.chips');
      for (const [k, f] of Object.entries(FILTERS)) chips.append(h('button.chip' + ((clip.filter || 'none') === k ? '.on' : ''), { onclick: () => edit('فلتر', () => { clip.filter = k; }) }, filteredThumb(thumb, f.css), f.label));
      body.append(chips, h('div.row', {}, btn('طبّق الفلتر على كل المقاطع', () => { edit('فلتر للكل', (p) => p.clips.forEach((x) => { x.filter = clip.filter; })); toast('تم'); }, { icon: 'check' })));
    } else if (tab === 'adjust') {
      const a = clip.adjust || (clip.adjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 });
      const row = (label, key) => slider(label, { min: -1, max: 1, step: 0.02, value: a[key] || 0, fmt: (v) => Math.round(v * 100), oninput: (v) => { a[key] = v; live(); }, onchange: () => commit('تعديل الألوان') });
      body.append(row('السطوع', 'brightness'), row('التباين', 'contrast'), row('التشبع', 'saturation'), row('الحرارة', 'temperature'));
      body.append(h('div.row', {}, btn('إعادة الضبط', () => edit('إعادة الضبط', () => { clip.adjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 }; })), btn('طبّق على الكل', () => { edit('تعديل للكل', (p) => p.clips.forEach((x) => { x.adjust = { ...a }; })); toast('تم'); })));
    } else {
      body.append(h('p.hint', {}, 'لتبدو المقاطع متجانسة كأنها صُوّرت معًا:'));
      body.append(h('div.row', {},
        btn('انسخ فلتر وألوان هذا المقطع إلى الكل', () => { edit('توحيد الألوان', (p) => p.clips.forEach((x) => { x.filter = clip.filter; x.adjust = { ...clip.adjust }; })); toast('وُحّدت الألوان'); }, { icon: 'grade', cls: 'pri' })));
      body.append(h('div.row', {},
        btn('موازنة تلقائية للسطوع والتشبع', async () => {
          const stats = await Promise.all(app.project.clips.map((c) => thumbStats(lib.cachedRecord(c.mediaId)?.thumb)));
          const adj = matchAdjust(stats);
          edit('موازنة تلقائية', (p) => p.clips.forEach((x, i) => { x.adjust = { ...(x.adjust || {}), brightness: adj[i].brightness, saturation: adj[i].saturation }; }));
          toast('قُرّبت ألوان المقاطع من بعضها');
        }, { icon: 'wand' })));
    }
  });
}

function thumbStats(src) {
  return new Promise((res) => {
    if (!src) return res({ luma: 0.5, sat: 0.3 });
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = 32; c.height = 32;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data;
      let L = 0, S = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        L += 0.299 * r + 0.587 * gg + 0.114 * b; S += mx ? (mx - mn) / mx : 0;
      }
      res({ luma: L / 1024, sat: S / 1024 });
    };
    im.onerror = () => res({ luma: 0.5, sat: 0.3 });
    im.src = src;
  });
}

export function openEffectsPanel() {
  const c0 = targetClip();
  if (!c0) return toast('أضف مقطعًا أولًا');
  let range = 'head';
  openSheet('effects', 'مؤثرات مرئية', (body) => {
    const clip = app.project.clips.find((x) => x.id === c0.id) || targetClip();
    if (!clip) return;
    body.append(h('div.row', {}, h('label', {}, 'المدى'), seg([['head', 'من المؤشر (ثانية)'], ['all', 'كامل المقطع']], range, (v) => { range = v; })));
    const chips = h('div.chips', { style: { flexWrap: 'wrap' } });
    for (const [k, label] of Object.entries(EFFECTS)) {
      chips.append(h('button.chip', { onclick: () => {
        const it = layout(app.project).items.find((x) => x.clip.id === clip.id);
        const local = it ? Math.max(0, app.preview.time - it.start) : 0;
        const e = range === 'all' ? { type: k, start: 0, end: 1e9 } : { type: k, start: local, end: local + (k === 'punch' ? 0.6 : 1) };
        edit('مؤثر', () => { (clip.effects ||= []).push(e); });
        app.preview.seek((it?.start || 0) + e.start + 0.01);
        toast('أُضيف «' + label + '»');
      } }, label));
    }
    body.append(chips);
    if (clip.effects?.length) {
      body.append(h('p.hint', {}, 'المؤثرات على هذا المقطع:'));
      clip.effects.forEach((e, i) => body.append(h('div.list-item', {}, h('div.meta', {}, h('b', {}, EFFECTS[e.type] || e.type), h('small', {}, e.end > 1e8 ? 'كامل المقطع' : `${e.start.toFixed(1)} – ${e.end.toFixed(1)} ث`)),
        btn('', () => edit('حذف مؤثر', () => { clip.effects.splice(i, 1); }), { icon: 'delete', cls: 'danger' }))));
    }
    body.append(h('p.hint', {}, 'الإطار الزخرفي (على الفيديو كله):'));
    const fr = h('div.chips');
    for (const [k, label] of Object.entries(FRAMES)) fr.append(h('button.chip' + ((app.project.frame || 'none') === k ? '.on' : ''), { onclick: () => edit('إطار', (p) => { p.frame = k; }) }, label));
    body.append(fr);
  });
}

// ———— القوالب ————
async function builtinMusicRec(style, seconds) {
  const { buffer, beats } = await renderMusic(style, seconds);
  const rec = await lib.importBlob(encodeWav(buffer), `موسيقى ${MUSIC[style].label}.wav`, 'audio', { role: 'music' });
  return { rec, beats };
}

export async function runTemplate(tpl, files = null) {
  files ||= await lib.pickFiles('visual', { preferCopy: app.settings.copyAlways });
  if (!files.length) return;
  const recs = [];
  for (const [i, f] of files.entries()) {
    toast(`تجهيز ${i + 1} من ${files.length}…`, 60000);
    try { recs.push(await lib.importFile(f, { copyAlways: app.settings.copyAlways })); } catch (e) { toast(e.message); }
  }
  if (!recs.length) return;
  await newProj(tpl.name + ' — ' + new Date().toLocaleDateString('ar'));
  toast('بناء الفيديو من القالب…', 60000);
  // تقدير المدة لتوليد موسيقى مناسبة
  const est = recs.reduce((a, r) => a + (r.kind === 'image' ? tpl.imageDuration : Math.min(r.duration, (tpl.videoMax || 6))), 0) + 2;
  let musicRec = null, beats = null;
  if (tpl.music?.builtin) ({ rec: musicRec, beats } = await builtinMusicRec(tpl.music.builtin, est));
  else if (tpl.music?.mediaId) { const r = await lib.ensure(tpl.music.mediaId); if (r.ok) musicRec = await lib.getRecord(tpl.music.mediaId); }
  const sfxRecs = new Map();
  for (const id of tpl.sfxOnCuts || []) sfxRecs.set(id, await sfxMedia(id));
  edit('قالب: ' + tpl.name, (p) => { applyTemplate(p, tpl, recs, { musicRec, beats, sfxRecs }); if (tpl.music?.builtin) p.musicBuiltin = tpl.music.builtin; });
  app.preview.seek(0);
  closeSheet();
  closeModal();
  toast('جاهز! شغّله، وعدّل ما تريد.');
}

export async function openTemplates() {
  const body = h('div');
  const user = (await db.all('templates')).sort((a, b) => b.createdAt - a.createdAt);
  body.append(h('p.hint', {}, 'اختر قالبًا ثم اختر صورك ومقاطعك، فيُبنى فيديو كامل بانتقالات وموسيقى وعنوان في مشروع جديد.'));
  const grid = h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' } });
  for (const t of [...BUILTIN_TEMPLATES, ...user]) {
    const cell = h('div', { style: { position: 'relative' } }, h('button.cell', { style: { aspectRatio: '1.3', flexDirection: 'column', display: 'flex', fontSize: '34px', width: '100%' }, onclick: () => runTemplate(t) }, t.emoji || '⭐', h('span', { style: { fontSize: '15px', fontWeight: 700 } }, t.name)));
    if (!t.builtin) cell.append(h('button', { 'aria-label': 'حذف القالب', style: { position: 'absolute', top: '4px', left: '4px', fontSize: '18px', width: '36px', height: '36px' }, onclick: async () => { if (await confirmBox(`حذف القالب «${t.name}»؟`, 'احذف')) { await db.del('templates', t.id); openTemplates(); } } }, '✕'));
    grid.append(cell);
  }
  body.append(grid);
  if (app.project.clips.length) {
    const name = h('input.inp', { value: app.project.name + ' (قالبي)', dir: 'rtl' });
    body.append(h('h3', {}, 'احفظ مشروعك كقالب'), h('p.hint', {}, 'يُحفظ أسلوبك: المقاس، ومدة الصور، والانتقالات، والفلتر، والمؤثرات، والإطار، والموسيقى، وشكل العنوان.'), name,
      h('div.row', {}, btn('احفظ كقالب', async () => { await db.put('templates', templateFromProject(app.project, name.value.trim())); toast('حُفظ القالب'); openTemplates(); }, { icon: 'template', cls: 'pri' })));
  }
  modal('القوالب', body);
}
