// لوحات المقطع: القص (وحذف جزء من الوسط)، والتدوير والقلب، والصوت، والنسخ والاستبدال والحذف.
import { app, edit, live, commit, select, targetClip, emit } from '../../app.js';
import { layout, clipDuration, srcLength, sourceTime, fmtTime, localTimeForSource } from '../../core/timeline.js';
import * as E from '../../core/edits.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, seg, openSheet, refreshSheet, closeSheet, toast, confirmBox } from '../dom.js';
import { trimmer } from '../trimmer.js';
import { filmstrip } from '../filmstrip.js';

const itemOf = (id) => layout(app.project).items.find((x) => x.clip.id === id);

export function openTrim() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  let mode = 'trim';
  openSheet('trim', 'قص', (body) => {
    const clip = app.project.clips.find((x) => x.id === c.id);
    if (!clip) return closeSheet();
    if (clip.type === 'image' || clip.type === 'freeze') {
      body.append(h('p.hint', {}, clip.type === 'image' ? 'مدة ظهور الصورة' : 'مدة الإطار المجمّد'));
      body.append(slider('المدة', { min: 0.5, max: 20, step: 0.1, value: clip.duration, fmt: (v) => v.toFixed(1) + ' ث', oninput: (v) => { clip.duration = v; live(); }, onchange: () => commit('مدة الصورة') }));
      body.append(h('div.row', {}, btn('طبّق المدة على كل الصور', () => {
        edit('مدة الصور', (p) => p.clips.forEach((x) => { if (x.type === 'image') x.duration = clip.duration; }));
        toast('تم');
      })));
      return;
    }
    const D = clip.srcDuration || clip.out;
    body.append(seg([['trim', 'قص الطرفين'], ['cut', 'حذف جزء من الوسط']], mode, (v) => { mode = v; refreshSheet(); }));
    const info = h('div.row.hint');
    const showInfo = (a, b) => {
      info.textContent = mode === 'trim'
        ? `من ${fmtTime(a, true)} إلى ${fmtTime(b, true)} — المدة ${fmtTime(b - a, true)}`
        : `سيُحذف من ${fmtTime(a, true)} إلى ${fmtTime(b, true)} (${(b - a).toFixed(1)} ث)`;
    };
    let tr;
    if (mode === 'trim') {
      tr = trimmer({
        duration: D, a: clip.in, b: clip.out,
        onInput: (a, b, which) => {
          clip.in = a; clip.out = b; live(); showInfo(a, b);
          const it = itemOf(clip.id);
          if (it) app.preview.seek(which === 'a' ? it.start + 0.001 : it.end - 0.04);
        },
        onEnd: () => commit('قص'),
      });
      showInfo(clip.in, clip.out);
    } else {
      const L = srcLength(clip);
      const st = { a: clip.in + L * 0.35, b: clip.in + L * 0.65 };
      tr = trimmer({
        duration: D, a: st.a, b: st.b, cut: true,
        onInput: (a, b, which) => {
          a = Math.max(clip.in, a); b = Math.min(clip.out, b);
          st.a = a; st.b = b; showInfo(a, b);
          const it = itemOf(clip.id);
          if (it) app.preview.seek(it.start + localTimeForSource(clip, which === 'a' ? a : b));
        },
      });
      showInfo(st.a, st.b);
      body.append(tr, info, h('div.row', {}, btn('احذف هذا الجزء', () => {
        const la = localTimeForSource(clip, clip.reverse ? st.b : st.a), lb = localTimeForSource(clip, clip.reverse ? st.a : st.b);
        const ok = edit('حذف جزء', (p) => E.deleteRange(p, clip.id, la, lb));
        toast(ok ? 'حُذف الجزء' : 'تعذّر الحذف');
        mode = 'trim';
        refreshSheet();
      }, { icon: 'delete', cls: 'pri' })));
      filmstrip(clip.mediaId).then((imgs) => { const s = tr.querySelector('.strip'); imgs.forEach((src) => s.append(h('img', { src, alt: '' }))); });
      return;
    }
    body.append(tr, info);
    const nudge = (which, d) => () => {
      if (which === 'a') clip.in = Math.max(0, Math.min(clip.in + d, clip.out - 0.1));
      else clip.out = Math.min(D, Math.max(clip.out + d, clip.in + 0.1));
      tr.set(clip.in, clip.out); showInfo(clip.in, clip.out); commit('قص');
    };
    body.append(h('div.row', {},
      h('label', {}, 'البداية'), btn('', nudge('a', -0.1), { icon: 'minus' }), btn('', nudge('a', 0.1), { icon: 'plus' }),
      h('label', {}, 'النهاية'), btn('', nudge('b', -0.1), { icon: 'minus' }), btn('', nudge('b', 0.1), { icon: 'plus' })));
    body.append(h('div.row', {}, btn('اجعل البداية عند المؤشر', () => setAtHead('a'), {}), btn('اجعل النهاية عند المؤشر', () => setAtHead('b'), {})));
    function setAtHead(which) {
      const it = itemOf(clip.id);
      if (!it) return;
      const s = sourceTime(clip, app.preview.time - it.start);
      if (which === 'a' && s < clip.out - 0.1) clip.in = s;
      if (which === 'b' && s > clip.in + 0.1) clip.out = s;
      commit('قص'); refreshSheet();
    }
    filmstrip(clip.mediaId).then((imgs) => { const s = tr.querySelector('.strip'); imgs.forEach((src) => s.append(h('img', { src, alt: '' }))); });
  });
}

