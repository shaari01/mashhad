// القائمة الرئيسية: المشاريع، والإعدادات، واختبار الأداء، والتثبيت.
import { app, loadProject, newProj, saveNow, saveSettings, emit } from '../../app.js';
import { clone, uid } from '../../core/project.js';
import { projectDuration, fmtTime } from '../../core/timeline.js';
import * as db from '../../storage/db.js';
import * as lib from '../../media/library.js';
import { h, btn, seg, modal, closeModal, toast, confirmBox, slider } from '../dom.js';
import { openBenchmark } from './export.js';

export async function openMenu() {
  await saveNow().catch(() => {});
  const body = h('div');
  const list = h('div');
  const projects = (await db.all('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
  body.append(h('div.row', {},
    btn('مشروع جديد', async () => { await newProj(); closeModal(); toast('مشروع جديد'); }, { icon: 'plus', cls: 'pri' }),
    btn('اختبار أداء الجهاز', () => openBenchmark(), { icon: 'speed' }),
    btn('المكتبة', () => import('./library.js').then((m) => m.openLibrary()), { icon: 'library' }),
    btn('الإعدادات', () => openSettings(), { icon: 'settings' })));
  const needPerm = [];
  for (const id of lib.mediaIdsOf(app.project)) if (!lib.rt(id)?.file) needPerm.push(id);
  if (needPerm.length) {
    body.append(h('div.verdict.mid', {}, `${needPerm.length} من ملفات هذا المشروع تحتاج إذن الوصول من جديد.`),
      h('div.row', {}, btn('اسمح بالوصول للملفات', async () => {
        let ok = 0;
        for (const id of needPerm) { const r = await lib.ensure(id, { request: true }); if (r.ok) ok++; }
        app.preview.invalidate(); emit('project'); toast(`أُتيح ${ok} من ${needPerm.length}`); closeModal();
      }, { cls: 'pri' })));
  }
  body.append(h('h3', {}, 'مشاريعي'), list);
  for (const p of projects) {
    const cur = p.id === app.project.id;
    list.append(h('div.list-item', {},
      h('div.thumb', { style: { backgroundImage: p.thumb ? `url(${p.thumb})` : '' } }),
      h('div.meta', {}, h('b', {}, (cur ? '● ' : '') + p.name), h('small', {}, `${p.clips.length} مقطع — ${fmtTime(projectDuration(p))} — ${new Date(p.updatedAt).toLocaleDateString('ar')}`)),
      btn('افتح', async () => { await saveNow(); await loadProject(p); closeModal(); }, { cls: cur ? '' : 'pri' }),
      btn('', async () => { const c = clone(p); c.id = uid('prj'); c.name = p.name + ' (نسخة)'; c.updatedAt = Date.now(); await db.put('projects', c); openMenu(); }, { icon: 'copy', title: 'نسخ المشروع' }),
      btn('', async () => {
        if (!(await confirmBox(`حذف المشروع «${p.name}»؟ لا يمكن التراجع عن هذا.`, 'احذف'))) return openMenu();
        await db.del('projects', p.id);
        if (cur) await newProj();
        openMenu();
      }, { icon: 'delete', cls: 'danger', title: 'حذف' })));
  }
  body.append(h('h3', {}, 'التثبيت على جهازك'), installHelp());
  modal('المشاريع', body);
}

function installHelp() {
  const box = h('div');
  if (window.matchMedia('(display-mode: standalone)').matches) box.append(h('p.hint', {}, 'البرنامج مثبّت ويعمل بلا إنترنت.'));
  if (window.__installPrompt) box.append(btn('ثبّت البرنامج الآن', async () => { window.__installPrompt.prompt(); window.__installPrompt = null; }, { cls: 'pri', icon: 'download' }));
  box.append(h('p.hint', {}, 'جوال أو تابلت سامسونج (Chrome): القائمة ⋮ ← «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».'),
    h('p.hint', {}, 'اللابتوب (Chrome أو Edge): أيقونة التثبيت في شريط العنوان، أو القائمة ← «تثبيت مَقطع».'));
  return box;
}

export async function openSettings() {
  const s = app.settings;
  const body = h('div');
  const est = await navigator.storage?.estimate?.().catch(() => null);
  body.append(
    h('div.row', {}, h('label', {}, 'حفظ الملفات'), seg([['ref', 'إشارة للأصل (بلا نسخ)'], ['copy', 'نسخة داخل البرنامج']], s.copyAlways ? 'copy' : 'ref', (v) => { s.copyAlways = v === 'copy'; saveSettings(); })),
    h('p.hint', {}, lib.canUseHandles()
      ? 'على هذا الجهاز يمكن الإشارة للملف الأصلي دون نسخه. إن نقلت الملف أو حذفته فسيطلب البرنامج استبداله.'
      : 'هذا المتصفح (أندرويد) لا يسمح بالإشارة الدائمة للملفات، فتُنسخ المقاطع داخل مساحة البرنامج تلقائيًا حتى لا يضيع المشروع.'),
    slider('مدة الصورة', { min: 1, max: 10, step: 0.5, value: s.imageDuration, fmt: (v) => v + ' ث', onchange: (v) => { s.imageDuration = v; app.project.imageDuration = v; saveSettings(); } }),
  );
  if (est) body.append(h('p.hint', {}, `المساحة المستخدمة: ${(est.usage / 1048576).toFixed(0)} MB من ${(est.quota / 1048576 / 1024).toFixed(1)} GB متاحة للبرنامج.`));
  body.append(h('div.row', {}, btn('تنظيف الملفات غير المستخدمة', async () => {
    const projects = await db.all('projects');
    const used = new Set(projects.flatMap((p) => lib.mediaIdsOf(p)));
    const media = await db.all('media');
    let n = 0;
    for (const m of media) if (!used.has(m.id) && m.storage !== 'builtin') { await lib.removeMedia(m.id); n++; }
    toast(`حُذف ${n} ملف غير مستخدم`);
  }, { icon: 'delete' })));
  if (typeof window.__extraSettings === 'function') body.append(window.__extraSettings());
  modal('الإعدادات', body);
}
