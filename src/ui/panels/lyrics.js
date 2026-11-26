// كلمات الأغاني بالنقر، والكاراوكي، وعلامات الإيقاع
import { app, edit, commit, select } from '../../app.js';
import { layout, fmtTime } from '../../core/timeline.js';
import { clone } from '../../core/project.js';
import { parseLyrics, tapLine, untapLine, finishLyrics, applyLyrics, defaultLyricStyle, addBeat, detectBeats } from '../../core/lyrics.js';
import { fitClipsToBeats } from '../../core/edits.js';
import { FONTS } from '../../fonts.js';
import * as lib from '../../media/library.js';
import { h, btn, slider, seg, openSheet, refreshSheet, toast, confirmBox } from '../dom.js';
import { colorRow } from './text.js';
import { addAudioFile } from './music.js';

const musicItems = () => app.project.audio.filter((a) => (a.kind || 'music') === 'music');

export function openLyricsPanel() {
  let step = app.project.lyrics?.lines?.length ? 'edit' : 'paste';
  let syncing = false;
  let keyHandler = null;
  openSheet('lyrics', 'كلمات الأغنية', (body) => {
    const p = app.project;
    const music = musicItems();
    if (!music.length) {
      body.append(h('p.hint', {}, 'أضف الأغنية أولًا، ثم الصق كلماتها وانقر مع الغناء ليوضع كل سطر في وقته.'),
        h('div.row', {}, btn('أضف الأغنية', async () => { await addAudioFile('music'); refreshSheet(); }, { icon: 'music', cls: 'pri' })));
      return;
    }
    if (!p.lyrics) p.lyrics = { audioId: music[0].id, style: defaultLyricStyle(), lines: [] };
    const L = p.lyrics;
    const song = p.audio.find((a) => a.id === L.audioId) || music[0];
    L.audioId = song.id;
    body.append(seg([['paste', '١. الكلمات'], ['sync', '٢. التوقيت بالنقر'], ['edit', '٣. التعديل'], ['style', '٤. الشكل']], step, (v) => { step = v; syncing = false; app.preview.pause(); refreshSheet(); }));

    if (step === 'paste') {
      const ta = h('textarea', { dir: 'rtl', placeholder: 'الصق كلمات الأغنية هنا، كل سطر في سطر', value: L.lines.map((l) => l.text).join('\n'), style: { minHeight: '160px' } });
      body.append(ta, h('div.row', {}, btn('التالي: التوقيت', () => {
        const old = new Map(L.lines.map((l) => [l.text, l]));
        const lines = parseLyrics(ta.value).map((l) => old.get(l.text) ? { ...l, start: old.get(l.text).start, end: old.get(l.text).end } : l);
        if (!lines.length) return toast('الصق الكلمات أولًا');
        edit('كلمات الأغنية', (pp) => { pp.lyrics.lines = lines; applyLyrics(pp); });
        step = 'sync'; refreshSheet();
      }, { cls: 'pri' })));
      if (music.length > 1) {
        body.append(h('p.hint', {}, 'الأغنية:'), seg(music.map((m) => [m.id, lib.cachedRecord(m.mediaId)?.name?.slice(0, 16) || 'صوت']), L.audioId, (v) => { L.audioId = v; commit('اختيار الأغنية'); }));
      }
      return;
    }

    if (step === 'sync') {
      const next = L.lines.findIndex((l) => l.start == null);
      const done = next < 0;
      const cur = h('div', { style: { fontSize: '22px', fontWeight: 700, minHeight: '36px', textAlign: 'center' } }, done ? 'وُقّتت كل الأسطر ✓' : L.lines[next].text);
      const after = h('div.hint', { style: { textAlign: 'center' } }, !done && L.lines[next + 1] ? 'بعده: ' + L.lines[next + 1].text : '');
      const counter = h('p.hint', { style: { textAlign: 'center' } }, `${done ? L.lines.length : next} من ${L.lines.length}`);
      const tap = () => {
        if (!syncing) { syncing = true; app.preview.seek(song.start); app.preview.play(); tapBtn.querySelector('span').textContent = 'انقر عند بداية السطر'; return; }
        const i = tapLine(L, app.preview.time);
        if (i < 0) return;
        applyLyrics(app.project);
        app.preview.invalidate();
        const n = L.lines.findIndex((l) => l.start == null);
        cur.textContent = n < 0 ? 'وُقّتت كل الأسطر ✓ (انقر «انتهى»)' : L.lines[n].text;
        after.textContent = n >= 0 && L.lines[n + 1] ? 'بعده: ' + L.lines[n + 1].text : '';
        counter.textContent = `${n < 0 ? L.lines.length : n} من ${L.lines.length}`;
        navigator.vibrate?.(15);
      };
      const tapBtn = btn(syncing ? 'انقر عند بداية السطر' : 'ابدأ التشغيل', tap, { cls: 'pri', icon: 'tap' });
      Object.assign(tapBtn.style, { width: '100%', minHeight: '88px', fontSize: '20px' });
      body.append(h('p.hint', {}, 'شغّل الأغنية، وانقر الزر الكبير لحظة بدء كل سطر. (على اللابتوب: مسافة أو Enter)'), cur, after, tapBtn, counter,
        h('div.row', {},
          btn('تراجع سطر', () => { untapLine(L); applyLyrics(app.project); app.preview.invalidate(); refreshSheet(); }, { icon: 'undo' }),
          btn('انتهى', () => {
            app.preview.pause(); syncing = false;
            edit('توقيت الكلمات', (pp) => { finishLyrics(pp.lyrics, song.start + (song.out - song.in)); applyLyrics(pp); });
            step = 'edit'; refreshSheet();
          }, { icon: 'check' }),
          btn('ابدأ من جديد', async () => {
            if (!(await confirmBox('مسح توقيت كل الأسطر؟', 'امسح'))) return;
            edit('مسح التوقيت', (pp) => { pp.lyrics.lines.forEach((l) => { l.start = l.end = null; }); applyLyrics(pp); });
            syncing = false; refreshSheet();
          }, { cls: 'danger' })));
      keyHandler = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.target.matches('textarea,input')) { e.preventDefault(); e.stopPropagation(); tap(); } };
      window.addEventListener('keydown', keyHandler, true);
      return () => window.removeEventListener('keydown', keyHandler, true);
    }

    if (step === 'edit') {
      body.append(h('p.hint', {}, 'اضبط بداية كل سطر بدقة (±0.1 ث)، أو المس السطر للانتقال إليه.'));
      L.lines.forEach((l, i) => {
        const nudge = (d) => () => edit('توقيت سطر', (pp) => {
          const x = pp.lyrics.lines[i];
          if (x.start == null) return;
          x.start = Math.max(0, x.start + d);
          if (i > 0 && pp.lyrics.lines[i - 1].end != null) pp.lyrics.lines[i - 1].end = x.start;
          applyLyrics(pp);
        });
        body.append(h('div.list-item', {},
          h('div.meta', { onclick: () => l.start != null && app.preview.seek(l.start + 0.01) }, h('b', {}, l.text), h('small', {}, l.start == null ? 'غير موقّت' : `${fmtTime(l.start, true)} ← ${fmtTime(l.end ?? l.start, true)}`)),
          btn('', nudge(-0.1), { icon: 'minus' }), btn('', nudge(0.1), { icon: 'plus' }),
          btn('هنا', () => edit('توقيت سطر', (pp) => { pp.lyrics.lines[i].start = app.preview.time; if (i > 0) pp.lyrics.lines[i - 1].end = app.preview.time; finishLyrics(pp.lyrics, song.start + song.out - song.in); applyLyrics(pp); }))));
      });
      return;
    }

    // الشكل
    const s = L.style;
    const upd = (fn) => edit('شكل الكلمات', (pp) => { fn(pp.lyrics.style); applyLyrics(pp); });
    body.append(h('div.row', {}, h('label', {}, 'كاراوكي'), seg([['on', 'تلوين الكلمة الحالية'], ['off', 'بلا']], s.karaoke ? 'on' : 'off', (v) => upd((st) => { st.karaoke = v === 'on'; }))));
    const fonts = h('div.chips');
    for (const f of FONTS) fonts.append(h('button.chip' + (s.font === f.id ? '.on' : ''), { style: { fontFamily: `"${f.id}"`, fontSize: '18px' }, onclick: () => upd((st) => { st.font = f.id; }) }, 'غنّي', h('small', { style: { fontFamily: 'Cairo', fontSize: '11px' } }, f.label)));
    body.append(fonts);
    body.append(slider('الحجم', { min: 0.03, max: 0.16, step: 0.005, value: s.size, fmt: (v) => Math.round(v * 100), onchange: (v) => upd((st) => { st.size = v; }) }));
    body.append(colorRow('لون النص', s.color, (c) => upd((st) => { st.color = c; })));
    body.append(colorRow('لون الكاراوكي', s.kcolor, (c) => upd((st) => { st.kcolor = c; })));
    body.append(h('div.row', {}, h('label', {}, 'المكان'), seg([['0.15', 'أعلى'], ['0.5', 'وسط'], ['0.82', 'أسفل']], String(s.y), (v) => upd((st) => { st.y = +v; }))));
    body.append(h('div.row', {}, h('label', {}, 'الدخول'), seg([['fade', 'تلاشٍ'], ['up', 'صعود'], ['pop', 'قفزة'], ['words', 'كلمة كلمة'], ['none', 'بلا']], s.anim, (v) => upd((st) => { st.anim = v; }))));
    body.append(h('div.row', {}, btn(s.bg ? 'إزالة الخلفية' : 'خلفية خلف الكلمات', () => upd((st) => { st.bg = !st.bg; }), { cls: s.bg ? 'on' : '' }),
      btn('حذف الكلمات كلها', async () => { if (await confirmBox('حذف كلمات الأغنية من الفيديو؟', 'احذف')) { edit('حذف الكلمات', (pp) => { pp.lyrics = null; applyLyrics(pp); }); refreshSheet(); } }, { cls: 'danger', icon: 'delete' })));
  });
}

