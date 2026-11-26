// الملصقات (إيموجي، وأشكال، وأسهم، وفقاعات كلام، وملصقاتك)، وفيديو أو صورة فوق الفيديو.
import { app, edit, live, commit, select, findSelected } from '../../app.js';
import { overlayExtras } from './extras.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { newOverlay, SHAPES } from '../../engine/overlays.js';
import * as lib from '../../media/library.js';
import { listInbox, removeInbox, APP_LABEL } from '../../media/inbox.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast } from '../dom.js';
import { colorRow } from './text.js';

const EMOJI = ['😂', '🤣', '😍', '😎', '😱', '😭', '🥳', '😡', '🤔', '😴', '🤯', '😇', '👍', '👏', '🙏', '💪', '❤️', '🔥', '⭐', '✨', '🎉', '🎂', '🎈', '🎁', '💯', '👀', '💥', '💨', '💤', '❓', '❗', '✅', '🌹', '🌙', '☀️', '🕋', '🇸🇦', '⚽', '🐪', '☕'];

function addOverlay(o) {
  const t0 = app.preview.time;
  const T = Math.max(layout(app.project).duration, t0 + 0.5);
  const ov = newOverlay({ start: t0, end: Math.min(T, t0 + (o.dur || 3)), ...o });
  delete ov.dur;
  edit('إضافة ملصق', (p) => p.overlays.push(ov));
  select('overlay', ov.id);
  return ov;
}

export async function importOverlayMedia(kind = 'image') {
  const files = await lib.pickFiles(kind === 'video' ? 'visual' : 'image', { multiple: false, preferCopy: app.settings.copyAlways });
  if (!files.length) return null;
  try {
    return await lib.importFile(files[0], { copyAlways: app.settings.copyAlways, role: kind === 'image' ? 'sticker' : null });
  } catch (e) { toast(e.message, 4000); return null; }
}

function overlayFromRecord(rec, pip = false) {
  if (rec.kind === 'video') return addOverlay({ kind: 'video', mediaId: rec.id, dur: Math.min(rec.duration, 5), size: 0.45, x: 0.72, y: 0.25, animIn: 'zoom', border: { color: '#ffffff', width: 1, radius: 0.06 } });
  return addOverlay({ kind: rec.animated ? 'anim' : 'image', mediaId: rec.id, size: pip ? 0.45 : 0.35, x: pip ? 0.72 : 0.5, y: pip ? 0.25 : 0.4, border: pip ? { color: '#ffffff', width: 1, radius: 0.06 } : null });
}

export function openStickerPanel() {
  const cur = app.selected?.type === 'overlay' ? findSelected() : null;
  if (cur && (cur.kind === 'video' || cur.border)) select(null);
  let tab = 'emoji';
  openSheet('sticker', 'ملصق', (body) => {
    const sel = app.selected?.type === 'overlay' ? findSelected() : null;
    if (sel) return overlayEditor(body, sel);
    body.append(seg([['emoji', 'إيموجي'], ['shape', 'أشكال وأسهم'], ['bubble', 'فقاعات كلام'], ['mine', 'ملصقاتك']], tab, (v) => { tab = v; refreshSheet(); }));
    const grid = h('div.grid');
    if (tab === 'emoji') {
      for (const e of EMOJI) grid.append(h('button.cell', { onclick: () => addOverlay({ kind: 'emoji', content: e, size: 0.25 }) }, e));
    } else if (tab === 'shape') {
      for (const [k, label] of Object.entries(SHAPES)) {
        if (k === 'bubble' || k === 'think') continue;
        const cv = h('canvas', { width: 56, height: 56 });
        drawShapePreview(cv, k);
        grid.append(h('button.cell', { 'aria-label': label, title: label, onclick: () => addOverlay({ kind: 'shape', content: k, color: k === 'circle' || k === 'rect' ? '#ff3b30' : k === 'heart' ? '#ff2d55' : '#ffd400', size: 0.3 }) }, cv));
      }
    } else if (tab === 'bubble') {
      for (const [k, txt] of [['bubble', 'ههههه'], ['bubble', 'يا سلام!'], ['think', 'وش ذا؟'], ['burst', 'واو!'], ['bubble', '']]) {
        grid.append(h('button.cell', { style: { fontSize: '14px' }, onclick: () => addOverlay({ kind: 'shape', content: k, text: txt, color: k === 'burst' ? '#ffd400' : '#ffffff', size: 0.45 }) }, (k === 'think' ? '💭 ' : k === 'burst' ? '💥 ' : '💬 ') + (txt || 'فارغة')));
      }
    } else {
      body.append(h('div.row', {}, btn('استورد PNG شفاف أو GIF', async () => { const r = await importOverlayMedia('image'); if (r) overlayFromRecord(r); }, { icon: 'image', cls: 'pri' })));
      body.append(h('p.hint', {}, 'ملصقاتك المستخدمة سابقًا:'));
      lib.allRecords?.().then((recs) => {
        for (const r of recs.filter((x) => x.kind === 'image' && x.role === 'sticker').slice(0, 30)) grid.append(h('button.cell', { onclick: () => overlayFromRecord(r) }, h('img', { src: r.thumb, alt: '' })));
      });
      inboxSection(body, 'visual', (rec) => overlayFromRecord(rec));
    }
    body.append(grid);
  });
}