export function doSplit() {
  const t = app.preview.time;
  const r = edit('تقسيم', (p) => E.splitAt(p, t, p.beats?.length ? p.beats : null));
  if (r) { select('clip', r.second.id); toast('قُسِّم المقطع عند المؤشر'); } else toast('حرّك المؤشر إلى داخل مقطع ثم قسّم');
}

export function doDelete() {
  const c = targetClip();
  if (!c) return;
  edit('حذف', (p) => E.removeClip(p, c.id));
  select(null);
  closeSheet();
  toast('حُذف المقطع (يمكنك التراجع)');
}

export function doDuplicate() {
  const c = targetClip();
  if (!c) return;
  const n = edit('نسخ', (p) => E.duplicateClip(p, c.id));
  if (n) { select('clip', n.id); toast('نُسخ المقطع'); }
}

export async function doReplace() {
  const c = targetClip();
  if (!c) return;
  const files = await lib.pickFiles('visual', { multiple: false, preferCopy: app.settings.copyAlways });
  if (!files.length) return;
  try {
    const rec = await lib.importFile(files[0], { copyAlways: app.settings.copyAlways });
    edit('استبدال', (p) => E.replaceMedia(p, c.id, rec));
    toast('استُبدل الملف مع الحفاظ على التعديلات');
  } catch (e) { toast(e.message); }
}

