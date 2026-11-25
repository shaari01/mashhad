// المركِّب: يرسم إطار الفيديو عند زمن t على لوحة Canvas 2D.
// يُستخدم نفس الكود في المعاينة والتصدير، فيطابق الناتج ما تراه.
import { ASPECTS } from '../core/project.js';
import { activeAt, clamp } from '../core/timeline.js';
import { drawTransition } from './transitions.js';
import { clipFilter, drawClipEffects, effectTransform, drawGlobalEffects } from './effects.js';
import { drawTexts } from './text.js';
import { drawOverlays } from './overlays.js';

export function outputSize(aspect, shortSide = 720) {
  const a = ASPECTS[aspect] || ASPECTS['9:16'];
  let w, h;
  if (a.w <= a.h) { w = shortSide; h = Math.round((shortSide * a.h) / a.w); } else { h = shortSide; w = Math.round((shortSide * a.w) / a.h); }
  return { w: w & ~1, h: h & ~1 };
}

const ease = (x) => x * x * (3 - 2 * x);

// أبعاد المصدر بعد التدوير والقص
function srcGeom(frame, clip) {
  const rot = ((clip.rotate || 0) % 360 + 360) % 360;
  const sw = frame.w, sh = frame.h;
  const cr = clip.crop || { x: 0, y: 0, w: 1, h: 1 };
  const cw = sw * cr.w, ch = sh * cr.h;
  const swap = rot === 90 || rot === 270;
  return { rot, cw, ch, dw: swap ? ch : cw, dh: swap ? cw : ch, cr };
}

let tmpCanvases = new Map();
function tmp(key, w, h) {
  let c = tmpCanvases.get(key);
  if (!c) {
    c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    tmpCanvases.set(key, c);
  }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

// رسم المصدر نفسه (مع التدوير والقلب والقص) داخل مستطيل
function drawSource(ctx, frame, clip, g, x, y, w, h) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((g.rot * Math.PI) / 180);
  ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);
  const swap = g.rot === 90 || g.rot === 270;
  const bw = swap ? h : w, bh = swap ? w : h;
  ctx.drawImage(frame.img, g.cr.x * frame.w, g.cr.y * frame.h, g.cw, g.ch, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();
}

function drawBackground(ctx, W, H, project, frame, clip, g, assets) {
  const bg = project.background || { type: 'blur' };
  if (bg.type === 'color' || !frame) {
    ctx.fillStyle = bg.color || '#000';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (bg.type === 'image') {
    const im = assets?.get?.(bg.mediaId);
    if (im) {
      const s = Math.max(W / im.w, H / im.h);
      ctx.drawImage(im.img, (W - im.w * s) / 2, (H - im.h * s) / 2, im.w * s, im.h * s);
      return;
    }
    ctx.fillStyle = bg.color || '#000';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // خلفية ضبابية من المقطع نفسه: تصغير شديد ثم تكبير (رخيص وسريع على الجوال)
  const sw = Math.max(8, Math.round(W / 14)), sh = Math.max(8, Math.round(H / 14));
  const small = tmp('blur', sw, sh);
  const sc = small.getContext('2d');
  sc.filter = 'blur(2px)';
  const s = Math.max(sw / g.dw, sh / g.dh);
  sc.fillStyle = '#000';
  sc.fillRect(0, 0, sw, sh);
  drawSource(sc, frame, clip, g, (sw - g.dw * s) / 2, (sh - g.dh * s) / 2, g.dw * s, g.dh * s);
  sc.filter = 'none';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'brightness(0.75)';
  ctx.drawImage(small, 1, 1, sw - 2, sh - 2, 0, 0, W, H);
  ctx.restore();
}

// رسم مقطع واحد كاملًا (خلفية + صورة + تأثيرات) على سياق
export function drawClip(ctx, W, H, project, item, localT, frame, assets) {
  const clip = item.clip;
  if (!frame) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const g = srcGeom(frame, clip);
  drawBackground(ctx, W, H, project, frame, clip, g, assets);
  const fit = clip.fit === 'cover' ? Math.max(W / g.dw, H / g.dh) : Math.min(W / g.dw, H / g.dh);
  let w = g.dw * fit, h = g.dh * fit;
  let cx = W / 2, cy = H / 2, s = 1;
  // تكبير وتحريك (Ken Burns)
  if (clip.zoom && clip.zoom.enabled) {
    const p = ease(clamp(localT / Math.max(0.01, item.dur), 0, 1));
    const a = clip.zoom.from, b = clip.zoom.to;
    s = a.s + (b.s - a.s) * p;
    const fx = a.x + (b.x - a.x) * p, fy = a.y + (b.y - a.y) * p;
    cx = W / 2 + (0.5 - fx) * w * (s - 1);
    cy = H / 2 + (0.5 - fy) * h * (s - 1);
  }
  const et = effectTransform(clip, localT, item.dur);
  s *= et.s;
  cx += et.dx * W;
  cy += et.dy * H;
  ctx.save();
  if (et.rot) { ctx.translate(W / 2, H / 2); ctx.rotate(et.rot); ctx.translate(-W / 2, -H / 2); }
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.filter = clipFilter(clip, project, localT, item.dur);
  drawSource(ctx, frame, clip, g, cx - (w * s) / 2, cy - (h * s) / 2, w * s, h * s);
  ctx.filter = 'none';
  ctx.restore();
  drawClipEffects(ctx, W, H, clip, localT, item.dur, project);
}

// رسم الإطار الكامل
// frames: Map(clipId -> {img,w,h}) ، overlayFrames: Map(overlayId -> {img,w,h})
export function drawFrame(ctx, W, H, project, lay, t, frames, assets, overlayFrames) {
  const act = activeAt(lay, t);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (act.length === 1) {
    const it = act[0];
    drawClip(ctx, W, H, project, it, t - it.start, frames.get(it.clip.id), assets);
  } else if (act.length >= 2) {
    const a = act[act.length - 2], b = act[act.length - 1];
    const p = clamp((t - b.start) / Math.max(0.001, b.transIn), 0, 1);
    const la = tmp('layerA', W, H), lb = tmp('layerB', W, H);
    const ca = la.getContext('2d'), cb = lb.getContext('2d');
    drawClip(ca, W, H, project, a, t - a.start, frames.get(a.clip.id), assets);
    drawClip(cb, W, H, project, b, t - b.start, frames.get(b.clip.id), assets);
    drawTransition(ctx, la, lb, p, a.clip.transition?.type || 'fade', W, H);
  }
  drawOverlays(ctx, W, H, project, t, overlayFrames, assets);
  drawTexts(ctx, W, H, project, t);
  drawGlobalEffects(ctx, W, H, project, t, lay);
  ctx.restore();
}
