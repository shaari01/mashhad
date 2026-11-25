// نافذة التصدير: MP4 بدقة 720 أو 1080 أو 4K، و30 أو 60 إطارًا، ومقاسات المنصات،
// وتصدير الصوت فقط، والإطار كصورة، والمشاركة المباشرة (واتساب وغيره) في أندرويد.
import { app } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { ASPECTS } from '../../core/project.js';
import { exportVideo, exportFrame, exportAudio, benchmark, PRESETS, supportInfo } from '../../engine/export.js';
import { outputSize } from '../../engine/render.js';
import * as db from '../../storage/db.js';
import { h, btn, seg, modal, closeModal, toast, download, shareFile } from '../dom.js';

const safeName = (s) => (s || 'مقطع').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);

export async function logPerf(entry) {
  const log = (await db.get('kv', 'perfLog')) || [];
  log.unshift({ ...entry, at: Date.now(), ua: navigator.userAgent });
  await db.put('kv', log.slice(0, 30), 'perfLog');
}

function verdict(speed) {
  if (speed >= 1) return ['good', `ممتاز: التصدير أسرع من مدة الفيديو (${speed.toFixed(2)}×). جهازك يناسب هذه الدقة.`];
  if (speed >= 0.4) return ['mid', `مقبول: كل دقيقة فيديو تحتاج نحو ${Math.ceil(1 / speed)} دقائق تصدير.`];
  return ['bad', `بطيء: كل دقيقة فيديو تحتاج نحو ${Math.ceil(1 / speed)} دقائق. جرّب دقة 720 و30 إطارًا.`];
}

export async function openExport() {
  const p = app.project;
  const T = layout(p).duration;
  if (!p.clips.length) return toast('أضف مقاطع أولًا');
  app.preview.pause();
  const st = { preset: null, short: 1080, fps: 30, aspect: p.aspect };
  const body = h('div');
  const can4k = await supportInfo(2160, 3840).then((i) => !!i.video).catch(() => false);
  const sizeInfo = h('p.hint');
  const upd = () => { const s = outputSize(st.aspect, st.short); sizeInfo.textContent = `الناتج: ${s.w}×${s.h} — ${st.fps} إطارًا/ث — المدة ${fmtTime(T)} — المقاس ${ASPECTS[st.aspect].label}`; };
  const chips = h('div.chips');
  for (const pr of PRESETS) {
    chips.append(h('button.chip', { onclick: (e) => {
      chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
      st.preset = pr.id; st.short = pr.short; st.fps = pr.fps; if (pr.aspect) st.aspect = pr.aspect;
      resSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === st.short));
      upd();
    } }, pr.label));
  }
  const resSeg = seg([[720, '720p'], [1080, '1080p'], ...(can4k ? [[2160, '4K']] : [])], st.short, (v) => { st.short = +v; upd(); });
  const fpsSeg = seg([[30, '30'], [60, '60']], st.fps, (v) => { st.fps = +v; upd(); });
  body.append(h('p.hint', {}, 'مقاسات جاهزة للمنصات:'), chips,
    h('div.row', {}, h('label', {}, 'الدقة'), resSeg),
    h('div.row', {}, h('label', {}, 'الإطارات/ث'), fpsSeg), sizeInfo);
  upd();
  const prog = h('div.progress.hidden', {}, h('div'));
  const status = h('p.hint');
  const result = h('div');
  let ctrl = null;
  const goBtn = btn('صدّر الفيديو MP4', async () => {
    goBtn.disabled = true;
    prog.classList.remove('hidden');
    result.innerHTML = '';
    ctrl = new AbortController();
    cancelBtn.classList.remove('hidden');
    try {
      const { blob, stats } = await exportVideo(app.project, {
        short: st.short, fps: st.fps, aspect: st.aspect, signal: ctrl.signal,
        onProgress: ({ phase, value, elapsed }) => {
          prog.firstChild.style.width = Math.round((phase === 'audio' ? 0.02 : value) * 100) + '%';
          status.textContent = phase === 'audio' ? 'مزج الأصوات…' : phase === 'finalize' ? 'إنهاء الملف…' : `الترميز ${Math.round(value * 100)}٪ — مضى ${Math.round(elapsed)} ث`;
        },
      });
      await logPerf({ kind: 'export', ...stats });
      window.__lastExport = { blob, stats };
      const name = safeName(app.project.name) + '.mp4';
      const [cls, msg] = verdict(stats.speed);
      status.textContent = 'اكتمل التصدير.';
      const vid = h('video', { src: URL.createObjectURL(blob), controls: true, playsInline: true, style: { width: '100%', maxHeight: '40vh', background: '#000', borderRadius: '10px' } });
      result.append(
        h('div.verdict.' + cls, {}, msg),
        h('div.stat', {},
          h('span', {}, 'الأبعاد'), h('b', {}, `${stats.W}×${stats.H} @ ${stats.fps}`),
          h('span', {}, 'مدة الفيديو'), h('b', {}, stats.duration.toFixed(1) + ' s'),
          h('span', {}, 'زمن التصدير'), h('b', {}, stats.elapsed.toFixed(1) + ' s'),
          h('span', {}, 'سرعة الرسم'), h('b', {}, stats.renderFps.toFixed(1) + ' fps'),
          h('span', {}, 'الترميز'), h('b', {}, `${stats.videoCodec} / ${stats.audioCodec || '—'}`),
          h('span', {}, 'الحجم'), h('b', {}, (stats.size / 1048576).toFixed(1) + ' MB')),
        vid,
        h('div.row', {},
          btn('مشاركة', async () => { if (!(await shareFile(blob, name, app.project.name))) { download(blob, name); toast('المشاركة غير متاحة هنا، فحُفظ الملف'); } }, { icon: 'share', cls: 'pri' }),
          btn('حفظ في الجهاز', () => download(blob, name), { icon: 'download' })));
      if (stats.videoCodec !== 'avc') result.append(h('p.hint', {}, 'تنبيه: هذا المتصفح لا يرمّز H.264، فاستُخدم ' + stats.videoCodec + ' داخل MP4. قد لا يفتحه واتساب؛ استخدم Chrome أو Edge المحدَّث.'));
    } catch (e) {
      status.textContent = e.name === 'AbortError' ? 'أُلغي التصدير.' : 'فشل التصدير: ' + e.message;
      console.error(e);
    } finally {
      goBtn.disabled = false;
      cancelBtn.classList.add('hidden');
      prog.classList.add('hidden');
    }
  }, { icon: 'export', cls: 'pri' });
  const cancelBtn = btn('إلغاء', () => ctrl?.abort(), { cls: 'hidden danger' });
  body.append(h('div.row', {}, goBtn, cancelBtn), prog, status, result);
  body.append(h('hr', { style: { borderColor: '#2c313c', margin: '14px 0' } }),
    h('div.row', {},
      btn('الصوت فقط', async () => {
        status.textContent = 'تصدير الصوت…';
        try { const { blob, ext } = await exportAudio(app.project); status.textContent = ''; const name = safeName(app.project.name) + '.' + ext; if (!(await shareFile(blob, name))) download(blob, name); } catch (e) { status.textContent = 'فشل: ' + e.message; }
      }, { icon: 'music' }),
      btn('الإطار الحالي كصورة', async () => {
        try { const blob = await exportFrame(app.project, app.preview.time, st.short); const name = safeName(app.project.name) + '-' + app.preview.time.toFixed(1) + '.png'; if (!(await shareFile(blob, name))) download(blob, name); } catch (e) { toast('فشل: ' + e.message); }
      }, { icon: 'image' })));
  modal('تصدير', body, { onClose: () => ctrl?.abort() });
}

