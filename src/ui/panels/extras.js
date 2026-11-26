// المرحلة 6: تتبع الحركة، والشاشة الخضراء (Chroma Key)، والترجمة التلقائية من الكلام.
import { app, edit, live, commit, saveSettings } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { toGray, trackSequence, smoothTrack } from '../../core/track.js';
import { segmentsFromResponse, parseSubtitles, applyCaptions, toSRT, CAPTION_STYLE } from '../../core/captions.js';
import { overlayPos } from '../../engine/overlays.js';
import { baseFrames, prepareAudio } from '../../engine/export.js';
import { scheduleMix, encodeWav } from '../../engine/audio.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast, download } from '../dom.js';
import { colorRow } from './text.js';

// ———— تتبع الحركة ————
let tracking = false;
export async function trackOverlay(id, onProgress) {
  const find = () => app.project.overlays.find((x) => x.id === id);
  const o = find();
  if (!o) return null;
  const from = o.start, to = Math.min(o.end, layout(app.project).duration);
  const start = overlayPos({ ...o, dx: 0, dy: 0 }, from);
  const grays = [], times = [];
  let w = 0, hh = 0;
  const N = Math.max(1, Math.ceil((to - from) * 12));
  for await (const f of baseFrames(app.project, { from, to, fps: 12, short: 160 })) {
    grays.push(toGray(f.data, f.w, f.h)); times.push(f.t); w = f.w; hh = f.h;
    onProgress?.(grays.length / N);
  }
  if (grays.length < 2) return null;
  const raw = trackSequence(grays, w, hh, start);
  const pts = smoothTrack(raw, 1);
  const lostAt = raw.findIndex((p) => p.lost);
  const cur = find();
  if (!cur) return null;
  edit('تتبع الحركة', () => { cur.track = pts.map((p, i) => ({ t: Math.round(times[i] * 1000) / 1000, x: p.x, y: p.y })); cur.dx = 0; cur.dy = 0; });
  return { points: pts.length, lostAt: lostAt > 0 ? times[lostAt] : null };
}

function trackSection(body, o) {
  body.append(h('h3', {}, 'تتبع الحركة'));
  body.append(h('p.hint', {}, 'ضع مركز الملصق على الشخص أو الشيء المتحرك في أول ظهوره، ثم اضغط «تتبّع». سيلحقه الملصق تلقائيًا.'));
  const status = h('span.hint');
  body.append(h('div.row', {},
    btn(tracking ? 'جارٍ التتبع…' : 'تتبّع الحركة', async () => {
      if (tracking) return;
      tracking = true;
      status.textContent = 'جارٍ التحليل… 0٪';
      try {
        const r = await trackOverlay(o.id, (v) => { status.textContent = `جارٍ التحليل… ${Math.round(Math.min(1, v) * 100)}٪`; });
        if (!r) toast('لا يوجد ما يُتتبَّع هنا');
        else toast(r.lostAt != null ? `تُتُبّع حتى ${fmtTime(r.lostAt, true)} ثم فُقد الهدف، فبقي الملصق مكانه` : 'تم التتبع. شغّل لترى الملصق يلحق الحركة');
      } catch (e) { toast('تعذّر التتبع: ' + e.message); }
      tracking = false;
      refreshSheet();
    }, { icon: 'track', cls: 'pri' }),
    o.track?.length ? btn('ألغِ التتبع', () => edit('إلغاء التتبع', () => { const p = overlayPos(o, app.preview.time); o.x = p.x; o.y = p.y; o.track = null; o.dx = 0; o.dy = 0; }), { icon: 'close' }) : null,
    status));
  if (o.track?.length) body.append(h('p.hint', {}, `الملصق متتبَّع (${o.track.length} نقطة). اسحبه على المعاينة لإزاحته عن الهدف.`));
}

// ———— الشاشة الخضراء ————
function cornerColor(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1], [0, 15], [15, 15]]) { const i = (y * 16 + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      const hx = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      res('#' + hx(r) + hx(gg) + hx(b));
    };
    im.onerror = () => res(null);
    im.src = src;
  });
}

