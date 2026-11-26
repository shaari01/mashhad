import { icon, hydrateIcons } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// إنشاء عنصر: h('div.cls', {attrs}, children)
export function h(tag, attrs = {}, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(k));
  return el;
}

export function btn(label, onclick, { icon: ic, cls = '', title, disabled } = {}) {
  const b = h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick, title, disabled, type: 'button' });
  if (ic) b.insertAdjacentHTML('beforeend', icon(ic, 22));
  if (label) b.append(h('span', {}, label));
  return b;
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// النافذة المنبثقة
let modalClose = null;
export function modal(title, body, { onClose, wide } = {}) {
  const m = $('#modal');
  $('#modal-title').textContent = title;
  const b = $('#modal-body');
  b.innerHTML = '';
  b.append(body);
  hydrateIcons(m);
  m.classList.remove('hidden');
  modalClose = onClose || null;
  return closeModal;
}
export function closeModal() {
  $('#modal').classList.add('hidden');
  const f = modalClose; modalClose = null;
  f?.();
}

// اللوحة السفلية للأدوات: ترى أثر كل ضبط على المعاينة فورًا، ثم ✓ للاعتماد أو ✕ للإلغاء والرجوع.
let sheetState = null;
let sheetHooks = { mark: () => null, rollback: () => false };
export function setSheetHooks(x) { sheetHooks = { ...sheetHooks, ...x }; }
export function openSheet(id, title, render) {
  // فتح لوحة أخرى يعتمد ما في اللوحة السابقة
  if (sheetState) sheetState.cleanup?.();
  sheetState = { id, title, render, mark: sheetHooks.mark() };
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.innerHTML = '';
  const r = render(body);
  hydrateIcons(body);
  $('#sheet').classList.remove('hidden');
  document.body.classList.add('sheet-open');
  sheetState.cleanup = typeof r === 'function' ? r : null;
  document.dispatchEvent(new CustomEvent('sheet', { detail: id }));
}
export function refreshSheet() {
  if (!sheetState) return;
  const body = $('#sheet-body');
  const st = body.scrollTop;
  sheetState.cleanup?.();
  body.innerHTML = '';
  const r = sheetState.render(body);
  sheetState.cleanup = typeof r === 'function' ? r : null;
  hydrateIcons(body);
  body.scrollTop = st;
}
// ✓ اعتماد وإغلاق
export function closeSheet() {
  if (!sheetState) return;
  sheetState.cleanup?.();
  sheetState = null;
  $('#sheet').classList.add('hidden');
  document.body.classList.remove('sheet-open');
  document.dispatchEvent(new CustomEvent('sheet', { detail: null }));
}
// ✕ إلغاء كل ما تغيّر منذ فتح اللوحة
export function cancelSheet() {
  if (!sheetState) return;
  const m = sheetState.mark;
  closeSheet();
  if (sheetHooks.rollback(m)) toast('أُلغيت التغييرات');
}
export const sheetId = () => sheetState?.id || null;

// منزلق آمن للمس: لا يتغير بمجرد تمرير الإصبع على الشاشة.
// يتحرك فقط بسحب المقبض نفسه (أو بالأزرار − و+، أو بكتابة الرقم)، ولمس المسار لا يقفز بالقيمة.
// بالفأرة على اللابتوب يعمل النقر على المسار أيضًا. الاتجاه من اليمين إلى اليسار.
export function slider(label, { min, max, step = 0.01, value, fmt = (v) => v, oninput, onchange }) {
  min = +min; max = +max; step = +step;
  let v = Math.min(max, Math.max(min, +value));
  const dec = Math.max(0, (String(step).split('.')[1] || '').length);
  const q = (x) => +Math.min(max, Math.max(min, Math.round((x - min) / step) * step + min)).toFixed(dec);
  const val = h('button.val', { type: 'button', 'aria-label': 'اكتب القيمة' }, fmt(v));
  const fill = h('div.fill'), thumb = h('div.thumb');
  const track = h('div.srange', { role: 'slider', tabindex: 0, 'aria-label': label, 'aria-valuemin': min, 'aria-valuemax': max }, h('div.rail', {}, fill), thumb);
  const paint = () => {
    const p = max > min ? (v - min) / (max - min) : 0;
    fill.style.width = p * 100 + '%';
    thumb.style.right = `calc(${p * 100}% - 11px)`;
    track.setAttribute('aria-valuenow', v);
    val.textContent = fmt(v);
  };
  const set = (x, done) => {
    const nv = q(x);
    if (nv !== v) { v = nv; paint(); oninput?.(v); }
    if (done) onchange?.(v);
  };
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    const r = track.getBoundingClientRect();
    const tr = thumb.getBoundingClientRect();
    const onThumb = Math.abs(e.clientX - (tr.left + tr.width / 2)) < 26;
    if (!onThumb && e.pointerType !== 'mouse') return; // لمس المسار لا يغيّر شيئًا
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    if (!onThumb) set(min + ((r.right - e.clientX) / r.width) * (max - min));
    drag = { x0: e.clientX, v0: v, w: r.width };
    track.classList.add('drag');
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    set(drag.v0 + ((drag.x0 - e.clientX) / drag.w) * (max - min));
  });
  const end = () => { if (!drag) return; drag = null; track.classList.remove('drag'); onchange?.(v); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? -1 : 0;
    if (d) { e.preventDefault(); set(v + d * step, true); }
  });
  const stepBtn = (d, ic, lb) => h('button.step', { type: 'button', 'aria-label': lb, html: icon(ic, 16), onclick: () => set(v + d * step, true) });
  val.addEventListener('click', () => {
    const inp = h('input.vin', { type: 'number', step, min, max, value: v, inputmode: 'decimal', dir: 'ltr' });
    val.replaceWith(inp);
    inp.focus(); inp.select();
    const fin = () => { if (!inp.isConnected) return; const x = parseFloat(inp.value); inp.replaceWith(val); if (isFinite(x)) set(x, true); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fin(); if (e.key === 'Escape') inp.replaceWith(val); });
    inp.addEventListener('blur', fin);
  });
  paint();
  const row = h('div.row.sl', {}, h('label', {}, label), stepBtn(-1, 'minus', 'أنقص ' + label), track, stepBtn(1, 'plus', 'زد ' + label), val);
  row._set = (x) => set(x, true); // للاختبارات الآلية
  track._set = row._set;
  return row;
}

export function seg(options, value, onpick) {
  const el = h('div.seg');
  for (const [v, label] of options) {
    el.append(h('button', { type: 'button', class: v === value ? 'on' : '', onclick: () => { el.querySelectorAll('button').forEach((b) => b.classList.remove('on')); el.querySelector(`[data-v="${CSS.escape(String(v))}"]`).classList.add('on'); onpick(v); }, 'data-v': String(v) }, label));
  }
  return el;
}

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export async function shareFile(blob, name, title = 'مقطع') {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return true; } catch (e) { if (e.name === 'AbortError') return true; }
  }
  return false;
}

export function confirmBox(msg, okLabel = 'نعم') {
  return new Promise((resolve) => {
    const body = h('div', {}, h('p', {}, msg), h('div.row', {}, btn(okLabel, () => { resolve(true); closeModal(); }, { cls: 'pri' }), btn('إلغاء', () => { resolve(false); closeModal(); })));
    modal('تأكيد', body, { onClose: () => resolve(false) });
  });
}
