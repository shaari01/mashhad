// رسم النصوص العربية: Canvas 2D في Chrome يشكّل العربية صحيحًا (اتصال الحروف واتجاهها)
// لأنه يستخدم HarfBuzz داخليًا، بشرط ضبط direction = 'rtl'.
// يدعم: الخط، واللون، والحد، والظل، والخلفية، وحركات الدخول والخروج، والكاراوكي.
import { fontInfo } from '../fontlist.js';
import { clamp } from '../core/timeline.js';

export const ANIMS = {
  none: 'بلا',
  fade: 'تلاشٍ',
  up: 'صعود',
  down: 'نزول',
  right: 'من اليمين',
  left: 'من اليسار',
  zoom: 'تكبير',
  pop: 'قفزة',
  words: 'كلمة كلمة',
  wipe: 'كشف',
  blur: 'ضباب',
};

export function newText(opts = {}) {
  return {
    id: 'txt_' + Math.random().toString(36).slice(2, 10),
    text: 'اكتب هنا',
    start: 0,
    end: 3,
    x: 0.5,
    y: 0.8,
    font: 'Cairo',
    bold: true,
    size: 0.08, // نسبة من الضلع الأقصر
    color: '#ffffff',
    stroke: { color: '#000000', width: 0.6 },
    shadow: true,
    bg: null, // {color, opacity}
    align: 'center',
    animIn: 'pop',
    animOut: 'fade',
    animDur: 0.4,
    karaoke: false,
    kcolor: '#ffd400',
    rotation: 0,
    ...opts,
  };
}

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function animState(tx, local, dur, px) {
  const d = Math.min(tx.animDur || 0.4, dur / 2);
  const s = { alpha: 1, dx: 0, dy: 0, scale: 1, reveal: 1, wipe: 1, blur: 0 };
  const apply = (type, p) => { // p: 0 مخفي ← 1 ظاهر
    const e = easeOut(p);
    switch (type) {
      case 'fade': s.alpha *= p; break;
      case 'up': s.dy += (1 - e) * px * 1.5; s.alpha *= p; break;
      case 'down': s.dy -= (1 - e) * px * 1.5; s.alpha *= p; break;
      case 'right': s.dx += (1 - e) * px * 4; s.alpha *= p; break;
      case 'left': s.dx -= (1 - e) * px * 4; s.alpha *= p; break;
      case 'zoom': s.scale *= 0.3 + 0.7 * e; s.alpha *= p; break;
      case 'pop': s.scale *= Math.max(0.01, backOut(p)); s.alpha *= Math.min(1, p * 3); break;
      case 'words': s.reveal = Math.min(s.reveal, p); break;
      case 'wipe': s.wipe = Math.min(s.wipe, e); break;
      case 'blur': s.blur = Math.max(s.blur, (1 - p) * px * 0.3); s.alpha *= p; break;
    }
  };
  if (d > 0) {
    if (tx.animIn && tx.animIn !== 'none' && local < d) apply(tx.animIn, clamp(local / d, 0, 1));
    if (tx.animOut && tx.animOut !== 'none' && local > dur - d) apply(tx.animOut === 'words' ? 'fade' : tx.animOut, clamp((dur - local) / d, 0, 1));
  }
  return s;
}

