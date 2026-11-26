// الملصقات والطبقات فوق الفيديو: إيموجي، وأشكال، وأسهم، وفقاعات كلام، وصورك (PNG/GIF)،
// وفيديو أو صورة فوق فيديو (PiP). مع حركة دخول، وتتبع حركة، وإزالة الخلفية الخضراء.
import { clamp } from '../core/timeline.js';
import { chromaKey } from './chroma.js';

export function newOverlay(o = {}) {
  return {
    id: 'ovl_' + Math.random().toString(36).slice(2, 10),
    kind: 'emoji', // emoji | shape | image | anim | video
    content: '😂',
    mediaId: null,
    start: 0,
    end: 3,
    x: 0.5,
    y: 0.4,
    size: 0.3, // العرض نسبةً إلى الضلع الأقصر
    rot: 0,
    opacity: 1,
    flip: false,
    color: '#ffffff',
    text: '',
    animIn: 'pop',
    animOut: 'fade',
    srcIn: 0, // بداية الفيديو المضاف
    border: null, // {color, width, radius}
    chroma: null, // {color:'#00ff00', tol:0.35}
    track: null, // [{t, x, y}] بزمن الخط الزمني
    ...o,
  };
}

export const SHAPES = {
  arrow: 'سهم',
  arrowCurve: 'سهم منحني',
  circle: 'دائرة',
  heart: 'قلب',
  star: 'نجمة',
  bubble: 'فقاعة كلام',
  think: 'فقاعة تفكير',
  burst: 'انفجار',
  bolt: 'برق',
  rect: 'إطار',
};

const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

// موضع الملصق مع تتبع الحركة (استيفاء بين نقاط المسار)
export function overlayPos(o, t) {
  if (!o.track || o.track.length === 0) return { x: o.x, y: o.y };
  const tr = o.track;
  if (t <= tr[0].t) return { x: tr[0].x + (o.dx || 0), y: tr[0].y + (o.dy || 0) };
  for (let i = 1; i < tr.length; i++) {
    if (t <= tr[i].t) {
      const a = tr[i - 1], b = tr[i];
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x - a.x) * f + (o.dx || 0), y: a.y + (b.y - a.y) * f + (o.dy || 0) };
    }
  }
  const l = tr[tr.length - 1];
  return { x: l.x + (o.dx || 0), y: l.y + (o.dy || 0) };
}

export function overlayFrameSpecs(project, t) {
  const out = [];
  for (const o of project.overlays || []) {
    if (t < o.start || t >= o.end) continue;
    if (o.kind === 'video') out.push({ id: o.id, kind: 'video', mediaId: o.mediaId, src: (o.srcIn || 0) + (t - o.start) });
    else if (o.kind === 'image') out.push({ id: o.id, kind: 'image', mediaId: o.mediaId });
    else if (o.kind === 'anim') out.push({ id: o.id, kind: 'anim', mediaId: o.mediaId, src: t - o.start });
  }
  return out;
}

export const overlayBoxes = new Map();

function shapePath(ctx, kind, w, h) {
  const p = new Path2D();
  const hw = w / 2, hh = h / 2;
  switch (kind) {
    case 'arrow':
      p.moveTo(-hw, -hh * 0.25); p.lineTo(hw * 0.2, -hh * 0.25); p.lineTo(hw * 0.2, -hh * 0.7); p.lineTo(hw, 0); p.lineTo(hw * 0.2, hh * 0.7); p.lineTo(hw * 0.2, hh * 0.25); p.lineTo(-hw, hh * 0.25); p.closePath(); break;
    case 'circle': p.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2); break;
    case 'heart':
      p.moveTo(0, hh * 0.9);
      p.bezierCurveTo(-hw * 1.2, -hh * 0.1, -hw * 0.6, -hh * 1.1, 0, -hh * 0.45);
      p.bezierCurveTo(hw * 0.6, -hh * 1.1, hw * 1.2, -hh * 0.1, 0, hh * 0.9); break;
    case 'star': case 'burst': {
      const n = kind === 'star' ? 5 : 12, ri = kind === 'star' ? 0.45 : 0.7;
      for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : 1; const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * hw * r, y = Math.sin(a) * hh * r; i ? p.lineTo(x, y) : p.moveTo(x, y); }
      p.closePath(); break;
    }
    case 'bolt':
      p.moveTo(hw * 0.2, -hh); p.lineTo(-hw * 0.6, hh * 0.1); p.lineTo(-hw * 0.05, hh * 0.1); p.lineTo(-hw * 0.3, hh); p.lineTo(hw * 0.6, -hh * 0.15); p.lineTo(hw * 0.05, -hh * 0.15); p.closePath(); break;
    case 'bubble': {
      const r = Math.min(hw, hh) * 0.35;
      p.roundRect(-hw, -hh, w, hh * 1.5, r);
      p.moveTo(hw * 0.2, hh * 0.5); p.lineTo(hw * 0.45, hh); p.lineTo(-hw * 0.1, hh * 0.5); break;
    }
    case 'think':
      p.ellipse(0, -hh * 0.2, hw, hh * 0.75, 0, 0, Math.PI * 2);
      p.moveTo(hw * 0.5 + hh * 0.12, hh * 0.7); p.arc(hw * 0.5, hh * 0.7, hh * 0.12, 0, Math.PI * 2);
      p.moveTo(hw * 0.7 + hh * 0.07, hh * 0.93); p.arc(hw * 0.7, hh * 0.93, hh * 0.07, 0, Math.PI * 2); break;
    case 'rect': p.rect(-hw, -hh, w, h); break;
    default: p.rect(-hw, -hh, w, h);
  }
  return p;
}