function chromaSection(body, o) {
  body.append(h('h3', {}, 'إزالة الخلفية الخضراء'));
  const on = !!o.chroma;
  body.append(h('div.row', {}, btn(on ? 'مفعّلة: أوقفها' : 'أزل الخلفية الخضراء', () => edit('الشاشة الخضراء', () => { o.chroma = on ? null : { color: '#00d000', tol: 0.3, soft: 0.12 }; }), { icon: 'chroma', cls: on ? 'on' : 'pri' })));
  if (!on) return;
  body.append(h('div.row', {}, h('label', {}, 'لون الخلفية'), seg([['#00d000', 'أخضر'], ['#0047ff', 'أزرق'], ['pick', 'من زاوية المقطع']], ['#00d000', '#0047ff'].includes(o.chroma.color) ? o.chroma.color : 'pick', async (v) => {
    const c = v === 'pick' ? await cornerColor(lib.cachedRecord(o.mediaId)?.thumb) : v;
    if (!c) return toast('تعذّرت قراءة اللون');
    edit('لون المفتاح', () => { o.chroma.color = c; });
  })));
  body.append(colorRow('لون مخصص', o.chroma.color, (c) => edit('لون المفتاح', () => { o.chroma.color = c; })));
  body.append(slider('قوة الإزالة', { min: 0.05, max: 0.8, step: 0.01, value: o.chroma.tol, fmt: (v) => Math.round(v * 100), oninput: (v) => { o.chroma.tol = v; live(); }, onchange: () => commit('قوة الإزالة') }));
  body.append(slider('نعومة الحواف', { min: 0, max: 0.4, step: 0.01, value: o.chroma.soft ?? 0.12, fmt: (v) => Math.round(v * 100), oninput: (v) => { o.chroma.soft = v; live(); }, onchange: () => commit('نعومة الحواف') }));
  body.append(h('div.row', {}, btn('املأ الشاشة', () => edit('ملء الشاشة', () => { o.x = 0.5; o.y = 0.5; o.size = 1; o.border = null; o.track = null; }), { icon: 'expand' })));
}

export function overlayExtras(body, o) {
  if (['image', 'video', 'anim'].includes(o.kind)) chromaSection(body, o);
  trackSection(body, o);
}

// ———— الترجمة التلقائية ————
async function speechWav() {
  const p = app.project;
  const T = layout(p).duration;
  if (T <= 0) throw new Error('المشروع فارغ');
  // صوت المقاطع والتسجيل فقط (بلا موسيقى ولا مؤثرات) ليكون التفريغ أدق
  const q = { ...p, audio: (p.audio || []).filter((a) => a.kind === 'voice'), duck: null };
  const buffers = await prepareAudio(q);
  const sr = 16000;
  const ctx = new OfflineAudioContext(1, Math.ceil(T * sr), sr);
  scheduleMix(ctx, q, buffers, { from: 0, base: 0, total: T });
  const buf = await ctx.startRendering();
  return { wav: encodeWav(buf), T };
}

export async function transcribe(settings = app.settings.transcribe) {
  if (!settings.url) throw new Error('أدخل عنوان خدمة التفريغ أولًا');
  const { wav, T } = await speechWav();
  if (wav.size > 24 * 1024 * 1024) throw new Error('الفيديو طويل جدًا للخدمة (الحد قرابة 12 دقيقة من الكلام)');
  const fd = new FormData();
  fd.append('file', wav, 'speech.wav');
  fd.append('model', settings.model || 'whisper-1');
  if (settings.lang) fd.append('language', settings.lang);
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'segment');
  const res = await fetch(settings.url, { method: 'POST', headers: settings.key ? { Authorization: 'Bearer ' + settings.key } : {}, body: fd });
  const txt = await res.text();
  if (!res.ok) throw new Error(`رفضت الخدمة الطلب (${res.status}) ${txt.slice(0, 120)}`);
  const segs = segmentsFromResponse(txt, T);
  if (!segs.length) throw new Error('لم تجد الخدمة كلامًا');
  edit('ترجمة تلقائية', (p) => applyCaptions(p, segs, captionStyle()));
  return segs.length;
}

let style = { ...CAPTION_STYLE };
const captionStyle = () => style;

