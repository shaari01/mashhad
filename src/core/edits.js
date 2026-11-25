// عمليات التحرير على المشروع. كل دالة تعدّل نسخة المشروع الممرَّرة وتعيد نتيجة بسيطة.
import { uid, clone, newClip } from './project.js';
import { layout, clipDuration, sourceTime, srcLength, MIN_CLIP, clamp, localTimeForSource, snap } from './timeline.js';

export function findClip(p, id) {
  const i = p.clips.findIndex((c) => c.id === id);
  return { clip: p.clips[i], index: i };
}

export function addClips(p, mediaList, atIndex = p.clips.length) {
  const added = mediaList.map((m) => newClip(m, { imageDuration: p.imageDuration }));
  p.clips.splice(atIndex, 0, ...added);
  return added;
}

export function moveClip(p, from, to) {
  if (from === to || from < 0 || to < 0 || from >= p.clips.length || to >= p.clips.length) return false;
  const [c] = p.clips.splice(from, 1);
  p.clips.splice(to, 0, c);
  return true;
}

export function removeClip(p, id) {
  const { index } = findClip(p, id);
  if (index < 0) return false;
  p.clips.splice(index, 1);
  return true;
}

export function duplicateClip(p, id) {
  const { clip, index } = findClip(p, id);
  if (!clip) return null;
  const c = clone(clip);
  c.id = uid('clp');
  p.clips.splice(index + 1, 0, c);
  return c;
}

// القص: in/out بزمن المصدر (للفيديو) أو المدة (للصورة)
export function trimClip(p, id, inT, outT) {
  const { clip } = findClip(p, id);
  if (!clip) return false;
  if (clip.type === 'image' || clip.type === 'freeze') {
    clip.duration = Math.max(MIN_CLIP, outT - inT);
    return true;
  }
  const max = clip.srcDuration ?? clip.out;
  inT = clamp(inT, 0, max);
  outT = clamp(outT, 0, max);
  if (outT - inT < MIN_CLIP) return false;
  clip.in = inT;
  clip.out = outT;
  return true;
}

// التقسيم عند زمن على الخط الزمني
export function splitAt(p, t, beats = null) {
  if (beats) t = snap(t, beats);
  const lay = layout(p);
  const it = [...lay.items].reverse().find((x) => t > x.start + MIN_CLIP && t < x.end - MIN_CLIP);
  if (!it) return null;
  const c = it.clip;
  const local = t - it.start;
  const second = clone(c);
  second.id = uid('clp');
  if (c.type === 'image' || c.type === 'freeze') {
    second.duration = c.duration - local;
    c.duration = local;
  } else {
    const s = sourceTime(c, local);
    if (c.reverse) {
      second.out = s; // الجزء الثاني يبدأ من s نزولًا
      c.in = s;
    } else {
      second.in = s;
      c.out = s;
    }
    if (srcLength(c) < MIN_CLIP / 4 || srcLength(second) < MIN_CLIP / 4) return null;
  }
  // الانتقال يبقى على الجزء الثاني (نهاية المقطع الأصلي)، ولا انتقال بين الجزأين
  c.transition = null;
  p.clips.splice(it.index + 1, 0, second);
  return { first: c, second };
}

// حذف جزء من الوسط: من a إلى b بزمن محلي داخل المقطع
export function deleteRange(p, id, a, b) {
  const { clip, index } = findClip(p, id);
  if (!clip) return false;
  const D = clipDuration(clip);
  a = clamp(a, 0, D);
  b = clamp(b, 0, D);
  if (b - a < MIN_CLIP / 2) return false;
  if (a < MIN_CLIP && b > D - MIN_CLIP) return removeClip(p, id);
  const start = layout(p).items[index].start;
  if (b > D - MIN_CLIP) { // حذف النهاية
    return !!splitAt(p, start + a) && p.clips.splice(index + 1, 1).length === 1;
  }
  if (a < MIN_CLIP) { // حذف البداية
    const r = splitAt(p, start + b);
    if (!r) return false;
    p.clips.splice(index, 1);
    return true;
  }
  const r2 = splitAt(p, start + b);
  if (!r2) return false;
  const r1 = splitAt(p, start + a);
  if (!r1) return false;
  p.clips.splice(index + 1, 1); // الجزء الأوسط
  return true;
}

// تجميد إطار عند زمن على الخط الزمني: يُقسَّم المقطع ويُدرج إطار ثابت بينهما
export function freezeAt(p, t, dur = 2) {
  const lay = layout(p);
  const it = [...lay.items].reverse().find((x) => t >= x.start && t < x.end);
  if (!it || it.clip.type !== 'video') return null;
  const src = sourceTime(it.clip, t - it.start);
  const fr = {
    ...clone(it.clip),
    id: uid('clp'),
    type: 'freeze',
    freezeAt: src,
    duration: dur,
    transition: null,
    zoom: { enabled: true, from: { s: 1, x: 0.5, y: 0.5 }, to: { s: 1.25, x: 0.5, y: 0.45 } },
    effects: [],
  };
  let insertAt = it.index + 1;
  if (t - it.start > MIN_CLIP && it.end - t > MIN_CLIP) {
    const r = splitAt(p, t);
    if (r) insertAt = it.index + 1;
  }
  p.clips.splice(insertAt, 0, fr);
  return fr;
}

export function setSpeed(p, id, speed, curve) {
  const { clip } = findClip(p, id);
  if (!clip || clip.type !== 'video') return false;
  if (speed != null) clip.speed = clamp(speed, 0.25, 4);
  if (curve != null) clip.curve = curve;
  return true;
}

// استبدال الملف مع الحفاظ على التعديلات
export function replaceMedia(p, id, media) {
  const { clip } = findClip(p, id);
  if (!clip) return false;
  const kind = media.kind === 'image' ? 'image' : 'video';
  const oldDur = clipDuration(clip);
  clip.mediaId = media.id;
  if (kind === 'image') {
    clip.type = 'image';
    clip.duration = oldDur;
  } else {
    clip.type = 'video';
    clip.srcDuration = media.duration;
    const need = oldDur * (clip.speed || 1);
    clip.in = Math.min(clip.in || 0, Math.max(0, media.duration - MIN_CLIP));
    clip.out = Math.min(media.duration, clip.in + Math.max(need, MIN_CLIP));
  }
  return true;
}

export function applyToAll(p, fn) {
  for (const c of p.clips) fn(c);
}

// مواءمة المقاطع مع علامات الإيقاع: كل قطع يقع على علامة
export function fitClipsToBeats(p) {
  const beats = [...(p.beats || [])].sort((a, b) => a - b);
  if (beats.length < 2 || !p.clips.length) return false;
  const lay = layout(p);
  let changed = false;
  for (let i = 0; i < lay.items.length - 1; i++) {
    const it = layout(p).items[i];
    const target = snap(it.end, beats, 10);
    const c = it.clip;
    const newDur = target - it.start;
    if (newDur < MIN_CLIP * 2) continue;
    if (c.type === 'image' || c.type === 'freeze') { c.duration = newDur; changed = true; continue; }
    // مدّ أو قص النهاية في المصدر
    const curDur = clipDuration(c);
    const ratio = newDur / curDur;
    const L = srcLength(c) * ratio;
    const max = c.srcDuration ?? c.out;
    if (c.reverse) c.in = clamp(c.out - L, 0, c.out - MIN_CLIP);
    else c.out = clamp(c.in + L, c.in + MIN_CLIP, max);
    changed = true;
  }
  return changed;
}

export { localTimeForSource };
