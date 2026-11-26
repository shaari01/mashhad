// القوالب: تختار صورك ومقاطعك فيُبنى فيديو كامل بانتقالات وموسيقى وعنوان. (دوال صافية)
import { newClip, uid, clone } from './project.js';
import { fitClipsToBeats } from './edits.js';
import { layout } from './timeline.js';
import { newText } from '../engine/text.js';
import { newOverlay } from '../engine/overlays.js';

export const BUILTIN_TEMPLATES = [
  {
    id: 'calm', name: 'تذكاري هادئ', emoji: '🌅', builtin: true,
    aspect: '9:16', imageDuration: 3.5, videoMax: 6, speed: 1,
    transitions: ['fade', 'black', 'zoomOut'], transDur: 1,
    filter: 'warm', effects: [], zoom: true, frame: 'vignette',
    music: { builtin: 'calm' }, musicVolume: 0.7,
    title: { text: 'ذكرياتنا', font: 'Amiri', color: '#ffffff', size: 0.12, y: 0.45, animIn: 'fade', bg: null, dur: 3 },
    endText: { text: 'لحظات لا تُنسى', font: 'Amiri', color: '#ffffff', size: 0.08, y: 0.5, animIn: 'words' },
  },
  {
    id: 'fun', name: 'مضحك سريع', emoji: '😂', builtin: true,
    aspect: '9:16', imageDuration: 1.3, videoMax: 3, speed: 1.25,
    transitions: ['zoomIn', 'glitch', 'flash', 'push', 'spin'], transDur: 0.3,
    filter: 'vivid', effects: [{ type: 'punch', start: 0, end: 0.35 }], zoom: true, frame: 'none',
    music: { builtin: 'fun' }, musicVolume: 0.75,
    title: { text: 'لحظات مضحكة 😂', font: 'Lalezar', color: '#ffd400', size: 0.11, y: 0.2, animIn: 'pop', stroke: 1.2, dur: 2.2 },
    sfxOnCuts: ['boing', 'pop', 'whoosh'],
    stickers: [{ content: '😂', at: 'end' }],
  },
  {
    id: 'event', name: 'مناسبة', emoji: '🎉', builtin: true,
    aspect: '9:16', imageDuration: 2.6, videoMax: 5, speed: 1,
    transitions: ['circle', 'slideL', 'zoomOut', 'fade'], transDur: 0.6,
    filter: 'gold', effects: [], zoom: true, frame: 'ornament',
    music: { builtin: 'festive' }, musicVolume: 0.75,
    title: { text: 'مبارك', font: 'Aref Ruqaa', color: '#ffd45e', size: 0.16, y: 0.42, animIn: 'zoom', dur: 3 },
    endText: { text: 'ألف مبروك', font: 'Aref Ruqaa', color: '#ffd45e', size: 0.11, y: 0.5, animIn: 'pop' },
    stickers: [{ content: '✨', at: 'start' }, { content: '🎉', at: 'end' }],
  },
];

