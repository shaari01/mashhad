// تسجيل أدوات المراحل 2 وما بعدها في الشريط السفلي
import { app, on } from './app.js';
import { registerTool, setTab, currentTab } from './ui/tools.js';
import { setStoryboardHooks } from './ui/storyboard.js';
import { installStage } from './ui/stage.js';
import { openTextPanel } from './ui/panels/text.js';
import { openTransitionPanel, betweenButton } from './ui/panels/transition.js';
import { openSpeedPanel, openAspectPanel } from './ui/panels/speed.js';
import { openLyricsPanel, openBeatsPanel } from './ui/panels/lyrics.js';
import { openStickerPanel, openPipPanel } from './ui/panels/stickers.js';
import { openSfxPanel, openMicPanel, doFreeze } from './ui/panels/sound.js';
import { registerDraggable } from './ui/stage.js';
import { overlayBoxes } from './engine/overlays.js';
import { openFilterPanel, openEffectsPanel } from './ui/panels/visual.js';
import { doReverse, doMute, openImagePanel, openAudioSettings, openNarrator, tabFor } from './ui/panels/quick.js';
import { openLibrary } from './ui/panels/library.js';
import { renderTimeline, setTimelineHooks, updateTimelineHead } from './ui/timeline.js';
import { openCaptionsPanel } from './ui/panels/extras.js';
import { openAudioPanel } from './ui/panels/music.js';
import { hydrateIcons } from './ui/icons.js';
import { $ } from './ui/dom.js';

export function installFeatures({ addMedia } = {}) {
  const T = (id, icon, label, run, order, group) => registerTool({ id, icon, label, run, order, group });
  // الفيديو
  T('speed', 'speed', 'تسريع', openSpeedPanel, 12, 'video');
  T('transition', 'transition', 'انتقال', () => openTransitionPanel(), 13, 'video');
  T('freeze', 'freeze', 'تجميد', doFreeze, 14, 'video');
  T('aspect', 'aspect', 'تحجيم', openAspectPanel, 15, 'video');
  T('reverse', 'reverse', 'عكس', doReverse, 17, 'video');
  T('mute', 'mute', 'كتم', doMute, 18, 'video');
  T('filter', 'filter', 'فلتر', openFilterPanel, 60, 'video');
  T('effects', 'effects', 'تأثير', openEffectsPanel, 61, 'video');
  // الصور
  T('imgadd', 'imgadd', 'إضافة صور', () => addMedia?.(null, 'image'), 1, 'image');
  T('pip', 'pip', 'فوق الفيديو', openPipPanel, 3, 'image');
  T('sticker', 'sticker', 'ملصق وGIF', openStickerPanel, 4, 'image');
  T('imgset', 'imgset', 'ضبط الصورة', openImagePanel, 5, 'image');
  T('library', 'library', 'المكتبة', () => openLibrary('stickers'), 9, 'image');
  // الصوت
  T('narrator', 'narrator', 'راوٍ', openNarrator, 41, 'audio');
  T('mic', 'mic', 'تسجيل', openMicPanel, 42, 'audio');
  T('sfx', 'sfx', 'مؤثرات', openSfxPanel, 43, 'audio');
  T('audioset', 'audioset', 'ضبط الصوت', openAudioSettings, 44, 'audio');
  T('beats', 'beat', 'إيقاع', openBeatsPanel, 45, 'audio');
  // النص
  T('text', 'text', 'نص', openTextPanel, 50, 'text');
  T('lyrics', 'lyrics', 'كلمات أغنية', openLyricsPanel, 52, 'text');
  T('captions', 'captions', 'ترجمة', openCaptionsPanel, 54, 'text');
  T('fonts', 'library', 'الخطوط', () => openLibrary('fonts'), 56, 'text');
  // عند تحديد عنصر تظهر مجموعته
  on((w) => { if (w === 'select') { const t = tabFor(app.selected); if (t && t !== currentTab()) setTab(t); } });
  installTimelineMode();
  registerDraggable({ type: 'overlay', boxes: () => overlayBoxes, get: (id) => app.project.overlays.find((o) => o.id === id), sizeKey: 'size' });
  setStoryboardHooks({ between: betweenButton });
  installStage({ onOpen: (type, obj) => { if (type === 'text') openTextPanel(); if (type === 'overlay') (['video', 'image', 'anim'].includes(obj.kind) && obj.border ? openPipPanel : openStickerPanel)(); } });
  on((w) => { if (w === 'select' && app.preview) app.preview.dirty = true; });
  document.fonts?.addEventListener?.('loadingdone', () => { if (app.preview) app.preview.dirty = true; });
}

// وضع الخط الزمني المتقدم: زر في الأعلى يبدّل بين البطاقات والمسارات
function installTimelineMode() {
  const btn = $('#btn-mode');
  const isTl = () => app.mode === 'timeline';
  const apply = () => {
    $('#storyboard').classList.toggle('hidden', isTl());
    $('#tracks').classList.toggle('hidden', isTl());
    $('#timeline').classList.toggle('hidden', !isTl());
    btn.dataset.icon = isTl() ? 'cards' : 'timeline';
    btn.setAttribute('aria-pressed', isTl() ? 'true' : 'false');
    hydrateIcons(btn.parentElement);
    if (isTl()) renderTimeline();
  };
  btn.onclick = () => { app.mode = isTl() ? 'cards' : 'timeline'; try { localStorage.setItem('maqta.mode', app.mode); } catch {} apply(); };
  try { app.mode = localStorage.getItem('maqta.mode') || 'cards'; } catch { app.mode = 'cards'; }
  setTimelineHooks({
    open: (type, obj) => {
      if (type === 'text') openTextPanel();
      else if (type === 'overlay') (['video', 'image', 'anim'].includes(obj.kind) && obj.border ? openPipPanel : openStickerPanel)();
      else if (type === 'audio') openAudioPanel(obj, obj.kind || 'music');
    },
  });
  on((w) => { if (isTl() && w !== 'live') renderTimeline(); });
  document.addEventListener('playhead', (e) => { if (isTl()) updateTimelineHead(e.detail); });
  apply();
}
