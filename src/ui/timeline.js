// وضع الخط الزمني المتقدم (أسلوب VN): مسارات للفيديو والنص والملصقات والأصوات.
// الزمن من اليمين إلى اليسار. سحب العنصر ينقله، وسحب طرفيه يقصّه، مع الالتصاق بالإيقاع والمؤشر.
import { app, select, live, commit, emit } from '../app.js';
import { layout, fmtTime, snap, clamp, clipDuration, srcLength, MIN_CLIP } from '../core/timeline.js';
import * as lib from '../media/library.js';
import { h, $ } from './dom.js';
import { icon } from './icons.js';

const LBL = 40; // عرض عمود التسميات
let pps = 60; // بكسل لكل ثانية
let hooks = {};
let dragging = false; // لا نعيد بناء الخط الزمني أثناء السحب حتى لا يضيع الإمساك
export function setTimelineHooks(x) { hooks = { ...hooks, ...x }; }

const xOf = (t) => LBL + t * pps;

function rowEl(label, ic, children, cls = '') {
  const lb = h('div.lbl', { title: label });
  lb.innerHTML = icon(ic, 18);
  return h('div.tl-row' + cls, { 'aria-label': label }, lb, ...children);
}

export function renderTimeline() {
  if (dragging) return;
  const box = $('#timeline');
  const p = app.project;
  const lay = layout(p);
  const T = Math.max(1, lay.duration);
  const scroll = box.scrollLeft;
  box.innerHTML = '';
  const width = xOf(T) + 120;
  const inner = h('div.tl-inner', { style: { width: width + 'px' } });
  // المسطرة
  const ruler = h('div.tl-ruler');
  const step = pps > 90 ? 0.5 : pps > 35 ? 1 : pps > 15 ? 2 : 5;
  for (let t = 0; t <= T + 0.001; t += step) ruler.append(h('span', { style: { right: xOf(t) + 'px' } }, fmtTime(t)));
  inner.append(ruler);
  const isSel = (type, id) => app.selected?.type === type && app.selected.id === id;
  // الفيديو
  const vids = lay.items.map((it) => {
    const rec = lib.cachedRecord(it.clip.mediaId);
    return item('clip', it.clip, it.start, it.dur, rec?.thumb, isSel('clip', it.clip.id), String(it.index + 1));
  });
  inner.append(rowEl('الفيديو', 'cards', vids));
  const texts = (p.texts || []).map((t) => item('text', t, t.start, t.end - t.start, null, isSel('text', t.id), t.text.split('\n')[0], 'text'));
  if (texts.length) inner.append(rowEl('النصوص', 'text', texts));
  const ovs = (p.overlays || []).map((o) => item('overlay', o, o.start, o.end - o.start, o.mediaId ? lib.cachedRecord(o.mediaId)?.thumb : null, isSel('overlay', o.id), o.kind === 'emoji' ? o.content : o.kind === 'shape' ? '◆' : '▣', 'ov'));
  if (ovs.length) inner.append(rowEl('الملصقات', 'sticker', ovs));
  for (const [kind, ic, label] of [['music', 'music', 'الموسيقى'], ['sfx', 'sfx', 'المؤثرات'], ['voice', 'mic', 'التسجيل']]) {
    const list = (p.audio || []).filter((a) => (a.kind || 'music') === kind);
    if (!list.length) continue;
    inner.append(rowEl(label, ic, list.map((a) => item('audio', a, a.start, a.out - a.in, null, isSel('audio', a.id), lib.cachedRecord(a.mediaId)?.name || label, 'aud'))));
  }
  for (const b of p.beats || []) inner.append(h('div.beat-mark', { style: { right: xOf(b) + 'px', top: '18px' } }));
  inner.append(h('div.tl-head', { style: { right: xOf(app.preview?.time || 0) + 'px' }, 'data-tlhead': '1' }));
  // أزرار التكبير
  const zoom = h('div', { style: { position: 'sticky', right: '0', display: 'inline-flex', gap: '4px', zIndex: 6 } },
    h('button.ib.sm', { 'aria-label': 'تصغير الخط الزمني', onclick: () => { pps = Math.max(8, pps / 1.5); renderTimeline(); }, html: icon('minus', 20) }),
    h('button.ib.sm', { 'aria-label': 'تكبير الخط الزمني', onclick: () => { pps = Math.min(400, pps * 1.5); renderTimeline(); }, html: icon('plus', 20) }));
  box.append(zoom, inner);
  box.scrollLeft = scroll;
  // النقر على مكان فارغ = تحريك المؤشر
  inner.addEventListener('click', (e) => {
    if (e.target.closest('.tl-item') || e.target.closest('.lbl')) return;
    const r = inner.getBoundingClientRect();
    app.preview.seek(clamp((r.right - e.clientX - LBL) / pps, 0, T));
  });
  box.onwheel = (e) => { if (e.ctrlKey) { e.preventDefault(); pps = clamp(pps * (e.deltaY < 0 ? 1.15 : 0.87), 8, 400); renderTimeline(); } };
}

