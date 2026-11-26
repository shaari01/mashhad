// شريط الأصوات تحت البطاقات: الموسيقى والمؤثرات والتسجيلات، مع الشكل الموجي وعلامات الإيقاع.
// الزمن يجري من اليمين إلى اليسار، مثل ترتيب البطاقات.
import { audioItemDuration } from '../engine/audioplan.js';
import { app, select } from '../app.js';
import { layout } from '../core/timeline.js';
import * as lib from '../media/library.js';
import { h, $ } from './dom.js';
import { icon } from './icons.js';

let hooks = { openAudio: null, extraRows: null };
export function setTrackHooks(x) { hooks = { ...hooks, ...x }; }

export function drawPeaks(canvas, peaks, from = 0, to = 1, color = '#8fb0ff', rtl = true) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, canvas.clientWidth * dpr), hh = Math.max(1, canvas.clientHeight * dpr);
  canvas.width = w; canvas.height = hh;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, hh);
  if (!peaks?.length) return;
  ctx.fillStyle = color;
  const a = Math.floor(from * peaks.length), b = Math.max(a + 1, Math.ceil(to * peaks.length));
  const n = b - a;
  for (let x = 0; x < w; x++) {
    const v = peaks[a + Math.floor((x / w) * n)] || 0;
    const bh = Math.max(1, v * hh * 0.95);
    ctx.fillRect(rtl ? w - x - 1 : x, (hh - bh) / 2, 1, bh);
  }
}

export function renderTracks() {
  const box = $('#tracks');
  box.innerHTML = '';
  const p = app.project;
  const T = Math.max(0.1, layout(p).duration);
  const items = p.audio || [];
  const rows = [];
  const groups = [
    ['music', 'music', 'الموسيقى'],
    ['sfx', 'sfx', 'المؤثرات'],
    ['voice', 'mic', 'التسجيل'],
  ];
  for (const [kind, ic, label] of groups) {
    const list = items.filter((a) => (a.kind || 'music') === kind);
    if (!list.length && !(kind === 'music' && (p.beats?.length || p.clips.length))) continue;
    const lane = h('div.track-lane', { 'aria-label': label });
    for (const a of list) {
      const rec = lib.cachedRecord(a.mediaId);
      const d = audioItemDuration(a);
      const el = h('div.aud-item.' + kind + (app.selected?.type === 'audio' && app.selected.id === a.id ? '.sel' : ''), {
        style: { right: (a.start / T) * 100 + '%', width: Math.max(1, (d / T) * 100) + '%' },
        onclick: () => { select('audio', a.id); hooks.openAudio?.(a); },
      });
      const cv = h('canvas');
      el.append(cv, h('span.nm', {}, rec?.name || label));
      lane.append(el);
      requestAnimationFrame(() => rec?.peaks && drawPeaks(cv, rec.peaks, a.in / rec.duration, a.out / rec.duration, kind === 'sfx' ? '#ffd28a' : kind === 'voice' ? '#8ff0c4' : '#8fb0ff'));
    }
    if (kind === 'music') for (const b of p.beats || []) lane.append(h('div.beat-mark', { style: { right: (b / T) * 100 + '%' } }));
    lane.append(h('div.lane-head', { 'data-head': '1' }));
    lane.addEventListener('click', (e) => {
      if (e.target !== lane) return;
      const r = lane.getBoundingClientRect();
      app.preview.seek(((r.right - e.clientX) / r.width) * T);
    });
    const lb = h('button.track-label', { 'aria-label': label, onclick: () => hooks.openAudio?.(null, kind) });
    lb.innerHTML = icon(ic, 22);
    rows.push(h('div.track-row', {}, lb, lane));
  }
  if (hooks.extraRows) rows.push(...hooks.extraRows(T));
  box.append(...rows);
  updateHeads(app.preview?.time || 0);
}

export function updateHeads(t) {
  const T = Math.max(0.1, layout(app.project).duration);
  document.querySelectorAll('[data-head]').forEach((el) => { el.style.right = Math.min(100, (t / T) * 100) + '%'; });
}
