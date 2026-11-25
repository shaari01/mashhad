// لوحة الموسيقى والأصوات: إضافة ملف، وقص بالشكل الموجي، وموضع البداية، والتلاشي، ومستوى الصوت.
import { app, edit, live, commit, select, findSelected } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { uid } from '../../core/project.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, openSheet, refreshSheet, closeSheet, toast, seg } from '../dom.js';
import { trimmer } from '../trimmer.js';
import { drawPeaks } from '../tracks.js';

const KIND_LABEL = { music: 'الموسيقى', sfx: 'المؤثرات الصوتية', voice: 'التسجيل الصوتي' };

export async function addAudioFile(kind = 'music') {
  const files = await lib.pickFiles('audio', { multiple: false, preferCopy: app.settings.copyAlways });
  if (!files.length) return null;
  toast('جارٍ قراءة الصوت…');
  try {
    const rec = await lib.importFile(files[0], { copyAlways: app.settings.copyAlways, forceKind: 'audio' });
    return addAudioItem(rec, kind);
  } catch (e) { toast(e.message, 4000); return null; }
}

export function addAudioItem(rec, kind = 'music', start = null) {
  const T = layout(app.project).duration;
  const item = {
    id: uid('aud'),
    mediaId: rec.id,
    kind,
    start: start ?? (kind === 'music' ? 0 : app.preview.time),
    in: 0,
    out: kind === 'music' && T > 0 ? Math.min(rec.duration, T) : rec.duration,
    volume: kind === 'music' ? 0.8 : 1,
    fadeIn: kind === 'music' ? 0.5 : 0,
    fadeOut: kind === 'music' ? 1.5 : 0,
  };
  edit('إضافة صوت', (p) => p.audio.push(item));
  select('audio', item.id);
  return item;
}

export function openAudioPanel(item = null, kind = 'music') {
  if (item) select('audio', item.id);
  openSheet('audio', item ? KIND_LABEL[item.kind || 'music'] : KIND_LABEL[kind], (body) => {
    const sel = app.selected?.type === 'audio' ? findSelected() : null;
    const k = sel?.kind || kind;
    const list = app.project.audio.filter((a) => (a.kind || 'music') === k);
    const head = h('div.row', {}, btn(k === 'music' ? 'أضف موسيقى من ملفاتك' : 'أضف ملفًا صوتيًا', async () => { const it = await addAudioFile(k); if (it) refreshSheet(); }, { icon: 'plus', cls: 'pri' }));
    body.append(head);
    if (k === 'music') {
      body.append(h('div.row', {}, h('label', {}, 'خفض تلقائي'), seg([['on', 'عند وجود كلام'], ['off', 'متوقف']], app.project.duck?.enabled ? 'on' : 'off', (v) => edit('خفض تلقائي', (p) => { p.duck = { ...(p.duck || { level: 0.3 }), enabled: v === 'on' }; }))));
    }
    if (list.length > 1 || (list.length && !sel)) {
      const chips = h('div.chips');
      for (const a of list) {
        const rec = lib.cachedRecord(a.mediaId);
        chips.append(h('button.chip' + (sel?.id === a.id ? '.on' : ''), { onclick: () => { select('audio', a.id); refreshSheet(); } }, rec?.name?.slice(0, 18) || 'صوت', h('small', {}, fmtTime(a.out - a.in))));
      }
      body.append(chips);
    }
    if (!sel) {
      if (!list.length) body.append(h('p.hint', {}, k === 'music' ? 'اختر أغنية أو موسيقى من جهازك. ستُقص تلقائيًا على طول الفيديو، ويمكنك تعديلها.' : 'لا توجد أصوات بعد.'));
      return;
    }
    const a = sel;
    const rec = lib.cachedRecord(a.mediaId);
    const D = rec?.duration || a.out;
    body.append(h('p.hint', {}, `${rec?.name || ''} — الجزء المستخدم ${fmtTime(a.in, true)} إلى ${fmtTime(a.out, true)}`));
    const tr = trimmer({
      duration: D, a: a.in, b: a.out,
      peaksDraw: (cv) => drawPeaks(cv, rec?.peaks || [], 0, 1, '#8fb0ff'),
      onInput: (x, y) => { a.in = x; a.out = y; live(); },
      onEnd: () => commit('قص الصوت'),
    });
    body.append(tr);
    const T = Math.max(1, layout(app.project).duration);
    body.append(slider('يبدأ عند', { min: 0, max: T, step: 0.05, value: a.start, fmt: (v) => fmtTime(v, true), oninput: (v) => { a.start = v; live(); }, onchange: () => commit('موضع الصوت') }));
    body.append(slider('المستوى', { min: 0, max: 2, step: 0.05, value: a.volume, fmt: (v) => Math.round(v * 100) + '٪', oninput: (v) => { a.volume = v; }, onchange: () => commit('مستوى الصوت') }));
    body.append(slider('تلاشٍ في البداية', { min: 0, max: 5, step: 0.1, value: a.fadeIn, fmt: (v) => v.toFixed(1) + ' ث', oninput: (v) => { a.fadeIn = v; }, onchange: () => commit('تلاشي') }));
    body.append(slider('تلاشٍ في النهاية', { min: 0, max: 5, step: 0.1, value: a.fadeOut, fmt: (v) => v.toFixed(1) + ' ث', oninput: (v) => { a.fadeOut = v; }, onchange: () => commit('تلاشي') }));
    body.append(h('div.row', {},
      btn('ابدأ من المؤشر', () => edit('موضع الصوت', () => { a.start = app.preview.time; }) ?? refreshSheet()),
      btn('طابق طول الفيديو', () => edit('طول الصوت', (p) => { a.out = Math.min(D, a.in + Math.max(0.5, layout(p).duration - a.start)); }) ?? refreshSheet()),
      btn('حذف', () => { edit('حذف صوت', (p) => { p.audio = p.audio.filter((x) => x.id !== a.id); }); select(null); refreshSheet(); }, { icon: 'delete', cls: 'danger' })));
  });
}
