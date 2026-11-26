// السحب على المعاينة: تحريك النصوص والملصقات بالإصبع أو الفأرة، وتكبيرها بإصبعين أو بعجلة الفأرة.
import { app, select, live, commit, findSelected } from '../app.js';
import { hitBoxes } from '../engine/text.js';
import { $ } from './dom.js';

const providers = []; // {type, boxes: () => Map(id->box), get: id => obj, onSelect}
export function registerDraggable(p) { providers.push(p); }

registerDraggable({ type: 'text', boxes: () => hitBoxes, get: (id) => app.project.texts.find((t) => t.id === id), sizeKey: 'size' });

function hit(nx, ny) {
  // الأحدث فوق، والمحدد أولًا
  const sel = app.selected;
  for (const p of providers) {
    if (sel?.type === p.type) { const b = p.boxes().get(sel.id); if (b && inside(b, nx, ny)) return { p, id: sel.id }; }
  }
  for (const p of [...providers].reverse()) {
    for (const [id, b] of [...p.boxes()].reverse()) if (inside(b, nx, ny)) return { p, id };
  }
  return null;
}
const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export function installStage({ onOpen } = {}) {
  const cv = $('#preview');
  const pointers = new Map();
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && drag) { // تكبير بإصبعين
      const [a, b] = [...pointers.values()];
      drag.pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      drag.size0 = drag.obj[drag.p.sizeKey];
      return;
    }
    const hh = hit(nx, ny);
    if (!hh) { if (!app.preview.playing && app.selected && ['text', 'overlay'].includes(app.selected.type)) select(null); return; }
    const obj = hh.p.get(hh.id);
    if (!obj) return;
    cv.setPointerCapture(e.pointerId);
    if (!(app.selected?.type === hh.p.type && app.selected.id === hh.id)) { select(hh.p.type, hh.id); onOpen?.(hh.p.type, obj); }
    drag = { p: hh.p, obj, sx: nx, sy: ny, ox: obj.x, oy: obj.y, odx: obj.dx || 0, ody: obj.dy || 0, moved: false };
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    if (pointers.size >= 2 && drag.pinch0) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      drag.obj[drag.p.sizeKey] = Math.max(0.02, Math.min(1.5, drag.size0 * (d / drag.pinch0)));
      drag.moved = true;
      live();
      return;
    }
    const r = cv.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    if (drag.obj.track?.length) {
      // ملصق متتبَّع: السحب يزيح الملصق عن النقطة المتتبَّعة
      drag.obj.dx = drag.odx + nx - drag.sx;
      drag.obj.dy = drag.ody + ny - drag.sy;
    } else {
      drag.obj.x = Math.max(0, Math.min(1, drag.ox + nx - drag.sx));
      drag.obj.y = Math.max(0, Math.min(1, drag.oy + ny - drag.sy));
      // التصاق بالمنتصف
      if (Math.abs(drag.obj.x - 0.5) < 0.02) drag.obj.x = 0.5;
    }
    drag.moved = true;
    live();
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (drag && pointers.size === 0) { if (drag.moved) commit('تحريك'); drag = null; }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => {
    const s = app.selected;
    const p = providers.find((x) => x.type === s?.type);
    const obj = p && findSelected();
    if (!obj) return;
    e.preventDefault();
    obj[p.sizeKey] = Math.max(0.02, Math.min(1.5, obj[p.sizeKey] * (e.deltaY < 0 ? 1.06 : 0.94)));
    live();
    clearTimeout(cv._wt); cv._wt = setTimeout(() => commit('تكبير'), 400);
  }, { passive: false });

  // إطار حول العنصر المحدد
  app.preview.extraDraw = (ctx, W, H) => {
    const s = app.selected;
    const p = providers.find((x) => x.type === s?.type);
    const b = p?.boxes().get(s.id);
    if (!b) return;
    ctx.save();
    ctx.strokeStyle = '#4da3ff';
    ctx.lineWidth = Math.max(2, W / 200);
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
    ctx.restore();
  };
}
