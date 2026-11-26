// مكتبة الانتقالات بمعاينة صغيرة متحركة، ومدة قابلة للتعديل، وزر «طبّق على الكل».
import { app, edit, select, shown } from '../../app.js';
import { layout } from '../../core/timeline.js';
import { TRANSITIONS, drawTransition } from '../../engine/transitions.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, openSheet, refreshSheet, toast } from '../dom.js';
import { icon } from '../icons.js';

// زر الانتقال بين بطاقتين
export function betweenButton(i) {
  const c = app.project.clips[i];
  const on = c?.transition && c.transition.type !== 'none';
  const b = h('button.tbtn' + (on ? '.on' : ''), { 'aria-label': 'الانتقال بعد المقطع ' + (i + 1), onclick: (e) => { e.stopPropagation(); openTransitionPanel(i); } });
  const s = h('span');
  s.innerHTML = icon('transition', 16);
  b.append(s);
  return b;
}

function thumbCanvas(src, size, fallbackColor) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = fallbackColor; g.fillRect(0, 0, size, size);
  if (src) { const im = new Image(); im.onload = () => { const s = Math.max(size / im.width, size / im.height); g.drawImage(im, (size - im.width * s) / 2, (size - im.height * s) / 2, im.width * s, im.height * s); }; im.src = src; }
  return c;
}

export function openTransitionPanel(index) {
  const clips = app.project.clips;
  if (clips.length < 2) return toast('تحتاج مقطعين على الأقل');
  if (index == null) {
    const sel = app.selected?.type === 'clip' ? clips.findIndex((c) => c.id === app.selected.id) : -1;
    index = Math.max(0, Math.min(clips.length - 2, sel >= 0 ? sel : 0));
  }
  select('clip', clips[index].id);
  let raf = 0;
  openSheet('transition', `الانتقال بين ${index + 1} و${index + 2}`, (body) => {
    const a = app.project.clips[index], b = app.project.clips[index + 1];
    if (!a || !b) return;
    const cur = a.transition?.type || 'none';
    const ta = thumbCanvas(lib.cachedRecord(a.mediaId)?.thumb, 64, '#2d5bff');
    const tb = thumbCanvas(lib.cachedRecord(b.mediaId)?.thumb, 64, '#ff6a3d');
    const grid = h('div.chips', { style: { flexWrap: 'wrap' } });
    const canv = [];
    for (const [k, label] of Object.entries(TRANSITIONS)) {
      if (k !== 'none' && !shown('transitions', k)) continue;
      const cv = h('canvas', { width: 64, height: 64 });
      canv.push([cv, k]);
      grid.append(h('button.chip' + (cur === k ? '.on' : ''), { onclick: () => {
        edit('انتقال', (p) => { p.clips[index].transition = k === 'none' ? null : { type: k, dur: a.transition?.dur || 0.6 }; });
        const it = layout(app.project).items[index + 1];
        if (it && k !== 'none') app.preview.seek(Math.max(0, it.start - 0.3));
      } }, cv, label));
    }
    body.append(grid);
    const t0 = performance.now();
    const tick = () => {
      const p = ((performance.now() - t0) / 1400) % 1.4;
      const q = Math.min(1, Math.max(0, (p - 0.2) / 1));
      for (const [cv, k] of canv) {
        const g = cv.getContext('2d');
        g.clearRect(0, 0, 64, 64);
        if (k === 'none') { g.drawImage(q < 0.5 ? ta : tb, 0, 0); continue; }
        drawTransition(g, ta, tb, q, k, 64, 64);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (cur !== 'none') {
      body.append(slider('المدة', { min: 0.2, max: 2, step: 0.1, value: a.transition.dur, fmt: (v) => v.toFixed(1) + ' ث', onchange: (v) => edit('مدة الانتقال', (p) => { p.clips[index].transition.dur = v; }) }));
    }
    body.append(h('div.row', {},
      btn('طبّق على الكل', () => {
        const tr = app.project.clips[index].transition;
        edit('انتقال للكل', (p) => p.clips.forEach((c, i) => { if (i < p.clips.length - 1) c.transition = tr ? { ...tr } : null; }));
        toast(tr ? 'طُبّق الانتقال على كل المقاطع' : 'أُزيلت كل الانتقالات');
      }, { icon: 'check' }),
      btn('انتقالات عشوائية', () => {
        const keys = Object.keys(TRANSITIONS).filter((k) => k !== 'none');
        edit('انتقالات عشوائية', (p) => p.clips.forEach((c, i) => { if (i < p.clips.length - 1) c.transition = { type: keys[(i * 7 + 3) % keys.length], dur: 0.6 }; }));
      }, { icon: 'wand' }),
      index > 0 ? btn('السابق', () => openTransitionPanel(index - 1)) : null,
      index < app.project.clips.length - 2 ? btn('التالي', () => openTransitionPanel(index + 1)) : null));
    return () => cancelAnimationFrame(raf);
  });
}
