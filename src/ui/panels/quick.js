// أدوات سريعة للمجموعات: عكس الفيديو، وكتم الصوت، وضبط الصورة، والراوي، وضبط الصوت المختار.
import { app, edit, live, commit, select, targetClip, findSelected } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast } from '../dom.js';
import { openAudioPanel } from './music.js';

export function doReverse() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  if (c.type !== 'video') return toast('العكس للفيديو فقط');
  const on = edit('عكس', (p) => { const x = p.clips.find((y) => y.id === c.id); x.reverse = !x.reverse; return x.reverse; });
  toast(on ? 'عُكس المقطع: يُعرض من نهايته إلى بدايته' : 'أُلغي العكس');
}

export function doMute() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  if (c.type !== 'video') return toast('الصور بلا صوت');
  const on = edit('كتم', (p) => { const x = p.clips.find((y) => y.id === c.id); x.muted = !x.muted; return x.muted; });
  toast(on ? 'كُتم صوت المقطع' : 'عاد صوت المقطع');
}

// ضبط الصورة المختارة: المدة، والحركة البطيئة، والملاءمة، والتدوير والقلب
export function openImagePanel() {
  const sel = app.selected?.type === 'clip' ? app.project.clips.find((x) => x.id === app.selected.id) : null;
  const c = sel?.type === 'image' ? sel : app.project.clips.find((x) => x.type === 'image');
  if (!c) return toast('أضف صورة أولًا من «إضافة صور»');
  select('clip', c.id);
  openSheet('imgset', 'ضبط الصورة', (body) => {
    const clip = app.project.clips.find((x) => x.id === c.id);
    if (!clip) return;
    body.append(slider('المدة', { min: 0.5, max: 20, step: 0.1, value: clip.duration, fmt: (v) => v.toFixed(1) + ' ث', oninput: (v) => { clip.duration = v; live(); }, onchange: () => commit('مدة الصورة') }));
    const z = clip.zoom;
    const cur = !z?.enabled ? 'off' : z.to.s > z.from.s ? 'in' : z.to.s < z.from.s ? 'out' : 'pan';
    body.append(h('div.row', {}, h('label', {}, 'الحركة'), seg([['off', 'ثابتة'], ['in', 'تقريب'], ['out', 'تبعيد'], ['pan', 'انزلاق']], cur, (v) => edit('حركة الصورة', () => {
      clip.zoom = v === 'off' ? { ...(z || {}), enabled: false }
        : v === 'in' ? { enabled: true, from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.25, x: 0.5, y: 0.5 } }
        : v === 'out' ? { enabled: true, from: { s: 1.25, x: 0.5, y: 0.5 }, to: { s: 1, x: 0.5, y: 0.5 } }
        : { enabled: true, from: { s: 1.25, x: 0.35, y: 0.5 }, to: { s: 1.25, x: 0.65, y: 0.5 } };
    }))));
    body.append(h('div.row', {}, h('label', {}, 'الملاءمة'), seg([['contain', 'كاملة'], ['cover', 'ملء الإطار']], clip.fit || 'contain', (v) => edit('ملاءمة', () => { clip.fit = v; }))));
    body.append(h('div.row', {},
      btn('تدوير', () => edit('تدوير', () => { clip.rotate = ((clip.rotate || 0) + 90) % 360; }), { icon: 'rotate' }),
      btn('قلب أفقي', () => edit('قلب', () => { clip.flipH = !clip.flipH; }), { icon: 'flip', cls: clip.flipH ? 'on' : '' }),
      btn('قلب عمودي', () => edit('قلب', () => { clip.flipV = !clip.flipV; }), { icon: 'flipv', cls: clip.flipV ? 'on' : '' })));
    const a = clip.adjust || (clip.adjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 });
    const row = (label, key) => slider(label, { min: -1, max: 1, step: 0.02, value: a[key] || 0, fmt: (v) => Math.round(v * 100), oninput: (v) => { a[key] = v; live(); }, onchange: () => commit('ضبط الصورة') });
    body.append(row('السطوع', 'brightness'), row('التباين', 'contrast'), row('التشبع', 'saturation'));
    body.append(h('div.row', {}, btn('طبّق المدة والحركة على كل الصور', () => {
      edit('ضبط كل الصور', (p) => p.clips.forEach((x) => { if (x.type === 'image' && x.id !== clip.id) { x.duration = clip.duration; x.zoom = clip.zoom ? JSON.parse(JSON.stringify(clip.zoom)) : null; x.fit = clip.fit; } }));
      toast('طُبّق على كل الصور');
    })));
  });
}

// ضبط الصوت المختار (أو أول صوت): البداية والنهاية والسرعة والتلاشي
export function openAudioSettings() {
  const sel = app.selected?.type === 'audio' ? findSelected() : null;
  const a = sel || app.project.audio[0];
  if (!a) return toast('أضف موسيقى أو صوت راوٍ أولًا');
  openAudioPanel(a, a.kind || 'music');
}

export function openNarrator() {
  const sel = app.selected?.type === 'audio' ? findSelected() : null;
  if (sel && sel.kind !== 'voice') select(null);
  openAudioPanel(sel?.kind === 'voice' ? sel : null, 'voice');
}

export const tabFor = (s) => {
  if (!s) return null;
  if (s.type === 'text') return 'text';
  if (s.type === 'audio') return 'audio';
  if (s.type === 'overlay') return 'image';
  if (s.type === 'clip') return app.project.clips.find((c) => c.id === s.id)?.type === 'image' ? 'image' : 'video';
  return null;
};
export { fmtTime, layout };
