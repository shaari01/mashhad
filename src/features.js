// تسجيل أدوات المراحل 2 وما بعدها في الشريط السفلي
import { app, on } from './app.js';
import { registerTool } from './ui/tools.js';
import { setStoryboardHooks } from './ui/storyboard.js';
import { installStage } from './ui/stage.js';
import { openTextPanel } from './ui/panels/text.js';
import { openTransitionPanel, betweenButton } from './ui/panels/transition.js';
import { openSpeedPanel, openAspectPanel } from './ui/panels/speed.js';
import { openLyricsPanel, openBeatsPanel } from './ui/panels/lyrics.js';

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
  setStoryboardHooks({ between: betweenButton });
  installStage({ onOpen: (type) => { if (type === 'text') openTextPanel(); } });
  on((w) => { if (w === 'select' && app.preview) app.preview.dirty = true; });
  document.fonts?.addEventListener?.('loadingdone', () => { if (app.preview) app.preview.dirty = true; });
}
