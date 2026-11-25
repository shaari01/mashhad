// مكتبة الوسائط: استيراد الملفات وحفظ الإشارة إليها دون نسخ متى أمكن.
// - على الحاسوب (Chrome/Edge): نحفظ «مقبض الملف» فقط، فلا تُنسخ المقاطع.
// - على أندرويد: لا يتيح المتصفح مقابض دائمة، فننسخ الملف إلى مساحة البرنامج الخاصة (OPFS)
//   حتى يبقى المشروع صالحًا بعد إغلاق البرنامج. هذا هو «النسخ عند الحاجة».
import * as db from '../storage/db.js';
import { uid } from '../core/project.js';
import { decodeAudio, computePeaks } from '../engine/audio.js';

const runtime = new Map(); // mediaId -> {file, url, bitmap, audio, audioPromise}
const listeners = new Set();
export const onMediaChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (id) => listeners.forEach((f) => f(id));

export const canUseHandles = () => typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const hasOPFS = () => typeof navigator !== 'undefined' && navigator.storage && 'getDirectory' in navigator.storage;

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|3gp|avi)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|weba)$/i;

export function kindOf(file) {
  const t = file.type || '';
  if (t.startsWith('video/') || VIDEO_EXT.test(file.name)) return 'video';
  if (t.startsWith('image/') || IMAGE_EXT.test(file.name)) return 'image';
  if (t.startsWith('audio/') || AUDIO_EXT.test(file.name)) return 'audio';
  return null;
}

const ACCEPT = {
  visual: { 'video/*': ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.mkv'], 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
  audio: { 'audio/*': ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac'] },
  image: { 'image/*': ['.png', '.gif', '.webp', '.jpg', '.jpeg'] },
};

// اختيار ملفات: يعيد [{file, handle?}]
export async function pickFiles(kind = 'visual', { multiple = true, preferCopy = false } = {}) {
  if (canUseHandles() && !preferCopy) {
    try {
      const handles = await window.showOpenFilePicker({ multiple, types: [{ description: 'وسائط', accept: ACCEPT[kind] }], excludeAcceptAllOption: false, id: 'maqta-' + kind });
      return Promise.all(handles.map(async (h) => ({ file: await h.getFile(), handle: h })));
    } catch (e) {
      if (e.name === 'AbortError') return [];
    }
  }
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = multiple;
    inp.accept = kind === 'audio' ? 'audio/*' : kind === 'image' ? 'image/*' : 'video/*,image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => { resolve([...inp.files].map((file) => ({ file }))); inp.remove(); };
    inp.oncancel = () => { resolve([]); inp.remove(); };
    inp.click();
  });
}

async function opfsDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('media', { create: true });
}

async function saveToOPFS(id, file) {
  const dir = await opfsDir();
  const fh = await dir.getFileHandle(id, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  return id;
}

async function readFromOPFS(name) {
  const dir = await opfsDir();
  const fh = await dir.getFileHandle(name);
  return fh.getFile();
}

function videoMeta(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
      v.onseeked = () => {
        try {
          const c = document.createElement('canvas');
          const s = 200 / Math.max(v.videoWidth, v.videoHeight);
          c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          meta.thumb = c.toDataURL('image/jpeg', 0.7);
        } catch (e) {}
        finish(meta);
      };
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    v.src = url;
  });
}

async function mbMeta(file) {
  try {
    const mb = await import('mediabunny');
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
    const duration = await input.computeDuration();
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();
    const meta = { duration, w: vt?.displayWidth || 0, h: vt?.displayHeight || 0, hasAudio: !!at, canDecode: vt ? await vt.canDecode() : false, codec: vt?.codec };
    if (vt && meta.canDecode) {
      try {
        const sink = new mb.CanvasSink(vt, { width: 200, fit: 'contain' });
        const wc = await sink.getCanvas(Math.min(0.5, duration / 3));
        if (wc) {
          const c = document.createElement('canvas');
          c.width = wc.canvas.width; c.height = wc.canvas.height;
          c.getContext('2d').drawImage(wc.canvas, 0, 0);
          meta.thumb = c.toDataURL('image/jpeg', 0.7);
        }
      } catch (e) {}
    }
    return meta;
  } catch (e) {
    return null;
  }
}

async function imageMeta(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  const s = 200 / Math.max(bmp.width, bmp.height);
  c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return { bmp, meta: { w: bmp.width, h: bmp.height, duration: 0, thumb: c.toDataURL('image/jpeg', 0.75) } };
}

