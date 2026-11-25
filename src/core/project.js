// نموذج المشروع: كل ما يصف الفيديو، بصيغة JSON قابلة للحفظ والتراجع.
// الوسائط نفسها لا تُخزَّن هنا، بل يُشار إليها بـ mediaId (راجع media/library.js).

export const ASPECTS = {
  '9:16': { w: 9, h: 16, label: '٩:١٦ عمودي' },
  '16:9': { w: 16, h: 9, label: '١٦:٩ عرضي' },
  '1:1': { w: 1, h: 1, label: '١:١ مربع' },
  '4:5': { w: 4, h: 5, label: '٤:٥ إنستغرام' },
};

export const DEFAULT_IMAGE_DURATION = 3; // ثوانٍ للصورة الثابتة

let counter = 0;
export function uid(prefix = 'id') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

export function newProject(name = 'مشروع جديد') {
  const now = Date.now();
  return {
    version: 1,
    id: uid('prj'),
    name,
    createdAt: now,
    updatedAt: now,
    aspect: '9:16',
    background: { type: 'blur', color: '#000000', mediaId: null },
    imageDuration: DEFAULT_IMAGE_DURATION,
    clips: [],
    audio: [], // موسيقى، مؤثرات، تسجيلات
    texts: [], // النصوص وكلمات الأغاني
    overlays: [], // الملصقات والطبقات
    beats: [], // علامات الإيقاع (بزمن الخط الزمني)
    lyrics: null, // { audioId, lines:[{id,text,start,end}], style }
    duck: { enabled: true, level: 0.3 },
    grade: null, // توحيد الألوان
  };
}

export function newClip(media, opts = {}) {
  const isImage = media.kind === 'image';
  const dur = isImage ? (opts.imageDuration ?? DEFAULT_IMAGE_DURATION) : media.duration || 0;
  return {
    id: uid('clp'),
    mediaId: media.id,
    type: isImage ? 'image' : 'video',
    in: 0,
    out: isImage ? 0 : dur,
    duration: isImage ? dur : undefined, // للصورة والإطار المجمّد فقط
    srcDuration: isImage ? undefined : dur, // طول الملف الأصلي
    speed: 1,
    curve: 'none',
    reverse: false,
    volume: 1,
    muted: false,
    audioDetached: false,
    rotate: 0,
    flipH: false,
    flipV: false,
    crop: null, // {x,y,w,h} نسب من 0 إلى 1
    zoom: isImage ? { enabled: true, from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.15, x: 0.5, y: 0.5 } } : null,
    transition: null, // {type, dur} الانتقال إلى المقطع التالي
    filter: 'none',
    adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 },
    effects: [], // [{type, start, end}] بزمن المقطع
    frame: null,
    freezeAt: undefined, // للإطار المجمّد: زمن المصدر
  };
}

export function clone(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}

// ترقية المشاريع القديمة لتحمل الحقول الجديدة دون كسر
export function normalizeProject(p) {
  const base = newProject(p.name);
  const out = { ...base, ...p };
  for (const k of ['clips', 'audio', 'texts', 'overlays', 'beats']) if (!Array.isArray(out[k])) out[k] = [];
  if (!ASPECTS[out.aspect]) out.aspect = '9:16';
  out.clips = out.clips.map((c) => {
    const d = newClip({ id: c.mediaId, kind: c.type === 'video' ? 'video' : 'image', duration: c.srcDuration || c.out || 0 });
    return { ...d, ...c, adjust: { ...d.adjust, ...(c.adjust || {}) } };
  });
  return out;
}
