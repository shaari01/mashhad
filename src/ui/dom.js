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

// اللوحة السفلية للأدوات
let sheetState = null;
export function openSheet(id, title, render) {
  sheetState = { id, title, render };
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
export function closeSheet() {
  if (!sheetState) return;
  sheetState.cleanup?.();
  sheetState = null;
  $('#sheet').classList.add('hidden');
  document.body.classList.remove('sheet-open');
  document.dispatchEvent(new CustomEvent('sheet', { detail: null }));
}
export const sheetId = () => sheetState?.id || null;

// منزلق مع قيمة معروضة
export function slider(label, { min, max, step = 0.01, value, fmt = (v) => v, oninput, onchange }) {
  const val = h('span.val', {}, fmt(value));
  const r = h('input', { type: 'range', min, max, step, value });
  r.addEventListener('input', () => { val.textContent = fmt(+r.value); oninput?.(+r.value); });
  r.addEventListener('change', () => onchange?.(+r.value));
  return h('div.row', {}, h('label', {}, label), r, val);
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
