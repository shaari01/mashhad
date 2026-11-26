// حالة التطبيق المركزية: المشروع الحالي، والتحديد، والتراجع، والحفظ التلقائي.
import { newProject, normalizeProject, clone } from './core/project.js';
import { History } from './core/history.js';
import { layout } from './core/timeline.js';
import * as db from './storage/db.js';
import * as lib from './media/library.js';

export const app = {
  project: newProject(),
  history: new History(),
  selected: null, // {type:'clip'|'audio'|'text'|'overlay', id}
  preview: null,
  mode: 'cards',
  settings: { copyAlways: false, imageDuration: 3, transcribe: { url: '', key: '', model: 'whisper-1', lang: 'ar' } },
  listeners: new Set(),
  saving: null,
};

export function on(fn) { app.listeners.add(fn); return () => app.listeners.delete(fn); }
export function emit(what = 'all') { for (const f of app.listeners) f(what); }

let saveTimer = null;
export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  const p = app.project;
  p.updatedAt = Date.now();
  const first = p.clips.find((c) => c.type !== 'freeze') || p.clips[0];
  if (first) {
    const rec = lib.cachedRecord(first.mediaId);
    if (rec?.thumb) p.thumb = rec.thumb;
  }
  await db.put('projects', clone(p));
  await db.put('kv', p.id, 'lastProject');
}

// تنفيذ تعديل مع تسجيله في التراجع والحفظ التلقائي
export function edit(label, fn) {
  const r = fn(app.project);
  commit(label);
  return r;
}

export function commit(label = '') {
  if (app.history.commit(app.project, label)) {
    app.preview?.invalidate();
    scheduleSave();
    emit('project');
  }
}

// تعديلات متتابعة (أثناء السحب): نحدّث المعاينة فورًا، ونسجّل في التراجع عند الإفلات
export function live() {
  app.preview?.invalidate();
  emit('live');
}

export function undo() {
  const r = app.history.undo();
  if (r) { app.project = r.state; afterLoad(); scheduleSave(); return r.label; }
  return null;
}
export function redo() {
  const r = app.history.redo();
  if (r) { app.project = r.state; afterLoad(); scheduleSave(); return r.label; }
  return null;
}

function afterLoad() {
  if (app.selected && !findSelected()) app.selected = null;
  app.preview?.invalidate();
  emit('project');
}

export function select(type, id) {
  app.selected = type ? { type, id } : null;
  emit('select');
}

export function findSelected() {
  const s = app.selected;
  if (!s) return null;
  const p = app.project;
  const list = { clip: p.clips, audio: p.audio, text: p.texts, overlay: p.overlays }[s.type];
  return list?.find((x) => x.id === s.id) || null;
}

export function selectedClip() {
  if (app.selected?.type === 'clip') return app.project.clips.find((c) => c.id === app.selected.id) || null;
  return null;
}

// المقطع المحدد، أو الذي تحت المؤشر
export function targetClip() {
  const c = selectedClip();
  if (c) return c;
  const lay = layout(app.project);
  const t = app.preview?.time ?? 0;
  const it = lay.items.find((x) => t >= x.start && t < x.end) || lay.items[lay.items.length - 1];
  if (it) { select('clip', it.clip.id); return it.clip; }
  return null;
}

export async function loadProject(p) {
  app.project = normalizeProject(p);
  app.history.reset(app.project);
  app.selected = null;
  await Promise.all(lib.mediaIdsOf(app.project).map((id) => lib.getRecord(id).then(() => lib.ensure(id)).catch(() => null)));
  app.preview?.seek(0);
  afterLoad();
  await db.put('kv', app.project.id, 'lastProject');
}

export async function newProj(name) {
  await saveNow().catch(() => {});
  const p = newProject(name || 'مشروع ' + new Date().toLocaleDateString('ar'));
  p.imageDuration = app.settings.imageDuration;
  await loadProject(p);
  await saveNow();
}

export async function loadSettings() {
  const s = await db.get('kv', 'settings');
  if (s) app.settings = { ...app.settings, ...s, transcribe: { ...app.settings.transcribe, ...(s.transcribe || {}) } };
}
export async function saveSettings() { await db.put('kv', clone(app.settings), 'settings'); }

export async function restoreLast() {
  const id = await db.get('kv', 'lastProject');
  const p = id && (await db.get('projects', id));
  if (p) await loadProject(p);
  else await newProj('مشروعي الأول');
}