function item(type, obj, start, dur, thumb, sel, label, cls = '') {
  const el = h('div.tl-item' + (cls ? '.' + cls : '') + (sel ? '.sel' : ''), {
    style: { right: xOf(start) + 'px', width: Math.max(6, dur * pps) + 'px', backgroundImage: thumb ? `url(${thumb})` : '' },
    'data-id': obj.id,
  }, label);
  el.append(h('div.rh', { 'data-h': 'start' }), h('div.lh', { 'data-h': 'end' }));
  el.addEventListener('pointerdown', (e) => startDrag(e, type, obj, el));
  el.addEventListener('dblclick', () => hooks.open?.(type, obj));
  return el;
}

function snapT(t, exclude) {
  const p = app.project;
  const pts = [...(p.beats || []), app.preview.time, 0];
  for (const it of layout(p).items) pts.push(it.start, it.end);
  return snap(t, pts.filter((x) => x !== exclude), 8 / pps);
}

function startDrag(e, type, obj, el) {
  e.stopPropagation();
  const handle = e.target.dataset.h || 'move';
  const x0 = e.clientX;
  const startT = obj.start ?? layout(app.project).items.find((x) => x.clip.id === obj.id)?.start ?? 0;
  const orig = JSON.parse(JSON.stringify(obj));
  let moved = false;
  el.setPointerCapture(e.pointerId);
  dragging = true;
  if (!(app.selected?.type === type && app.selected.id === obj.id)) { app.selected = { type, id: obj.id }; emit('select'); }
  const move = (ev) => {
    const dt = (x0 - ev.clientX) / pps; // اليسار = زمن أكبر
    if (Math.abs(ev.clientX - x0) < 4 && !moved) return;
    moved = true;
    if (type === 'clip') {
      const c = obj;
      if (c.type === 'video') {
        const sp = c.speed || 1;
        if (handle === 'start') c.in = clamp(orig.in + dt * sp, 0, orig.out - MIN_CLIP);
        else if (handle === 'end') c.out = clamp(orig.out + dt * sp, orig.in + MIN_CLIP, c.srcDuration ?? orig.out);
      } else if (handle !== 'start') c.duration = Math.max(MIN_CLIP * 3, orig.duration + (handle === 'end' ? dt : 0));
    } else if (type === 'audio') {
      const rec = lib.cachedRecord(obj.mediaId);
      const D = rec?.duration ?? orig.out;
      if (handle === 'move') obj.start = Math.max(0, snapT(orig.start + dt, orig.start));
      else if (handle === 'start') { const d = clamp(dt, -orig.in, orig.out - orig.in - 0.1); obj.start = Math.max(0, orig.start + d); obj.in = orig.in + d; }
      else obj.out = clamp(orig.out + dt, orig.in + 0.1, D);
    } else {
      const d = orig.end - orig.start;
      if (handle === 'move') { obj.start = Math.max(0, snapT(orig.start + dt, orig.start)); obj.end = obj.start + d; }
      else if (handle === 'start') obj.start = clamp(snapT(orig.start + dt, orig.start), 0, orig.end - 0.2);
      else obj.end = Math.max(obj.start + 0.2, snapT(orig.end + dt, orig.end));
    }
    live();
    // تحديث سريع للعنصر دون إعادة بناء
    const s = type === 'clip' ? startT : obj.start;
    const dur = type === 'clip' ? clipDuration(obj) : type === 'audio' ? obj.out - obj.in : obj.end - obj.start;
    el.style.right = xOf(s) + 'px';
    el.style.width = Math.max(6, dur * pps) + 'px';
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    dragging = false;
    if (moved) commit('الخط الزمني');
    else {
      const s = type === 'clip' ? startT : obj.start;
      if (app.preview.time < s || app.preview.time > s + 0.01) app.preview.seek(s + 0.01);
      emit('select');
      hooks.tap?.(type, obj);
      renderTimeline();
    }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

export function updateTimelineHead(t) {
  const hd = document.querySelector('[data-tlhead]');
  if (!hd) return;
  hd.style.right = xOf(t) + 'px';
  if (app.preview?.playing) {
    const box = $('#timeline');
    const r = box.getBoundingClientRect(), hr = hd.getBoundingClientRect();
    if (hr.left < r.left + 40 || hr.left > r.right - 40) hd.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}
