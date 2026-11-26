// لوحة النص: كتابة نص عربي، واختيار الخط واللون والحد والظل والخلفية، وحركات الدخول والخروج،
// وتوقيت الظهور. يُسحب النص على المعاينة لتغيير مكانه.
import { app, edit, live, commit, select, findSelected, shown } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { newText, ANIMS, ANIMS_PRO } from '../../engine/text.js';
import { FONTS, ensureFont } from '../../fonts.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast } from '../dom.js';

const COLORS = ['#ffffff', '#000000', '#ffd400', '#ff3b30', '#ff6a3d', '#34c759', '#0a84ff', '#bf5af2', '#ff2d92', '#8e8e93'];

export function addText(opts = {}) {
  const t0 = app.preview.time;
  const T = layout(app.project).duration;
  const tx = newText({ start: t0, end: Math.min(Math.max(T, t0 + 0.5), t0 + 3), ...opts });
  edit('إضافة نص', (p) => p.texts.push(tx));
  select('text', tx.id);
  return tx;
}

export function openTextPanel() {
  let tab = 'text';
  openSheet('text', 'نص', (body) => {
    const sel = app.selected?.type === 'text' ? findSelected() : null;
    const visible = app.project.texts.slice().sort((a, b) => a.start - b.start);
    body.append(h('div.row', {}, btn('نص جديد', () => { addText(); refreshSheet(); setTimeout(() => document.querySelector('#sheet textarea')?.focus(), 50); }, { icon: 'plus', cls: 'pri' })));
    if (visible.length > 1 || (visible.length && !sel)) {
      const chips = h('div.chips');
      for (const x of visible) chips.append(h('button.chip' + (sel?.id === x.id ? '.on' : ''), { onclick: () => { select('text', x.id); app.preview.seek(x.start + 0.01); refreshSheet(); } }, (x.lyric ? '♪ ' : '') + (x.text.slice(0, 14) || '…'), h('small', {}, fmtTime(x.start))));
      body.append(chips);
    }
    if (!sel) { body.append(h('p.hint', {}, 'اكتب عنوانًا أو تعليقًا. يظهر النص عند موضع المؤشر لمدة 3 ثوانٍ، ويمكنك سحبه على المعاينة.')); return; }
    const tx = sel;
    const ta = h('textarea', { value: tx.text, dir: 'rtl', placeholder: 'اكتب النص هنا', 'aria-label': 'النص' });
    ta.addEventListener('input', () => { tx.text = ta.value; live(); });
    ta.addEventListener('change', () => commit('تعديل النص'));
    body.append(ta);
    body.append(seg([['text', 'الخط واللون'], ['style', 'الحد والخلفية'], ['anim', 'الحركة'], ['time', 'التوقيت']], tab, (v) => { tab = v; refreshSheet(); }));
    if (tab === 'text') {
      const fonts = h('div.chips');
      for (const f of FONTS) {
        if (f.id !== tx.font && !shown('fonts', f.id)) continue;
        ensureFont(f.id).then(() => {});
        fonts.append(h('button.chip' + (tx.font === f.id ? '.on' : ''), { style: { fontFamily: `"${f.id}"`, fontSize: '20px', minWidth: '96px' }, onclick: () => { edit('الخط', () => { tx.font = f.id; }); } }, tx.text.split('\n')[0].slice(0, 8) || 'مقطع', h('small', { style: { fontFamily: 'Cairo', fontSize: '11px' } }, f.label)));
      }
      body.append(fonts);
      body.append(slider('الحجم', { min: 0.03, max: 0.25, step: 0.005, value: tx.size, fmt: (v) => Math.round(v * 100), oninput: (v) => { tx.size = v; live(); }, onchange: () => commit('حجم النص') }));
      body.append(colorRow('اللون', tx.color, (c) => edit('لون النص', () => { tx.color = c; })));
      body.append(h('div.row', {}, h('label', {}, 'المحاذاة'), seg([['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']], tx.align, (v) => edit('محاذاة', () => { tx.align = v; }))),
        btn('عريض', () => edit('عريض', () => { tx.bold = !tx.bold; }), { cls: tx.bold ? 'on' : '' }));
      body.append(h('div.row', {}, h('label', {}, 'المكان'), seg([['0.15', 'أعلى'], ['0.5', 'وسط'], ['0.8', 'أسفل']], String(tx.y), (v) => edit('مكان النص', () => { tx.y = +v; tx.x = 0.5; }))));
    } else if (tab === 'style') {
      body.append(slider('سماكة الحد', { min: 0, max: 2, step: 0.05, value: tx.stroke?.width || 0, fmt: (v) => v.toFixed(1), oninput: (v) => { tx.stroke = { ...(tx.stroke || { color: '#000' }), width: v }; live(); }, onchange: () => commit('حد النص') }));
      body.append(colorRow('لون الحد', tx.stroke?.color || '#000000', (c) => edit('لون الحد', () => { tx.stroke = { ...(tx.stroke || { width: 0.6 }), color: c }; })));
      body.append(h('div.row', {}, btn(tx.shadow ? 'إلغاء الظل' : 'ظل', () => edit('ظل', () => { tx.shadow = !tx.shadow; }), { cls: tx.shadow ? 'on' : '' }),
        btn(tx.bg ? 'إزالة الخلفية' : 'خلفية خلف النص', () => edit('خلفية النص', () => { tx.bg = tx.bg ? null : { color: '#000000', opacity: 0.55 }; }), { cls: tx.bg ? 'on' : '' })));
      if (tx.bg) {
        body.append(colorRow('لون الخلفية', tx.bg.color, (c) => edit('لون الخلفية', () => { tx.bg.color = c; })));
        body.append(slider('شفافية الخلفية', { min: 0.1, max: 1, step: 0.05, value: tx.bg.opacity, fmt: (v) => Math.round(v * 100) + '٪', oninput: (v) => { tx.bg.opacity = v; live(); }, onchange: () => commit('خلفية النص') }));
      }
      body.append(slider('الميلان', { min: -30, max: 30, step: 1, value: tx.rotation || 0, fmt: (v) => v + '°', oninput: (v) => { tx.rotation = v; live(); }, onchange: () => commit('ميلان') }));
    } else if (tab === 'anim') {
      body.append(h('p.hint', {}, 'حركة الظهور'), animChips(tx.animIn, (v) => { edit('حركة', () => { tx.animIn = v; }); app.preview.seek(tx.start + 0.01); playRange(tx.start, Math.min(tx.end, tx.start + (tx.animDur || 0.4) + 0.6)); }));
      body.append(h('p.hint', {}, 'حركة الاختفاء'), animChips(tx.animOut, (v) => { edit('حركة', () => { tx.animOut = v; }); playRange(Math.max(tx.start, tx.end - (tx.animDur || 0.4) - 0.6), tx.end + 0.05); }));
      if (!isDesktop()) body.append(h('p.hint', {}, 'على اللابتوب تظهر حركات إضافية أكثر.'));
      body.append(slider('مدة الحركة', { min: 0.1, max: 1.5, step: 0.05, value: tx.animDur, fmt: (v) => v.toFixed(2) + ' ث', onchange: (v) => edit('مدة الحركة', () => { tx.animDur = v; }) }));
    } else {
      // توقيت دقيق (للأغاني): أدخل الثانية بالضبط، أو حرّك بخطوات صغيرة، أو خذ موضع المؤشر
      const T = Math.max(0.5, layout(app.project).duration);
      body.append(timeRow('يظهر عند', () => tx.start, (v) => { tx.start = Math.max(0, Math.min(v, tx.end - 0.1)); }, () => tx.start + 0.01));
      body.append(timeRow('يختفي عند', () => tx.end, (v) => { tx.end = Math.max(tx.start + 0.1, Math.min(v, T + 30)); }, () => Math.max(tx.start, tx.end - 0.05)));
      body.append(h('p.hint', {}, `المدة ${(tx.end - tx.start).toFixed(2)} ث. شغّل الأغنية وأوقفها عند بداية المقطع ثم اضغط «من المؤشر».`));
      const sorted = app.project.texts.filter((x) => x.id !== tx.id && x.start >= tx.start).sort((a, b) => a.start - b.start);
      const next = sorted[0];
      body.append(h('div.row', {},
        btn('جرّب السطر', () => playRange(Math.max(0, tx.start - 0.5), tx.end + 0.3), { icon: 'play' }),
        btn('طوال الفيديو', () => edit('توقيت', () => { tx.start = 0; tx.end = T; })),
        next ? btn('يبدأ التالي عند نهايته', () => { edit('ربط التوقيت', () => { next.start = tx.end; if (next.end <= next.start) next.end = next.start + 1; }); toast('بدأ السطر التالي عند نهاية هذا'); }) : null));
    }
    body.append(h('div.row', {},
      btn('نسخ', () => { const c = { ...JSON.parse(JSON.stringify(tx)), id: 'txt_' + Math.random().toString(36).slice(2, 10), y: Math.min(0.95, tx.y + 0.1) }; edit('نسخ النص', (p) => p.texts.push(c)); select('text', c.id); }, { icon: 'copy' }),
      btn('حذف النص', () => { edit('حذف النص', (p) => { p.texts = p.texts.filter((x) => x.id !== tx.id); }); select(null); toast('حُذف النص'); }, { icon: 'delete', cls: 'danger' })));
  });
}