// تقدم الكاراوكي لكل سطر: يُوزَّع زمن النص على الكلمات بحسب عدد حروفها
export function karaokeProgress(lines, p) {
  const lens = lines.map((l) => l.replace(/\s+/g, '').length || 1);
  const total = lens.reduce((a, b) => a + b, 0);
  let pos = p * total;
  return lens.map((n) => { const v = clamp(pos / n, 0, 1); pos -= n; return v; });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const hitBoxes = new Map(); // id -> {x,y,w,h} بنسب اللوحة (لسحب النص على المعاينة)

export function drawText(ctx, W, H, tx, local, dur, opts = {}) {
  const fi = fontInfo(tx.font);
  const px = Math.max(4, tx.size * Math.min(W, H) * (fi.scale || 1));
  const weight = tx.bold && fi.bold !== false ? 700 : 400;
  ctx.save();
  ctx.font = `${weight} ${px}px "${fi.id}", "Cairo", sans-serif`;
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  const lines = String(tx.text || '').split('\n');
  const lh = px * (fi.lh || 1.45);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const maxW = Math.max(1, ...widths);
  const blockH = lh * lines.length;
  const st = animState(tx, local, dur, px);
  const cx = tx.x * W + st.dx, cy = tx.y * H + st.dy;
  hitBoxes.set(tx.id, { x: (cx - maxW / 2 - px * 0.3) / W, y: (cy - blockH / 2 - px * 0.2) / H, w: (maxW + px * 0.6) / W, h: (blockH + px * 0.4) / H });
  ctx.globalAlpha = clamp(st.alpha, 0, 1);
  ctx.translate(cx, cy);
  if (tx.rotation) ctx.rotate((tx.rotation * Math.PI) / 180);
  ctx.scale(st.scale, st.scale);
  if (st.blur > 0.5) ctx.filter = `blur(${st.blur.toFixed(1)}px)`;
  // الكشف من اليمين إلى اليسار
  if (st.wipe < 1) { ctx.beginPath(); ctx.rect(maxW / 2 - (maxW + px) * st.wipe, -blockH, (maxW + px) * st.wipe + px, blockH * 2); ctx.clip(); }
  if (tx.bg) {
    ctx.save();
    ctx.globalAlpha *= tx.bg.opacity ?? 0.6;
    ctx.fillStyle = tx.bg.color || '#000';
    const pad = px * 0.35;
    roundRect(ctx, -maxW / 2 - pad, -blockH / 2 - pad * 0.5, maxW + pad * 2, blockH + pad, px * 0.25);
    ctx.fill();
    ctx.restore();
  }
  const kp = tx.karaoke ? karaokeProgress(lines, opts.karaokeP ?? clamp(local / Math.max(0.01, dur), 0, 1)) : null;
  // كشف الكلمات تدريجيًا
  const totalWords = lines.reduce((a, l) => a + l.split(/\s+/).filter(Boolean).length, 0);
  let wordsLeft = st.reveal < 1 ? Math.ceil(st.reveal * totalWords) : Infinity;
  lines.forEach((line, i) => {
    const y = -blockH / 2 + lh * (i + 0.5);
    const w = widths[i];
    let xr; // الحافة اليمنى للسطر
    if (tx.align === 'right') xr = maxW / 2; else if (tx.align === 'left') xr = -maxW / 2 + w; else xr = w / 2;
    let str = line;
    if (wordsLeft !== Infinity) {
      const ws = line.split(/\s+/).filter(Boolean);
      str = ws.slice(0, Math.max(0, wordsLeft)).join(' ');
      wordsLeft -= ws.length;
      if (!str) return;
    }
    ctx.textAlign = 'right';
    const paint = (color) => {
      if (tx.stroke && tx.stroke.width > 0) {
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = tx.stroke.width * px * 0.16;
        ctx.strokeStyle = tx.stroke.color;
        ctx.strokeText(str, xr, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, xr, y);
    };
    if (tx.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.65)';
      ctx.shadowBlur = px * 0.18;
      ctx.shadowOffsetY = px * 0.06;
      paint(tx.color);
      ctx.restore();
    } else paint(tx.color);
    if (kp && kp[i] > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(xr - w * kp[i], y - lh / 2, w * kp[i] + px * 0.3, lh);
      ctx.clip();
      paint(tx.kcolor || '#ffd400');
      ctx.restore();
    }
  });
  ctx.restore();
}

export function drawTexts(ctx, W, H, project, t) {
  hitBoxes.clear();
  for (const tx of project.texts || []) {
    if (t < tx.start || t >= tx.end || tx.hidden) continue;
    drawText(ctx, W, H, tx, t - tx.start, tx.end - tx.start);
  }
}