export function openCaptionsPanel() {
  let busy = false;
  openSheet('captions', 'ترجمة تلقائية', (body) => {
    const s = (app.settings.transcribe ||= { url: '', key: '', model: 'whisper-1' });
    const caps = (app.project.texts || []).filter((t) => t.caption).sort((a, b) => a.start - b.start);
    body.append(h('p.hint', {}, 'يكتب البرنامج الكلام المنطوق في الفيديو نصًا لتصحّحه. يحتاج خدمة تفريغ خارجية (مثل Whisper من OpenAI أو خدمة متوافقة) ومفتاحها، ويُرسل صوت الكلام فقط إليها.'));
    const field = (label, key, attrs = {}) => {
      const inp = h('input.inp', { value: s[key] || '', dir: 'ltr', ...attrs });
      inp.addEventListener('change', () => { s[key] = inp.value.trim(); saveSettings(); });
      return h('div.row', {}, h('label', {}, label), inp);
    };
    const det = h('details', { open: !s.url || undefined }, h('summary', {}, 'إعدادات الخدمة'),
      field('العنوان', 'url', { placeholder: 'https://api.openai.com/v1/audio/transcriptions', 'aria-label': 'عنوان خدمة التفريغ' }),
      field('المفتاح', 'key', { type: 'password', placeholder: 'sk-…', 'aria-label': 'مفتاح الخدمة' }),
      field('النموذج', 'model', { placeholder: 'whisper-1', 'aria-label': 'النموذج' }),
      field('اللغة', 'lang', { placeholder: 'ar', 'aria-label': 'اللغة' }),
      h('p.hint', {}, 'يُحفظ المفتاح على هذا الجهاز فقط.'));
    body.append(det);
    const status = h('span.hint');
    body.append(h('div.row', {},
      btn(busy ? 'جارٍ التفريغ…' : 'حوّل الكلام إلى نص', async () => {
        if (busy) return;
        if (!s.url) { s.url = 'https://api.openai.com/v1/audio/transcriptions'; saveSettings(); }
        busy = true; status.textContent = 'يُجهَّز الصوت ويُرسل…';
        try { const n = await transcribe(s); toast(`أُضيف ${n} سطر ترجمة. راجعها وصحّحها`); } catch (e) { toast(e.message, 6000); }
        busy = false; refreshSheet();
      }, { icon: 'captions', cls: 'pri' }),
      btn('استورد ملف SRT', () => {
        const inp = h('input', { type: 'file', accept: '.srt,.vtt,text/plain,text/vtt' });
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          const segs = parseSubtitles(await f.text());
          if (!segs.length) return toast('لم أجد ترجمة في الملف');
          edit('استيراد ترجمة', (p) => applyCaptions(p, segs, captionStyle()));
          toast(`استُورد ${segs.length} سطر`);
        };
        inp.click();
      }, { icon: 'folder' }),
      status));
    if (!caps.length) return;
    body.append(h('h3', {}, 'الأسطر (صحّحها هنا)'));
    body.append(h('div.row', {}, h('label', {}, 'المكان'), seg([['0.84', 'أسفل'], ['0.5', 'وسط'], ['0.14', 'أعلى']], String(caps[0].y), (v) => edit('مكان الترجمة', (p) => { style.y = +v; p.texts.forEach((t) => { if (t.caption) t.y = +v; }); }))));
    body.append(slider('حجم الخط', { min: 0.03, max: 0.12, step: 0.005, value: caps[0].size, fmt: (v) => Math.round(v * 1000), oninput: (v) => { style.size = v; caps.forEach((t) => { t.size = v; }); live(); }, onchange: () => commit('حجم الترجمة') }));
    body.append(h('div.row', {}, btn(caps[0].bg ? 'بلا خلفية' : 'خلفية داكنة', () => edit('خلفية الترجمة', (p) => { const bg = caps[0].bg ? null : { color: '#000000', opacity: 0.55 }; style.bg = bg; p.texts.forEach((t) => { if (t.caption) { t.bg = bg; t.stroke = { color: '#000', width: bg ? 0 : 0.6 }; } }); })),
      btn('احفظ SRT', () => download(new Blob([toSRT(app.project.texts)], { type: 'text/plain' }), (app.project.name || 'ترجمة') + '.srt'), { icon: 'download' }),
      btn('احذف الترجمة', () => edit('حذف الترجمة', (p) => { p.texts = p.texts.filter((t) => !t.caption); }), { icon: 'delete', cls: 'danger' })));
    const list = h('div');
    for (const t of caps) {
      const inp = h('input.inp', { value: t.text, dir: 'rtl', 'aria-label': 'سطر ترجمة' });
      inp.addEventListener('focus', () => app.preview.seek(t.start + 0.01));
      inp.addEventListener('input', () => { t.text = inp.value; live(); });
      inp.addEventListener('change', () => commit('تصحيح الترجمة'));
      list.append(h('div.list-item', {}, h('small', { style: { minWidth: '54px' } }, fmtTime(t.start)), inp));
    }
    body.append(list);
  });
}
