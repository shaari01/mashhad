// السرعة من 0.25× إلى 4×، ومنحنيات السرعة، والعكس. والمقاس والخلفية.
import { app, edit, live, commit, targetClip } from '../../app.js';
import { CURVES, clipDuration } from '../../core/timeline.js';
import { ASPECTS } from '../../core/project.js';
import { h, btn, slider, seg, openSheet, toast } from '../dom.js';
import { colorRow } from './text.js';
import * as lib from '../../media/library.js';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function openSpeedPanel() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  openSheet('speed', 'السرعة', (body) => {
    const clip = app.project.clips.find((x) => x.id === c.id);
    if (!clip) return;
    if (clip.type !== 'video') { body.append(h('p.hint', {}, 'السرعة للفيديو فقط. للصورة غيّر مدتها من أداة «قص».')); return; }
    const chips = h('div.chips');
    for (const s of SPEEDS) chips.append(h('button.chip' + (clip.speed === s ? '.on' : ''), { onclick: () => edit('السرعة', () => { clip.speed = s; }) }, s + '×'));
    body.append(chips);
    // منزلق لوغاريتمي: المنتصف = 1×
    const toPos = (s) => Math.log2(s);
    body.append(slider('السرعة', { min: -2, max: 2, step: 0.05, value: toPos(clip.speed), fmt: (v) => Math.pow(2, v).toFixed(2) + '×', oninput: (v) => { clip.speed = Math.round(Math.pow(2, v) * 100) / 100; live(); }, onchange: () => commit('السرعة') }));
    body.append(h('p.hint', {}, `المدة بعد التغيير: ${clipDuration(clip).toFixed(1)} ث`));
    body.append(h('p.hint', {}, 'منحنى السرعة'));
    const cur = h('div.chips');
    for (const [k, v] of Object.entries(CURVES)) {
      const cv = h('canvas', { width: 64, height: 40 });
      const g = cv.getContext('2d');
      g.strokeStyle = '#ffb547'; g.lineWidth = 2; g.beginPath();
      v.pts.forEach((s, i) => { const x = 62 - (i / Math.max(1, v.pts.length - 1)) * 60; const y = 38 - (Math.log2(s) + 2) / 4 * 36; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      cur.append(h('button.chip' + ((clip.curve || 'none') === k ? '.on' : ''), { onclick: () => edit('منحنى السرعة', () => { clip.curve = k; }) }, cv, v.label));
    }
    body.append(cur);
    body.append(h('div.row', {},
      btn(clip.reverse ? 'إلغاء العكس' : 'عكس الاتجاه', () => edit('عكس', () => { clip.reverse = !clip.reverse; }), { icon: 'reverse', cls: clip.reverse ? 'on' : '' }),
      btn('طبّق على الكل', () => { edit('السرعة للكل', (p) => p.clips.forEach((x) => { if (x.type === 'video') { x.speed = clip.speed; x.curve = clip.curve; } })); toast('تم'); })));
    if (clip.reverse) body.append(h('p.hint', {}, 'المعاينة المعكوسة قد تتقطع على الجوال، لكن الفيديو المصدَّر يكون سليمًا.'));
  });
}

const ASPECT_ICON = { '9:16': [18, 32], '16:9': [32, 18], '1:1': [26, 26], '4:5': [24, 30] };

export function openAspectPanel() {
  openSheet('aspect', 'المقاس والخلفية', (body) => {
    const p = app.project;
    const chips = h('div.chips');
    for (const [k, v] of Object.entries(ASPECTS)) {
      const [w, hh] = ASPECT_ICON[k];
      chips.append(h('button.chip' + (p.aspect === k ? '.on' : ''), { onclick: () => edit('المقاس', (pp) => { pp.aspect = k; }) },
        h('span', { style: { width: w + 'px', height: hh + 'px', border: '2px solid currentColor', borderRadius: '4px', display: 'block' } }), v.label));
    }
    body.append(chips);
    const bg = p.background || { type: 'blur' };
    body.append(h('div.row', {}, h('label', {}, 'الخلفية'), seg([['blur', 'ضبابية من المقطع'], ['color', 'لون'], ['image', 'صورة']], bg.type, async (v) => {
      if (v === 'image') {
        const files = await lib.pickFiles('image', { multiple: false, preferCopy: app.settings.copyAlways });
        if (!files.length) return;
        const rec = await lib.importFile(files[0], { copyAlways: app.settings.copyAlways });
        edit('خلفية صورة', (pp) => { pp.background = { ...bg, type: 'image', mediaId: rec.id }; });
      } else edit('الخلفية', (pp) => { pp.background = { ...bg, type: v }; });
    })));
    if (bg.type === 'color') body.append(colorRow('اللون', bg.color || '#000000', (c) => edit('لون الخلفية', (pp) => { pp.background = { ...bg, color: c }; })));
    body.append(h('p.hint', {}, 'تظهر الخلفية حين لا يملأ المقطع الإطار. لملء الإطار بقص الأطراف: أداة «تدوير» ← «ملء الإطار».'));
  });
}