function drawShapePreview(cv, k) {
  import('../../engine/overlays.js').then(({ drawOverlays, newOverlay: no }) => {
    const g = cv.getContext('2d');
    drawOverlays(g, 56, 56, { overlays: [no({ kind: 'shape', content: k, color: '#ffd400', size: 0.8, x: 0.5, y: 0.5, start: 0, end: 1, animIn: 'none', animOut: 'none' })] }, 0.5, new Map());
  });
}

export function inboxSection(body, type, onImport) {
  const box = h('div');
  body.append(box);
  listInbox(type).then((items) => {
    if (!items.length) return;
    box.append(h('p.hint', {}, 'وارد من برامجك الأخرى:'));
    for (const it of items) {
      box.append(h('div.list-item', {},
        h('div.meta', {}, h('b', {}, it.name || 'ملف'), h('small', {}, (APP_LABEL[it.from] || it.from || '') + (it.duration ? ' — ' + fmtTime(it.duration) : ''))),
        btn('استورد', async () => {
          const kind = it.type === 'audio' ? 'audio' : it.type === 'video' ? 'video' : 'image';
          const ext = (it.mime || '').split('/')[1] || 'bin';
          const rec = await lib.importBlob(it.blob, it.name || `وارد.${ext}`, kind, { role: type === 'audio' ? null : 'sticker' });
          await removeInbox(it.id);
          onImport(rec);
          toast('استُورد');
          refreshSheet();
        }, { cls: 'pri' })));
    }
  });
}

