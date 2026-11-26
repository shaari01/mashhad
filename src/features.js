// تسجيل أدوات المراحل 2 وما بعدها في الشريط السفلي
import { app, on } from './app.js';
import { registerTool } from './ui/tools.js';
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
import { openFilterPanel, openEffectsPanel, openTemplates } from './ui/panels/visual.js';
import { renderTimeline, setTimelineHooks, updateTimelineHead } from './ui/timeline.js';
import { openAudioPanel } from './ui/panels/music.js';
import { hydrateIcons } from './ui/icons.js';
import { $ } from './ui/dom.js';

export function installFeatures() {
  const T = (id, icon, label, run, order, group) => registerTool({ id, icon, label, run, order, group });
  // المرحلة 2
  T('speed', 'speed', 'سرعة', openSpeedPanel, 12, 'clip');
  T('transition', 'transition', 'انتقال', () => openTransitionPanel(), 13, 'clip');
  T('text', 'text', 'نص', openTextPanel, 50, 'over');
  T('aspect', 'aspect', 'مقاس', openAspectPanel, 90, 'edit');
  // المرحلة 3
  T('lyrics', 'lyrics', 'كلمات', openLyricsPanel, 52, 'over');
  T('beats', 'beat', 'إيقاع', openBeatsPanel, 43, 'audio');
  // المرحلة 4
  T('sticker', 'sticker', 'ملصق', openStickerPanel, 51, 'over');
  T('pip', 'pip', 'فوق فيديو', openPipPanel, 53, 'over');
  T('sfx', 'sfx', 'مؤثرات', openSfxPanel, 42, 'audio');
  T('mic', 'mic', 'تسجيل', openMicPanel, 44, 'audio');
  T('freeze', 'freeze', 'تجميد', doFreeze, 14, 'clip');
  // المرحلة 5
  T('filter', 'filter', 'فلتر', openFilterPanel, 60, 'edit');
  T('effects', 'effects', 'تأثير', openEffectsPanel, 61, 'edit');
  T('template', 'template', 'قالب', openTemplates, 95, 'main');
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
  const eb = document.getElementById('btn-empty-template');
  if (eb) eb.onclick = () => openTemplates();
  apply();
}
