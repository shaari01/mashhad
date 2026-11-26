// المكتبة: إضافة وحذف الخطوط والملصقات وصور GIF والصور والمقاطع، وإظهار أو إخفاء التأثيرات والفلاتر والحركات
// حتى تبقى القوائم قصيرة بما تستعمله فعلًا.
import { app, shown, setShown, saveSettings } from '../../app.js';
import { FONTS } from '../../fonts.js';
import { addFontFile, removeFont } from '../../media/userfonts.js';
import { FILTERS, EFFECTS } from '../../engine/effects.js';
import { TRANSITIONS } from '../../engine/transitions.js';
import { ANIMS, ANIMS_PRO } from '../../engine/text.js';
import { SFX } from '../../engine/sfx.js';
import * as lib from '../../media/library.js';
import * as db from '../../storage/db.js';
import { h, btn, seg, modal, toast, confirmBox } from '../dom.js';
import { importOverlayMedia } from './stickers.js';
import { fmtTime } from '../../core/timeline.js';

let tab = 'fonts';

async function usedIds() {
  const s = new Set(lib.mediaIdsOf(app.project));
  for (const p of await db.all('projects')) for (const id of lib.mediaIdsOf(p)) s.add(id);
  return s;
}

const eye = (kind, id) => {
  const on = shown(kind, id);
  return btn(on ? 'ظاهر' : 'مخفي', async () => { await setShown(kind, id, !on); render(); }, { icon: on ? 'eye' : 'close', cls: on ? '' : 'on' });
};

let box = null;
export function openLibrary(t = tab) {
  tab = t;
  box = h('div');
  modal('المكتبة', box);
  render();
}

async function render() {
  if (!box) return;
  box.innerHTML = '';
  box.append(seg([['fonts', 'الخطوط'], ['stickers', 'الملصقات وGIF'], ['media', 'الصور والمقاطع'], ['fx', 'التأثيرات']], tab, (v) => { tab = v; render(); }));
  if (tab === 'fonts') {
    box.append(h('p.hint', {}, 'أضف خطًا من جهازك (TTF أو OTF أو WOFF) فيظهر في قائمة الخطوط ويعمل بلا إنترنت. وأخفِ ما لا تستعمله.'));
    box.append(h('div.row', {}, btn('أضف خطًا', () => {
      const inp = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2,font/*' });
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const r = await addFontFile(f); toast('أُضيف الخط «' + r.label + '»'); } catch (e) { toast(e.message); } render(); };
      inp.click();
    }, { icon: 'plus', cls: 'pri' })));
    for (const f of FONTS) {
      box.append(h('div.list-item', {}, h('div.meta', {}, h('b', { style: { fontFamily: `"${f.id}"`, fontSize: '20px' } }, 'في الحركة بركة'), h('small', {}, f.label + (f.user ? ' — من ملفاتك' : ''))),
        eye('fonts', f.id),
        f.user ? btn('', async () => { if (await confirmBox(`حذف الخط «${f.label}»؟`, 'احذف')) { await removeFont(f.id); openLibrary('fonts'); } }, { icon: 'delete', cls: 'danger' }) : null));
    }
  } else if (tab === 'stickers' || tab === 'media') {
    const recs = await lib.allRecords();
    const used = await usedIds();
    const list = tab === 'stickers' ? recs.filter((r) => r.role === 'sticker') : recs.filter((r) => r.role !== 'sticker' && r.role !== 'sfx');
    if (tab === 'stickers') box.append(h('div.row', {}, btn('أضف ملصقًا أو GIF', async () => { const r = await importOverlayMedia('image'); if (r) { toast('أُضيف إلى ملصقاتك'); openLibrary('stickers'); } }, { icon: 'plus', cls: 'pri' })));
    box.append(h('p.hint', {}, tab === 'stickers' ? 'ملصقاتك وصورك المتحركة. احذف ما لا تريده.' : 'الصور والمقاطع والأصوات المحفوظة داخل البرنامج. لا يُحذف ما يستخدمه مشروع، احذفه من المشروع أولًا.'));
    if (!list.length) box.append(h('p.hint', {}, 'لا شيء بعد.'));
    for (const r of list) {
      const inUse = used.has(r.id);
      const kind = r.kind === 'image' ? (r.animated ? 'GIF متحرك' : 'صورة') : r.kind === 'video' ? 'فيديو' : 'صوت';
      box.append(h('div.list-item', {}, h('div.thumb', { style: { backgroundImage: r.thumb ? `url(${r.thumb})` : '' } }),
        h('div.meta', {}, h('b', {}, r.name || 'ملف'), h('small', {}, kind + (r.duration ? ' — ' + fmtTime(r.duration) : '') + (inUse ? ' — مستخدم' : ''))),
        btn('', async () => {
          if (inUse) return toast('مستخدم في مشروع، احذفه من المشروع أولًا');
          if (await confirmBox(`حذف «${r.name || 'الملف'}» من البرنامج؟`, 'احذف')) { await lib.removeMedia(r.id); toast('حُذف'); render(); }
        }, { icon: 'delete', cls: 'danger', disabled: inUse })));
    }
  } else {
    box.append(h('p.hint', {}, 'أخفِ ما لا تستعمله لتقصر القوائم. يمكنك إظهاره متى شئت. ولإضافة فلتر خاص: «فلتر» ← «تعديل» ← «احفظ كفلتر».'));
    const group = (title, kind, entries) => {
      box.append(h('h3', {}, title));
      const g = h('div.chips', { style: { flexWrap: 'wrap' } });
      for (const [id, label] of entries) g.append(h('button.chip' + (shown(kind, id) ? '.on' : ''), { 'aria-pressed': shown(kind, id) ? 'true' : 'false', onclick: async () => { await setShown(kind, id, !shown(kind, id)); render(); } }, label));
      box.append(g);
    };
    const uf = app.settings.userFilters || [];
    if (uf.length) {
      box.append(h('h3', {}, 'فلاترك'));
      for (const f of uf) box.append(h('div.list-item', {}, h('div.meta', {}, h('b', {}, f.label)), btn('', async () => { app.settings.userFilters = uf.filter((x) => x.id !== f.id); await saveSettings(); render(); }, { icon: 'delete', cls: 'danger' })));
    }
    group('الفلاتر', 'filters', Object.entries(FILTERS).filter(([k]) => k !== 'none').map(([k, f]) => [k, f.label]));
    group('التأثيرات المرئية', 'effects', Object.entries(EFFECTS));
    group('الانتقالات', 'transitions', Object.entries(TRANSITIONS).filter(([k]) => k !== 'none').map(([k, t]) => [k, t.label || t]));
    group('حركات النص', 'anims', Object.entries({ ...ANIMS, ...ANIMS_PRO }).filter(([k]) => k !== 'none'));
    group('المؤثرات الصوتية', 'sfx', SFX.map((s) => [s.id, s.label]));
  }
  const { hydrateIcons } = await import('../icons.js');
  hydrateIcons(box);
}
