// نقطة البداية: تجهيز الواجهة والمعاينة والأدوات والحفظ التلقائي.
import './fonts.js';
import './styles.css';
import { app, on, emit, undo, redo, select, edit, restoreLast, loadSettings, saveNow, targetClip, markPoint, rollbackTo } from './app.js';
import { layout, fmtTime } from './core/timeline.js';
import { addClips } from './core/edits.js';
import { Preview } from './engine/preview.js';
import { outputSize } from './engine/render.js';
import * as lib from './media/library.js';
import { $, h, toast, refreshSheet, closeSheet, cancelSheet, sheetId, modal, setSheetHooks } from './ui/dom.js';
import { hydrateIcons } from './ui/icons.js';
import { renderStoryboard, setStoryboardHooks, scrollToSelected } from './ui/storyboard.js';
import { renderTracks, setTrackHooks, updateHeads } from './ui/tracks.js';
import { registerTool, renderToolbar, toolTab } from './ui/tools.js';
import { openTrim, doSplit, doDelete, doDuplicate, doReplace, openTransform, openVolume } from './ui/panels/clip.js';
import { openAudioPanel } from './ui/panels/music.js';
import { openExport } from './ui/panels/export.js';
import { openMenu } from './ui/panels/projects.js';
import { installFeatures } from './features.js';
import { loadUserFonts } from './media/userfonts.js';

// ———— إضافة الوسائط ————
export async function addMedia(atIndex = null, kind = 'visual') {
  const files = await lib.pickFiles(kind, { preferCopy: app.settings.copyAlways });
  if (!files.length) return;
  const recs = [];
  let i = 0;
  for (const f of files) {
    i++;
    toast(`جارٍ تجهيز ${i} من ${files.length}…`, 60000);
    try { recs.push(await lib.importFile(f, { copyAlways: app.settings.copyAlways })); }
    catch (e) { toast(e.message, 4000); await new Promise((r) => setTimeout(r, 1200)); }
  }
  const unplayable = recs.filter((r) => r.kind === 'video' && !r.playable);
  if (!recs.length) return toast('لم يُضف شيء');
  const sel = app.selected?.type === 'clip' ? app.project.clips.findIndex((c) => c.id === app.selected.id) : -1;
  const at = atIndex ?? (sel >= 0 ? sel + 1 : app.project.clips.length);
  const added = edit('إضافة', (p) => addClips(p, recs, at));
  select('clip', added[0].id);
  const it = layout(app.project).items.find((x) => x.clip.id === added[0].id);
  app.preview.seek(it ? it.start : 0);
  toast(`أُضيف ${added.length} ${added.length === 1 ? 'عنصر' : 'عناصر'}`);
  if (unplayable.length) toast('تنبيه: بعض المقاطع بصيغة قد لا يعرضها هذا المتصفح', 5000);
  setTimeout(scrollToSelected, 50);
}

// ———— المعاينة وحجمها ————
const canvas = $('#preview');
app.preview = new Preview(canvas, () => app.project);

function fitCanvas() {
  const stage = $('#stage');
  const r = stage.getBoundingClientRect();
  const { w: aw, h: ah } = outputSize(app.project.aspect, 1000);
  const s = Math.min((r.width - 12) / aw, (r.height - 12) / ah);
  const cssW = Math.max(40, Math.floor(aw * s)), cssH = Math.max(40, Math.floor(ah * s));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // دقة المعاينة محدودة بـ 720 للحفاظ على سلاسة الجوال
  const short = Math.min(720, Math.round(Math.min(cssW, cssH) * dpr));
  const o = outputSize(app.project.aspect, Math.max(160, short));
  app.preview.resize(o.w, o.h);
  stage.style.setProperty('--cw', cssW + 'px');
}
new ResizeObserver(fitCanvas).observe($('#stage'));

