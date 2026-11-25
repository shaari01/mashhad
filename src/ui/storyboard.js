// وضع البطاقات (أسلوب Movie Maker و VivaVideo): المقاطع بطاقات كبيرة، تُرتَّب بالسحب.
// الضغط المطوّل على البطاقة ثم السحب يغيّر ترتيبها (يعمل باللمس والفأرة).
import { app, select, edit, emit } from '../app.js';
import { layout, fmtTime } from '../core/timeline.js';
import { moveClip } from '../core/edits.js';
import * as lib from '../media/library.js';
import { h, $ } from './dom.js';
import { icon } from './icons.js';

let hooks = { between: null, onAdd: null, onOpen: null };
export function setStoryboardHooks(x) { hooks = { ...hooks, ...x }; }

export function renderStoryboard() {
  const box = $('#storyboard');
  const p = app.project;
  const lay = layout(p);
  const scroll = box.scrollLeft;
  box.innerHTML = '';
  lay.items.forEach((it, i) => {
    const c = it.clip;
    const rec = lib.cachedRecord(c.mediaId);
    const sel = app.selected?.type === 'clip' && app.selected.id === c.id;
    const badges = [];
    if (c.type === 'freeze') badges.push('تجميد');
    if (c.type === 'video' && (c.speed !== 1 || (c.curve && c.curve !== 'none'))) badges.push((c.curve && c.curve !== 'none' ? '〰' : '') + c.speed + '×');
    if (c.reverse) badges.push('↺');
    if (c.muted) badges.push('🔇');
    const missing = !lib.rt(c.mediaId)?.file;
    const card = h('div.card' + (sel ? '.sel' : '') + (missing ? '.missing' : ''), {
      role: 'listitem',
      'data-id': c.id,
      'data-index': i,
      'aria-label': `مقطع ${i + 1}، ${fmtTime(it.dur)}`,
      style: { backgroundImage: rec?.thumb ? `url(${rec.thumb})` : '' },
    },
    h('span.num', {}, String(i + 1)),
    h('span.dur', {}, fmtTime(it.dur, true)),
    badges.length ? h('span.badges', {}, ...badges.map((b) => h('span', {}, b))) : null,
    missing ? h('span.warn', {}, 'الملف غير متاح') : null);
    attachDrag(card, i);
    box.append(card);
    if (i < lay.items.length - 1 && hooks.between) {
      const b = hooks.between(i);
      if (b) box.append(b);
    }
  });
  const add = h('button.card.add', { 'aria-label': 'إضافة مقاطع', onclick: () => hooks.onAdd?.() });
  add.innerHTML = icon('add', 40);
  box.append(add);
  box.scrollLeft = scroll;
}

export function scrollToSelected() {
  const el = $('#storyboard .card.sel');
  el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function cardTap(i) {
  const it = layout(app.project).items[i];
  if (!it) return;
  const already = app.selected?.type === 'clip' && app.selected.id === it.clip.id;
  select('clip', it.clip.id);
  app.preview.seek(it.start + 0.01);
  if (already) hooks.onOpen?.(it.clip);
}

function attachDrag(card, index) {
  let timer = null, dragging = false, ghost = null, mark = null, startX = 0, startY = 0, moved = false, dropIndex = index;
  const box = () => $('#storyboard');

  const begin = (x, y) => {
    dragging = true;
    card.classList.add('dragging');
    ghost = card.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.classList.remove('dragging');
    document.body.append(ghost);
    mark = h('div.drop-mark');
    navigator.vibrate?.(20);
    moveTo(x, y);
  };
  const moveTo = (x, y) => {
    ghost.style.left = x - ghost.offsetWidth / 2 + 'px';
    ghost.style.top = y - ghost.offsetHeight / 2 + 'px';
    const cards = [...box().querySelectorAll('.card:not(.add):not(.ghost)')];
    // في الاتجاه من اليمين لليسار: كلما اتجهنا يسارًا زاد الترتيب
    let idx = cards.length;
    for (let k = 0; k < cards.length; k++) {
      const r = cards[k].getBoundingClientRect();
      if (x > r.left + r.width / 2) { idx = k; break; }
    }
    dropIndex = idx;
    const ref = cards[idx];
    if (ref) box().insertBefore(mark, ref); else box().insertBefore(mark, box().querySelector('.card.add'));
    // تمرير تلقائي قرب الحواف
    const br = box().getBoundingClientRect();
    if (x < br.left + 40) box().scrollLeft -= 12;
    if (x > br.right - 40) box().scrollLeft += 12;
  };
  const end = (commitMove) => {
    clearTimeout(timer);
    if (dragging) {
      ghost?.remove(); mark?.remove();
      card.classList.remove('dragging');
      dragging = false;
      let to = dropIndex > index ? dropIndex - 1 : dropIndex;
      if (commitMove && to !== index) {
        edit('ترتيب', (p) => moveClip(p, index, to));
        app.preview.invalidate();
      } else emit('project');
    } else if (!moved && commitMove) cardTap(index);
  };

  // اللمس
  card.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; moved = false;
    timer = setTimeout(() => begin(startX, startY), 320);
  }, { passive: true });
  card.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (dragging) { e.preventDefault(); moveTo(t.clientX, t.clientY); return; }
    if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) { moved = true; clearTimeout(timer); }
  }, { passive: false });
  card.addEventListener('touchend', (e) => { e.preventDefault(); end(true); });
  card.addEventListener('touchcancel', () => end(false));
  card.addEventListener('contextmenu', (e) => e.preventDefault());

  // الفأرة
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    startX = e.clientX; startY = e.clientY; moved = false;
    const mm = (ev) => {
      if (!dragging && (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6)) { moved = true; begin(ev.clientX, ev.clientY); }
      else if (dragging) moveTo(ev.clientX, ev.clientY);
    };
    const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); end(true); };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
}