// ———— علامات الإيقاع ————
export function openBeatsPanel() {
  let tapping = false;
  openSheet('beats', 'علامات الإيقاع', (body) => {
    const p = app.project;
    const music = musicItems();
    body.append(h('p.hint', {}, 'شغّل الموسيقى وانقر مع الإيقاع. بعدها يلتصق التقسيم بالعلامات، ويمكن توزيع المقاطع عليها تلقائيًا.'));
    const count = h('p.hint', {}, `عدد العلامات: ${p.beats.length}`);
    const tapBtn = btn(tapping ? 'انقر مع الإيقاع' : 'ابدأ التشغيل والنقر', () => {
      if (!tapping) { tapping = true; app.preview.seek(music[0]?.start || 0); app.preview.play(); tapBtn.querySelector('span').textContent = 'انقر مع الإيقاع'; return; }
      app.project.beats = addBeat(app.project.beats, app.preview.time);
      count.textContent = `عدد العلامات: ${app.project.beats.length}`;
      navigator.vibrate?.(10);
      app.preview.invalidate();
    }, { cls: 'pri', icon: 'tap' });
    Object.assign(tapBtn.style, { width: '100%', minHeight: '88px', fontSize: '20px' });
    body.append(tapBtn, count, h('div.row', {},
      btn('توقف واحفظ', () => { app.preview.pause(); tapping = false; commit('علامات الإيقاع'); refreshSheet(); }, { icon: 'check' }),
      btn('علامة عند المؤشر', () => edit('علامة', (pp) => { pp.beats = addBeat(pp.beats, app.preview.time); })),
      btn('مسح الكل', () => edit('مسح العلامات', (pp) => { pp.beats = []; }), { cls: 'danger', icon: 'delete' })));
    body.append(h('div.row', {},
      btn('اكشف الإيقاع تلقائيًا', async () => {
        const m = music[0];
        if (!m) return toast('أضف موسيقى أولًا');
        const buf = await lib.loadAudio(m.mediaId);
        if (!buf) return toast('الصوت ما زال يُحمَّل، حاول بعد لحظة');
        const T = layout(app.project).duration;
        const beats = detectBeats(buf.getChannelData(0), buf.sampleRate, { from: m.in, to: m.out, offset: m.start }).filter((b) => b <= T + 0.01);
        edit('كشف الإيقاع', (pp) => { pp.beats = beats; });
        toast(`وُجدت ${beats.length} علامة`);
      }, { icon: 'wand' }),
      btn('وزّع المقاطع على العلامات', () => {
        if (p.beats.length < 2) return toast('أضف علامات أولًا');
        edit('توزيع على الإيقاع', (pp) => fitClipsToBeats(pp));
        toast('صار كل قطع على علامة إيقاع');
      }, { icon: 'beat' })));
    const keyHandler = (e) => { if (tapping && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); tapBtn.click(); } };
    window.addEventListener('keydown', keyHandler, true);
    return () => window.removeEventListener('keydown', keyHandler, true);
  });
}