// بناء المشروع من قالب. recs: سجلات الوسائط بالترتيب. opts: {musicRec, beats, sfxRecs: Map(id->rec)}
export function applyTemplate(p, tpl, recs, opts = {}) {
  p.aspect = tpl.aspect || p.aspect;
  p.frame = tpl.frame || 'none';
  p.imageDuration = tpl.imageDuration || p.imageDuration;
  p.clips = recs.map((r) => newClip(r, { imageDuration: tpl.imageDuration }));
  p.texts = (p.texts || []).filter((t) => t.lyric);
  p.overlays = [];
  p.audio = [];
  p.beats = [];
  p.lyrics = null;
  p.clips.forEach((c, i) => {
    if (c.type === 'video') {
      c.speed = tpl.speed || 1;
      const max = (tpl.videoMax || 6) * c.speed;
      if (c.out - c.in > max) c.out = c.in + max;
    } else if (tpl.zoom) {
      const dir = i % 3;
      c.zoom = { enabled: true, from: { s: dir === 1 ? 1.2 : 1, x: 0.5, y: 0.5 }, to: { s: dir === 1 ? 1 : 1.2, x: dir === 2 ? 0.45 : 0.5, y: 0.5 } };
    } else c.zoom = null;
    c.filter = tpl.filter || 'none';
    if (tpl.adjust) c.adjust = { ...c.adjust, ...tpl.adjust };
    c.effects = clone(tpl.effects || []);
    const trs = tpl.transitions || [];
    c.transition = i < p.clips.length - 1 && trs.length ? { type: trs[i % trs.length], dur: tpl.transDur || 0.6 } : null;
  });
  if (opts.beats?.length) {
    p.beats = opts.beats.slice();
    fitClipsToBeats(p);
  }
  const T = layout(p).duration;
  if (opts.musicRec) {
    p.audio.push({ id: uid('aud'), mediaId: opts.musicRec.id, kind: 'music', start: 0, in: 0, out: Math.min(opts.musicRec.duration, T), volume: tpl.musicVolume ?? 0.8, fadeIn: 0.3, fadeOut: Math.min(2, T / 4) });
  }
  if (tpl.title?.text) {
    const s = tpl.title;
    p.texts.push(newText({ text: s.text, start: 0, end: Math.min(T, s.dur || 2.5), font: s.font, color: s.color, size: s.size, y: s.y, animIn: s.animIn, animOut: 'fade', bg: s.bg || null, stroke: { color: '#000', width: s.stroke ?? 0.5 } }));
  }
  if (tpl.endText?.text && T > 4) {
    const s = tpl.endText;
    p.texts.push(newText({ text: s.text, start: Math.max(0, T - 2.5), end: T, font: s.font, color: s.color, size: s.size, y: s.y, animIn: s.animIn, animOut: 'none' }));
  }
  for (const st of tpl.stickers || []) {
    const start = st.at === 'end' ? Math.max(0, T - 2) : 0.2;
    p.overlays.push(newOverlay({ kind: 'emoji', content: st.content, start, end: Math.min(T, start + 2), x: st.at === 'end' ? 0.5 : 0.8, y: st.at === 'end' ? 0.7 : 0.15, size: 0.2 }));
  }
  if (tpl.sfxOnCuts?.length && opts.sfxRecs) {
    const lay = layout(p);
    lay.items.slice(1).forEach((it, i) => {
      if (i % 2) return;
      const rec = opts.sfxRecs.get(tpl.sfxOnCuts[(i / 2) % tpl.sfxOnCuts.length]);
      if (rec) p.audio.push({ id: uid('aud'), mediaId: rec.id, kind: 'sfx', start: Math.max(0, it.start - 0.1), in: 0, out: rec.duration, volume: 0.6, fadeIn: 0, fadeOut: 0 });
    });
  }
  return p;
}

// حفظ أسلوب المشروع كقالب
export function templateFromProject(p, name) {
  const clips = p.clips;
  const imgs = clips.filter((c) => c.type === 'image').map((c) => c.duration).sort((a, b) => a - b);
  const vid = clips.find((c) => c.type === 'video');
  const trs = [];
  for (const c of clips) if (c.transition?.type && !trs.includes(c.transition.type)) trs.push(c.transition.type);
  const firstTr = clips.find((c) => c.transition);
  const title = (p.texts || []).find((t) => !t.lyric);
  const music = (p.audio || []).find((a) => a.kind === 'music');
  return {
    id: uid('tpl'), name: name || p.name, emoji: '⭐', builtin: false, createdAt: Date.now(),
    aspect: p.aspect,
    imageDuration: imgs.length ? imgs[Math.floor(imgs.length / 2)] : p.imageDuration,
    videoMax: vid ? Math.max(1, (vid.out - vid.in) / (vid.speed || 1)) : 6,
    speed: vid?.speed || 1,
    transitions: trs, transDur: firstTr?.transition.dur || 0.6,
    filter: clips[0]?.filter || 'none', adjust: clips[0]?.adjust || null,
    effects: clone(clips[0]?.effects || []),
    zoom: clips.some((c) => c.type === 'image' && c.zoom?.enabled),
    frame: p.frame || 'none',
    music: music ? (p.musicBuiltin ? { builtin: p.musicBuiltin } : { mediaId: music.mediaId }) : null,
    musicVolume: music?.volume ?? 0.8,
    title: title ? { text: title.text, font: title.font, color: title.color, size: title.size, y: title.y, animIn: title.animIn, bg: title.bg, stroke: title.stroke?.width, dur: title.end - title.start } : null,
  };
}
