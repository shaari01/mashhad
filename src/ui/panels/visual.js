// الفلاتر بمعاينة، والتعديل البسيط، وتوحيد الألوان، والمؤثرات المرئية، والإطارات الزخرفية، والقوالب.
import { app, edit, live, commit, targetClip, shown, saveSettings } from '../../app.js';
import { layout } from '../../core/timeline.js';
import { FILTERS, EFFECTS, matchAdjust } from '../../engine/effects.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast } from '../dom.js';

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
      for (const [k, f] of Object.entries(FILTERS)) if (k === 'none' || k === clip.filter || shown('filters', k)) chips.append(h('button.chip' + ((clip.filter || 'none') === k ? '.on' : ''), { onclick: () => edit('فلتر', () => { clip.filter = k; }) }, filteredThumb(thumb, f.css), f.label));
      for (const uf of app.settings.userFilters || []) chips.append(h('button.chip', { onclick: () => edit('فلترك', () => { clip.filter = 'none'; clip.adjust = { ...uf.adjust }; }) }, filteredThumb(thumb, adjustPreviewCss(uf.adjust)), uf.label));
      body.append(chips, h('div.row', {}, btn('طبّق الفلتر على كل المقاطع', () => { edit('فلتر للكل', (p) => p.clips.forEach((x) => { x.filter = clip.filter; })); toast('تم'); }, { icon: 'check' })));
    } else if (tab === 'adjust') {
      const a = clip.adjust || (clip.adjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 });
      const row = (label, key) => slider(label, { min: -1, max: 1, step: 0.02, value: a[key] || 0, fmt: (v) => Math.round(v * 100), oninput: (v) => { a[key] = v; live(); }, onchange: () => commit('تعديل الألوان') });
      body.append(row('السطوع', 'brightness'), row('التباين', 'contrast'), row('التشبع', 'saturation'), row('الحرارة', 'temperature'));
      const nm = h('input.inp', { placeholder: 'اسم فلترك', dir: 'rtl', style: { flex: '1', minWidth: '120px' } });
      body.append(h('div.row', {}, nm, btn('احفظ كفلتر', async () => {
        const label = nm.value.trim() || 'فلتري ' + ((app.settings.userFilters || []).length + 1);
        (app.settings.userFilters ||= []).push({ id: 'uf' + Date.now().toString(36), label, adjust: { ...a } });
        await saveSettings();
        toast('حُفظ «' + label + '» في الفلاتر');
      }, { icon: 'plus' })));
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
      if (!shown('effects', k)) continue;
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
  });
}


// معاينة تقريبية لفلترك (سطوع وتباين وتشبع) على الصورة المصغرة
function adjustPreviewCss(a = {}) {
  return `brightness(${1 + (a.brightness || 0) * 0.6}) contrast(${1 + (a.contrast || 0) * 0.6}) saturate(${1 + (a.saturation || 0)})`;
}