// ———— الشريط الزمني للتشغيل ————
const scrub = $('#scrub');
let scrubbing = false;
scrub.addEventListener('input', () => { scrubbing = true; app.preview.seek((scrub.value / 1000) * app.preview.duration); });
scrub.addEventListener('change', () => { scrubbing = false; });
app.preview.onTime((t, playing) => {
  const D = app.preview.duration;
  if (!scrubbing) scrub.value = D > 0 ? Math.round((t / D) * 1000) : 0;
  $('#time').textContent = fmtTime(t, true);
  const pb = $('#btn-play');
  const want = playing ? 'pause' : 'play';
  if (pb.dataset.icon !== want) { pb.dataset.icon = want; pb.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل'); hydrateIcons(pb.parentElement); }
  updateHeads(t);
  document.dispatchEvent(new CustomEvent('playhead', { detail: t }));
});

// ———— الأزرار العلوية ————
$('#btn-play').onclick = () => app.preview.toggle();
$('#btn-undo').onclick = () => { const l = undo(); if (l != null) toast('تراجع: ' + (l || '')); };
$('#btn-redo').onclick = () => { const l = redo(); if (l != null) toast('إعادة: ' + (l || '')); };
$('#btn-export').onclick = () => openExport();
$('#btn-menu').onclick = () => openMenu();
$('#btn-empty-add').onclick = () => addMedia();
$('#btn-fullscreen').onclick = () => {
  document.body.classList.toggle('fs');
  if (document.body.classList.contains('fs')) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.();
};
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('fs'); });
$('#sheet-close').onclick = () => closeSheet();
$('#sheet-cancel').onclick = () => cancelSheet();
setSheetHooks({ mark: markPoint, rollback: rollbackTo });
$('#modal-close').onclick = () => { $('#modal').classList.add('hidden'); };
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal-close').click(); });
const nameInput = $('#project-name');
nameInput.addEventListener('change', () => edit('الاسم', (p) => { p.name = nameInput.value.trim() || 'بلا اسم'; }));

// ———— الأدوات ————
const T = (id, icon, label, run, order, group = 'video', hidden) => registerTool({ id, icon, label, run, order, group, hidden });
// مجموعة الفيديو
T('add', 'add', 'إضافة', () => addMedia(), 0, 'video');
T('trim', 'trim', 'قص', openTrim, 10);
T('split', 'split', 'تقسيم', doSplit, 11);
T('transform', 'rotate', 'تدوير وقلب', openTransform, 16);
T('volume', 'volume', 'صوت المقطع', openVolume, 19);
T('copy', 'copy', 'نسخ', doDuplicate, 80);
T('replace', 'replace', 'استبدال', doReplace, 81);
T('delete', 'delete', 'حذف', doDelete, 82);
// مجموعة الصوت
T('music', 'music', 'موسيقى', () => openAudioPanel(null, 'music'), 40, 'audio');

setStoryboardHooks({ onAdd: () => addMedia(), onOpen: () => openTrim() });
setTrackHooks({ openAudio: (a, kind) => openAudioPanel(a, kind) });

// ———— إعادة الرسم عند التغيير ————
function renderAll() {
  renderStoryboard();
  renderTracks();
  const empty = !app.project.clips.length;
  $('#empty-hint').classList.toggle('hidden', !empty);
  $('#total').textContent = fmtTime(layout(app.project).duration, true);
  $('#btn-undo').disabled = !app.history.canUndo;
  $('#btn-redo').disabled = !app.history.canRedo;
  if (document.activeElement !== nameInput) nameInput.value = app.project.name;
  fitCanvas();
}
on((what) => {
  if (what === 'live') { $('#total').textContent = fmtTime(layout(app.project).duration, true); renderTracks(); return; }
  renderAll();
  if (what === 'project' && sheetId()) refreshSheet();
  if (what === 'select') { renderToolbar(sheetId()); if (sheetId() && sheetId() !== 'lyrics' && sheetId() !== 'beats' && sheetId() !== 'mic') refreshSheet(); }
});
document.addEventListener('sheet', (e) => renderToolbar(e.detail));
lib.onMediaChange(() => renderStoryboard());

// ———— لوحة المفاتيح (للابتوب) ————
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select') && e.target.type !== 'range') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? $('#btn-redo').click() : $('#btn-undo').click(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); $('#btn-redo').click(); }
  else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveNow().then(() => toast('حُفظ')); }
  else if (k === ' ') { e.preventDefault(); app.preview.toggle(); }
  else if (k === 's' || k === 'س') doSplit();
  else if (k === 'delete') doDelete();
  else if (k === 'arrowleft') app.preview.seek(app.preview.time + (e.shiftKey ? 1 : 1 / 30));
  else if (k === 'arrowright') app.preview.seek(app.preview.time - (e.shiftKey ? 1 : 1 / 30));
  else if (k === 'escape') cancelSheet();
  else if (k === 'enter' && sheetId() && !e.target.matches('textarea, button')) closeSheet();
});

// ———— التثبيت والحفظ ————
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow().catch(() => {}); });
window.addEventListener('pagehide', () => saveNow().catch(() => {}));

// ———— البدء ————
(async () => {
  hydrateIcons();
  installFeatures({ addMedia });
  renderToolbar();
  await loadSettings();
  loadUserFonts().catch(() => {});
  await lib.requestPersistence();
  await restoreLast();
  renderAll();
  window.__app = app; // للاختبارات الآلية
  window.__lib = lib;
  window.__toolTab = toolTab;
  document.body.dataset.ready = '1';
})();