function overlayEditor(body, o) {
  const isMedia = o.kind === 'image' || o.kind === 'video' || o.kind === 'anim';
  body.append(h('div.row', {}, btn('ملصق آخر', () => { select(null); refreshSheet(); }, { icon: 'plus' }),
    h('span.hint', {}, o.kind === 'emoji' ? o.content : o.kind === 'shape' ? SHAPES[o.content] : o.kind === 'video' ? 'فيديو فوق فيديو' : 'صورة')));
  body.append(h('p.hint', {}, 'اسحب الملصق على المعاينة لتحريكه، وكبّره بإصبعين.'));
  body.append(slider('الحجم', { min: 0.05, max: 1.2, step: 0.01, value: o.size, fmt: (v) => Math.round(v * 100), oninput: (v) => { o.size = v; live(); }, onchange: () => commit('حجم الملصق') }));
  body.append(slider('الدوران', { min: -180, max: 180, step: 1, value: o.rot || 0, fmt: (v) => v + '°', oninput: (v) => { o.rot = v; live(); }, onchange: () => commit('دوران الملصق') }));
  body.append(slider('الشفافية', { min: 0.1, max: 1, step: 0.05, value: o.opacity ?? 1, fmt: (v) => Math.round(v * 100) + '٪', oninput: (v) => { o.opacity = v; live(); }, onchange: () => commit('شفافية') }));
  if (o.kind === 'shape') {
    body.append(colorRow('اللون', o.color, (c) => edit('لون الملصق', () => { o.color = c; })));
    if (['bubble', 'think', 'burst'].includes(o.content)) {
      const inp = h('input.inp', { value: o.text || '', dir: 'rtl', placeholder: 'نص الفقاعة' });
      inp.addEventListener('input', () => { o.text = inp.value; live(); });
      inp.addEventListener('change', () => commit('نص الفقاعة'));
      body.append(inp);
    }
  }
  if (isMedia) {
    body.append(h('div.row', {}, h('label', {}, 'المكان'), seg([['tr', 'أعلى يمين'], ['tl', 'أعلى يسار'], ['c', 'وسط'], ['br', 'أسفل يمين'], ['bl', 'أسفل يسار']], '', (v) => edit('مكان', () => {
      const m = { tr: [0.73, 0.22], tl: [0.27, 0.22], c: [0.5, 0.5], br: [0.73, 0.78], bl: [0.27, 0.78] }[v]; o.x = m[0]; o.y = m[1]; o.track = null;
    }))));
    body.append(h('div.row', {}, btn(o.border ? 'بلا إطار' : 'إطار أبيض', () => edit('إطار', () => { o.border = o.border ? null : { color: '#ffffff', width: 1, radius: 0.06 }; }), { cls: o.border ? 'on' : '' }),
      btn('قلب', () => edit('قلب', () => { o.flip = !o.flip; }), { icon: 'flip' })));
    if (o.kind === 'video') {
      const rec = lib.cachedRecord(o.mediaId);
      if (rec?.duration) body.append(slider('يبدأ الفيديو من', { min: 0, max: Math.max(0.1, rec.duration - 0.2), step: 0.05, value: o.srcIn || 0, fmt: (v) => fmtTime(v, true), oninput: (v) => { o.srcIn = v; live(); }, onchange: () => commit('بداية الفيديو') }));
    }
  }
  body.append(h('div.row', {}, h('label', {}, 'الدخول'), seg([['pop', 'قفزة'], ['fade', 'تلاشٍ'], ['zoom', 'تكبير'], ['none', 'بلا']], o.animIn, (v) => edit('حركة', () => { o.animIn = v; }))));
  const T = Math.max(0.5, layout(app.project).duration);
  body.append(slider('يظهر عند', { min: 0, max: T, step: 0.05, value: o.start, fmt: (v) => fmtTime(v, true), oninput: (v) => { const d = o.end - o.start; o.start = v; o.end = v + d; live(); }, onchange: () => commit('توقيت') }));
  body.append(slider('المدة', { min: 0.2, max: Math.max(1, T), step: 0.05, value: o.end - o.start, fmt: (v) => v.toFixed(1) + ' ث', oninput: (v) => { o.end = o.start + v; live(); }, onchange: () => commit('مدة') }));
  body.append(h('div.row', {},
    btn('يبدأ من المؤشر', () => edit('توقيت', () => { const d = o.end - o.start; o.start = app.preview.time; o.end = o.start + d; })),
    btn('حتى نهاية الفيديو', () => edit('توقيت', () => { o.end = T; })),
    btn('نسخ', () => { const c = { ...JSON.parse(JSON.stringify(o)), id: 'ovl_' + Math.random().toString(36).slice(2, 10), x: Math.min(0.9, o.x + 0.08), y: Math.min(0.9, o.y + 0.08) }; edit('نسخ الملصق', (p) => p.overlays.push(c)); select('overlay', c.id); }, { icon: 'copy' }),
    btn('حذف', () => { edit('حذف الملصق', (p) => { p.overlays = p.overlays.filter((x) => x.id !== o.id); }); select(null); refreshSheet(); }, { icon: 'delete', cls: 'danger' })));
  overlayExtras(body, o);
}

export function openPipPanel() {
  const cur = app.selected?.type === 'overlay' ? findSelected() : null;
  if (cur && !(cur.kind === 'video' || cur.border)) select(null);
  openSheet('pip', 'فوق الفيديو', (body) => {
    const sel = app.selected?.type === 'overlay' ? findSelected() : null;
    if (sel && (sel.kind === 'video' || sel.kind === 'image' || sel.kind === 'anim')) return overlayEditor(body, sel);
    body.append(h('p.hint', {}, 'ضع فيديو أو صورة في زاوية فوق الفيديو الأساسي (صورة داخل صورة).'));
    body.append(h('div.row', {},
      btn('فيديو فوق الفيديو', async () => { const r = await importOverlayMedia('video'); if (r) { overlayFromRecord(r, true); refreshSheet(); } }, { icon: 'pip', cls: 'pri' }),
      btn('صورة فوق الفيديو', async () => { const r = await importOverlayMedia('image'); if (r) { overlayFromRecord(r, true); refreshSheet(); } }, { icon: 'image' })));
    const list = app.project.overlays.filter((o) => ['video', 'image', 'anim'].includes(o.kind));
    for (const o of list) {
      const rec = lib.cachedRecord(o.mediaId);
      body.append(h('div.list-item', { onclick: () => { select('overlay', o.id); app.preview.seek(o.start + 0.01); refreshSheet(); } }, h('div.thumb', { style: { backgroundImage: rec?.thumb ? `url(${rec.thumb})` : '' } }), h('div.meta', {}, h('b', {}, rec?.name || 'طبقة'), h('small', {}, `${fmtTime(o.start)} – ${fmtTime(o.end)}`))));
    }
  });
}