function drawShape(ctx, o, w) {
  const h = o.content === 'arrow' || o.content === 'arrowCurve' ? w * 0.5 : o.content === 'bubble' || o.content === 'think' ? w * 0.7 : w;
  if (o.content === 'arrowCurve') {
    ctx.lineWidth = w * 0.08; ctx.lineCap = 'round'; ctx.strokeStyle = o.color;
    ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.quadraticCurveTo(-w * 0.1, -h * 0.8, w * 0.35, -h * 0.1); ctx.stroke();
    ctx.fillStyle = o.color; ctx.beginPath(); ctx.moveTo(w / 2, h * 0.15); ctx.lineTo(w * 0.18, h * 0.12); ctx.lineTo(w * 0.42, -h * 0.4); ctx.closePath(); ctx.fill();
    return h;
  }
  const path = shapePath(ctx, o.content, w, h);
  const outline = o.content === 'circle' || o.content === 'rect';
  if (outline) { ctx.lineWidth = w * 0.05; ctx.strokeStyle = o.color; ctx.stroke(path); }
  else {
    ctx.fillStyle = o.color; ctx.fill(path);
    ctx.lineWidth = w * 0.025; ctx.strokeStyle = o.content === 'bubble' || o.content === 'think' ? '#000' : 'rgba(0,0,0,.5)'; ctx.stroke(path);
  }
  if ((o.content === 'bubble' || o.content === 'think' || o.content === 'burst') && o.text) {
    ctx.fillStyle = o.textColor || '#000';
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = w * 0.16;
    ctx.font = `700 ${fs}px "Cairo", sans-serif`;
    const maxW = w * 0.85;
    const mw = ctx.measureText(o.text).width;
    if (mw > maxW) { fs *= maxW / mw; ctx.font = `700 ${fs}px "Cairo", sans-serif`; }
    ctx.fillText(o.text, 0, o.content === 'bubble' ? -h * 0.18 : o.content === 'think' ? -h * 0.15 : 0);
  }
  return h;
}

export function drawOverlays(ctx, W, H, project, t, frames, assets) {
  overlayBoxes.clear();
  const S = Math.min(W, H);
  for (const o of project.overlays || []) {
    if (t < o.start || t >= o.end || o.hidden) continue;
    const local = t - o.start, dur = o.end - o.start;
    let sc = 1, alpha = o.opacity ?? 1;
    const ad = Math.min(0.35, dur / 3);
    if (o.animIn === 'pop' && local < ad) { const q = local / ad; sc *= Math.max(0.01, backOut(q)); alpha *= Math.min(1, q * 3); }
    if (o.animIn === 'fade' && local < ad) alpha *= local / ad;
    if (o.animIn === 'zoom' && local < ad) sc *= 0.2 + 0.8 * (local / ad);
    if (o.animOut === 'fade' && dur - local < ad) alpha *= (dur - local) / ad;
    if (o.animOut === 'pop' && dur - local < ad) sc *= Math.max(0.01, (dur - local) / ad);
    const pos = overlayPos(o, t);
    const w = o.size * S;
    let h = w;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(pos.x * W, pos.y * H);
    ctx.rotate(((o.rot || 0) * Math.PI) / 180);
    ctx.scale((o.flip ? -1 : 1) * sc, sc);
    if (o.kind === 'emoji') {
      ctx.font = `${w * 0.85}px "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.content, 0, w * 0.05);
    } else if (o.kind === 'shape') {
      h = drawShape(ctx, o, w);
    } else {
      const f = frames?.get(o.id);
      if (f && f.w) {
        h = (w * f.h) / f.w;
        let img = f.img;
        if (o.chroma) img = chromaKey(f.img, f.w, f.h, o.chroma, Math.max(64, Math.round(w)));
        if (o.border) {
          const r = (o.border.radius ?? 0.06) * w;
          ctx.save();
          ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.clip();
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          if (o.border.width > 0) { ctx.lineWidth = o.border.width * w * 0.02; ctx.strokeStyle = o.border.color || '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.stroke(); }
        } else ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else h = w * 0.6;
    }
    ctx.restore();
    overlayBoxes.set(o.id, { x: (pos.x * W - w / 2) / W, y: (pos.y * H - h / 2) / H, w: w / W, h: h / H });
  }
}