// اختبار أداء الجهاز (هدف المرحلة 1)
export async function openBenchmark() {
  const body = h('div');
  const out = h('div');
  const prog = h('div.progress', {}, h('div'));
  body.append(h('p', {}, 'يصدّر البرنامج فيديو اختباريًا قصيرًا بدقتي 720 و1080 ويقيس سرعة جهازك. لا يُحفظ شيء.'), prog, out);
  const run = btn('ابدأ الاختبار', async () => {
    run.disabled = true;
    out.innerHTML = '';
    const info = await supportInfo();
    out.append(h('div.stat', {}, h('span', {}, 'WebCodecs'), h('b', {}, info.webcodecs ? 'نعم' : 'لا'), h('span', {}, 'ترميز الفيديو'), h('b', {}, info.video || '—'), h('span', {}, 'ترميز الصوت'), h('b', {}, info.audio || '—')));
    for (const [short, fps] of [[720, 30], [1080, 30], [1080, 60]]) {
      const r = await benchmark(short, fps, 3, (v) => { prog.firstChild.style.width = Math.round(v * 100) + '%'; });
      if (!r.ok) { out.append(h('div.verdict.bad', {}, r.reason)); break; }
      await logPerf({ kind: 'bench', ...r });
      const [cls] = verdict(r.realtime);
      out.append(h('div.verdict.' + cls, {}, `${r.W}×${r.H} @ ${fps}: ${r.renderFps.toFixed(0)} إطار/ث — ${r.realtime.toFixed(2)}× من السرعة الحقيقية`));
    }
    out.append(h('p.hint', {}, 'الاختبار يقيس الرسم والترميز فقط. فك ترميز مقاطعك يضيف عبئًا، فجرّب أيضًا تصدير مشروع حقيقي وانظر النتيجة في نافذة التصدير.'));
    run.disabled = false;
  }, { cls: 'pri', icon: 'speed' });
  body.prepend(h('div.row', {}, run));
  const log = (await db.get('kv', 'perfLog')) || [];
  if (log.length) {
    const tbl = h('div.stat');
    for (const e of log.slice(0, 8)) tbl.append(h('span', {}, new Date(e.at).toLocaleString('ar') + (e.kind === 'export' ? ' (تصدير)' : ' (اختبار)')), h('b', {}, `${e.W}×${e.H}@${e.fps} ${(e.speed || e.realtime || 0).toFixed(2)}×`));
    body.append(h('p.hint', {}, 'سجل القياسات السابقة على هذا الجهاز:'), tbl);
  }
  modal('اختبار أداء الجهاز', body);
}