// استيراد ملف واحد وإنشاء سجل له
export async function importFile({ file, handle }, { forceKind = null, copyAlways = false, role = null } = {}) {
  const kind = forceKind || kindOf(file);
  if (!kind) throw new Error('صيغة غير مدعومة: ' + file.name);
  const id = uid('med');
  const rec = { id, name: file.name, kind, mime: file.type, size: file.size, lastModified: file.lastModified, createdAt: Date.now(), role };
  const rt = { file, url: URL.createObjectURL(file) };
  if (kind === 'image') {
    const { bmp, meta } = await imageMeta(file);
    Object.assign(rec, meta);
    rt.bitmap = bmp;
  } else if (kind === 'video') {
    let meta = await videoMeta(rt.url);
    const mbm = await mbMeta(file);
    if (!meta || !meta.duration || !isFinite(meta.duration)) meta = mbm;
    if (!meta) throw new Error('تعذّرت قراءة الفيديو: ' + file.name);
    Object.assign(rec, { duration: meta.duration, w: meta.w, h: meta.h, thumb: meta.thumb || mbm?.thumb, hasAudio: mbm ? mbm.hasAudio : true, codec: mbm?.codec, playable: !!(meta && meta.w) });
  } else {
    const buf = await decodeAudio(file);
    if (!buf) throw new Error('تعذّرت قراءة الصوت: ' + file.name);
    rt.audio = buf;
    Object.assign(rec, { duration: buf.duration, peaks: computePeaks(buf, 600) });
  }
  // التخزين: مقبض (بلا نسخ) أو نسخة داخل البرنامج
  if (handle && !copyAlways) {
    rec.storage = 'handle';
    rec.handle = handle;
  } else if (hasOPFS()) {
    try {
      await saveToOPFS(id, file);
      rec.storage = 'opfs';
    } catch (e) {
      rec.storage = 'memory';
    }
  } else rec.storage = 'memory';
  runtime.set(id, rt);
  await db.put('media', rec);
  if (kind === 'video' && rec.hasAudio) loadAudio(id); // في الخلفية
  return rec;
}

// إنشاء وسيط من بيانات مولّدة داخل البرنامج (تسجيل صوتي، أصوات مدمجة...)
export async function importBlob(blob, name, kind, extra = {}) {
  const file = new File([blob], name, { type: blob.type });
  return importFile({ file }, { forceKind: kind, copyAlways: true, ...extra });
}

const recCache = new Map();
export async function getRecord(id) {
  if (recCache.has(id)) return recCache.get(id);
  const r = await db.get('media', id);
  if (r) recCache.set(id, r);
  return r;
}
export function cachedRecord(id) { return recCache.get(id); }
export async function updateRecord(rec) { recCache.set(rec.id, rec); await db.put('media', rec); }

// تجهيز ملف الوسيط للعمل (بعد فتح البرنامج من جديد)
export async function ensure(id, { request = false } = {}) {
  if (runtime.has(id) && runtime.get(id).file) return { ok: true, rt: runtime.get(id) };
  const rec = await getRecord(id);
  if (!rec) return { ok: false, reason: 'missing' };
  let file = null;
  try {
    if (rec.storage === 'handle' && rec.handle) {
      let perm = await rec.handle.queryPermission?.({ mode: 'read' });
      if (perm !== 'granted' && request) perm = await rec.handle.requestPermission?.({ mode: 'read' });
      if (perm !== 'granted') return { ok: false, reason: 'permission', rec };
      file = await rec.handle.getFile();
    } else if (rec.storage === 'opfs') {
      file = await readFromOPFS(rec.id);
    } else if (rec.storage === 'builtin') {
      return { ok: false, reason: 'builtin', rec };
    }
  } catch (e) {
    return { ok: false, reason: 'missing', rec };
  }
  if (!file) return { ok: false, reason: 'missing', rec };
  const rt = { file, url: URL.createObjectURL(file) };
  if (rec.kind === 'image') rt.bitmap = await createImageBitmap(file);
  runtime.set(id, rt);
  emit(id);
  return { ok: true, rt };
}

export function rt(id) { return runtime.get(id); }
export function setRuntime(id, data) { runtime.set(id, { ...(runtime.get(id) || {}), ...data }); emit(id); }

// تحميل الصوت المفكوك لوسيط (مع تخزين مؤقت)
export function loadAudio(id) {
  const r = runtime.get(id);
  if (!r) return Promise.resolve(null);
  if (r.audio) return Promise.resolve(r.audio);
  if (!r.audioPromise) {
    r.audioPromise = decodeAudio(r.file).then((b) => { r.audio = b; emit(id); return b; }).catch(() => null);
  }
  return r.audioPromise;
}

export function audioBuffers(ids) {
  const m = new Map();
  for (const id of ids) { const r = runtime.get(id); if (r?.audio) m.set(id, r.audio); }
  return m;
}

export async function removeMedia(id) {
  const rec = await getRecord(id);
  if (rec?.storage === 'opfs') {
    try { const dir = await opfsDir(); await dir.removeEntry(id); } catch (e) {}
  }
  const r = runtime.get(id);
  if (r?.url) URL.revokeObjectURL(r.url);
  runtime.delete(id);
  recCache.delete(id);
  await db.del('media', id);
}

// كل الوسائط المستخدمة في مشروع
export function mediaIdsOf(p) {
  const s = new Set();
  for (const c of p.clips) s.add(c.mediaId);
  for (const a of p.audio || []) s.add(a.mediaId);
  for (const o of p.overlays || []) if (o.mediaId) s.add(o.mediaId);
  if (p.background?.mediaId) s.add(p.background.mediaId);
  return [...s].filter(Boolean);
}

export async function requestPersistence() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch (e) {}
  return false;
}

// خريطة الصور الجاهزة للرسم (للخلفية والملصقات)
export function assetMap() {
  const m = new Map();
  for (const [id, r] of runtime) if (r.bitmap) m.set(id, { img: r.bitmap, w: r.bitmap.width, h: r.bitmap.height });
  return m;
}