export function openTransform() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  openSheet('transform', 'تدوير وقلب', (body) => {
    const clip = app.project.clips.find((x) => x.id === c.id);
    if (!clip) return closeSheet();
    body.append(h('div.row', {},
      btn('تدوير ٩٠°', () => edit('تدوير', () => { clip.rotate = ((clip.rotate || 0) + 90) % 360; }), { icon: 'rotate' }),
      btn('قلب أفقي', () => edit('قلب', () => { clip.flipH = !clip.flipH; }), { icon: 'flip', cls: clip.flipH ? 'on' : '' }),
      btn('قلب عمودي', () => edit('قلب', () => { clip.flipV = !clip.flipV; }), { icon: 'flip', cls: clip.flipV ? 'on' : '' })));
    body.append(h('div.row', {}, h('label', {}, 'الملاءمة'), seg([['contain', 'كامل مع خلفية'], ['cover', 'ملء الإطار']], clip.fit || 'contain', (v) => edit('ملاءمة', () => { clip.fit = v; }))));
    // التكبير والتحريك داخل الإطار
    const z = clip.zoom || { enabled: false, from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.15, x: 0.5, y: 0.5 } };
    body.append(h('div.row', {}, h('label', {}, 'تكبير وتحريك'), seg([['off', 'بلا'], ['in', 'تقريب'], ['out', 'تبعيد'], ['pan', 'تحريك جانبي']],
      !z.enabled ? 'off' : z.to.s > z.from.s ? 'in' : z.to.s < z.from.s ? 'out' : 'pan', (v) => edit('تكبير', () => {
        clip.zoom = v === 'off' ? { ...z, enabled: false }
          : v === 'in' ? { enabled: true, from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.25, x: 0.5, y: 0.5 } }
          : v === 'out' ? { enabled: true, from: { s: 1.25, x: 0.5, y: 0.5 }, to: { s: 1, x: 0.5, y: 0.5 } }
          : { enabled: true, from: { s: 1.25, x: 0.35, y: 0.5 }, to: { s: 1.25, x: 0.65, y: 0.5 } };
      }))));
    // قص الإطار (Crop) بنسب جاهزة
    body.append(h('div.row', {}, h('label', {}, 'قص الإطار'), seg([['none', 'بلا'], ['c1', 'مربع وسط'], ['c916', '٩:١٦ وسط'], ['c169', '١٦:٩ وسط'], ['zoom', 'تقريب ٢٠٪']], clip.cropPreset || 'none', (v) => edit('قص الإطار', () => {
      clip.cropPreset = v;
      const rec = lib.cachedRecord(clip.mediaId) || { w: 16, h: 9 };
      const rot = (clip.rotate || 0) % 180 !== 0;
      const sw = rot ? rec.h : rec.w, sh = rot ? rec.w : rec.h;
      const fitTo = (ar) => { const cur = sw / sh; return cur > ar ? { w: ar / cur, h: 1 } : { w: 1, h: cur / ar }; };
      let r = null;
      if (v === 'c1') r = fitTo(1);
      if (v === 'c916') r = fitTo(9 / 16);
      if (v === 'c169') r = fitTo(16 / 9);
      if (v === 'zoom') r = { w: 0.8, h: 0.8 };
      clip.crop = r ? { x: (1 - r.w) / 2, y: (1 - r.h) / 2, w: r.w, h: r.h } : null;
    }))));
  });
}

export function openVolume() {
  const c = targetClip();
  if (!c) return toast('أضف مقطعًا أولًا');
  openSheet('volume', 'صوت المقطع', (body) => {
    const clip = app.project.clips.find((x) => x.id === c.id);
    if (!clip) return closeSheet();
    if (clip.type !== 'video') { body.append(h('p.hint', {}, 'الصور والإطارات المجمدة بلا صوت.')); return; }
    body.append(slider('مستوى الصوت', { min: 0, max: 2, step: 0.05, value: clip.volume, fmt: (v) => Math.round(v * 100) + '٪', oninput: (v) => { clip.volume = v; }, onchange: () => commit('مستوى الصوت') }));
    body.append(h('div.row', {},
      btn(clip.muted ? 'إلغاء الكتم' : 'كتم صوت المقطع', () => edit('كتم', () => { clip.muted = !clip.muted; }) || refreshSheet(), { icon: clip.muted ? 'volume' : 'mute', cls: clip.muted ? 'on' : '' }),
      btn('طبّق المستوى على الكل', () => { edit('مستوى الصوت', (p) => p.clips.forEach((x) => { x.volume = clip.volume; })); toast('تم'); })));
    body.append(h('div.row', {}, btn('فصل الصوت عن الفيديو', () => detachAudio(clip), { icon: 'detach' })));
    body.append(h('p.hint', {}, 'فصل الصوت ينقله إلى مسار مستقل يمكنك تحريكه وقصه، ويُكتم صوت المقطع الأصلي.'));
  });
}

function detachAudio(clip) {
  const it = itemOf(clip.id);
  if (!it) return;
  edit('فصل الصوت', (p) => {
    p.audio.push({ id: 'aud_' + Math.random().toString(36).slice(2, 9), mediaId: clip.mediaId, kind: 'voice', start: it.start, in: clip.in, out: clip.out, volume: clip.volume, fadeIn: 0, fadeOut: 0, label: 'صوت مفصول' });
    const c = p.clips.find((x) => x.id === clip.id);
    c.muted = true;
  });
  toast('فُصل الصوت إلى مسار التسجيل');
  refreshSheet();
}

export async function confirmClear() {
  if (await confirmBox('حذف كل المقاطع من المشروع؟', 'احذف الكل')) edit('مسح', (p) => { p.clips = []; });
}