export function colorRow(label, value, onpick) {
  const row = h('div.row', {}, h('label', {}, label));
  for (const c of COLORS) row.append(h('button', { type: 'button', 'aria-label': c, style: { width: '36px', height: '36px', borderRadius: '50%', background: c, border: c === value ? '3px solid #4da3ff' : '2px solid #444' }, onclick: () => onpick(c) }));
  const inp = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff' });
  inp.addEventListener('change', () => onpick(inp.value));
  row.append(inp);
  return row;
}

export const isDesktop = () => matchMedia('(pointer: fine) and (min-width: 900px)').matches;

function animChips(value, onpick) {
  const el = h('div.chips', { style: { flexWrap: 'wrap' } });
  const all = { ...ANIMS, ...(isDesktop() ? ANIMS_PRO : {}) };
  if (!all[value] && ANIMS_PRO[value]) all[value] = ANIMS_PRO[value];
  for (const [k, label] of Object.entries(all)) {
    if (k !== 'none' && k !== value && !shown('anims', k)) continue;
    el.append(h('button.chip' + (value === k ? '.on' : ''), { onclick: () => onpick(k) }, label));
  }
  return el;
}

// تشغيل جزء قصير للمعاينة ثم التوقف
let stopTimer = null;
export function playRange(a, b) {
  clearTimeout(stopTimer);
  app.preview.seek(Math.max(0, a));
  app.preview.play();
  stopTimer = setTimeout(() => { if (app.preview.playing) app.preview.pause(); }, Math.max(300, (b - a) * 1000));
}

function timeRow(label, get, set, seekTo) {
  const fix = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const inp = h('input.inp.tin', { type: 'number', step: '0.01', min: 0, value: fix(get()), dir: 'ltr', inputmode: 'decimal', 'aria-label': label + ' (ثانية)' });
  const apply = (v) => { edit(label, () => set(v)); inp.value = fix(get()); app.preview.seek(seekTo()); };
  inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (isFinite(v)) apply(v); });
  const nud = (d) => h('button.btn.nudge', { type: 'button', onclick: () => apply(get() + d) }, (d > 0 ? '+' : '−') + Math.abs(d));
  return h('div.row.trow', {}, h('label', {}, label), nud(-0.5), nud(-0.05), inp, nud(0.05), nud(0.5),
    btn('من المؤشر', () => apply(app.preview.time), { icon: 'tap' }));
}
