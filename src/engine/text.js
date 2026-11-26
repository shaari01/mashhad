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
  type: 'آلة كاتبة',
};
// حركات إضافية تظهر على اللابتوب والحاسوب (أقوى)، وتُعرض في أي جهاز إن استُعملت في المشروع
export const ANIMS_PRO = {
  blur: 'ضباب',
  spin: 'دوران',
  bounce: 'ارتداد',
  shrink: 'تصغير من كبير',
  flip: 'انقلاب',
  swing: 'تأرجح',
  stretch: 'تمدد',
  fly: 'طيران من بعيد',
  wipeup: 'كشف من الأسفل',
  drop: 'سقوط الكلمات',
  rise: 'صعود الكلمات',
  glow: 'توهج',
};
export const animLabel = (k) => ANIMS[k] || ANIMS_PRO[k] || k;

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
const bounceIn = (p) => { const x = 1 - p; return Math.abs(Math.cos(p * Math.PI * 2.5)) * x * x; }; // ارتفاع يتناقص مع الارتداد
const backOutC = (x) => Math.max(0, 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function animState(tx, local, dur, px) {
  const d = Math.min(tx.animDur || 0.4, dur / 2);
  const s = { alpha: 1, dx: 0, dy: 0, scale: 1, reveal: 1, wipe: 1, blur: 0, rot: 0, sx: 1, sy: 1, glow: 0, chars: 1, wipeV: 1, wordFx: null };
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
      case 'type': s.chars = Math.min(s.chars, p); break;
      case 'spin': s.rot += (1 - e) * Math.PI * 2; s.scale *= 0.2 + 0.8 * e; s.alpha *= p; break;
      case 'bounce': s.dy -= bounceIn(p) * px * 4; s.alpha *= Math.min(1, p * 4); break;
      case 'shrink': s.scale *= 1 + (1 - e) * 2; s.alpha *= p; break;
      case 'flip': s.sy *= Math.max(0.02, e); break;
      case 'swing': s.rot += Math.sin((1 - p) * Math.PI * 4) * (1 - p) * 0.5; s.alpha *= Math.min(1, p * 3); break;
      case 'stretch': s.sx *= 0.05 + 0.95 * backOutC(p); s.alpha *= Math.min(1, p * 2); break;
      case 'fly': s.scale *= 0.1 + 0.9 * e; s.dy += (1 - e) * px * 3; s.alpha *= p; break;
      case 'wipeup': s.wipeV = Math.min(s.wipeV, e); break;
      case 'drop': case 'rise': s.wordFx = { type, p }; break;
      case 'glow': s.glow = Math.max(s.glow, 1 - p); s.alpha *= Math.min(1, p * 2); break;
    }
  };
  if (d > 0) {
    if (tx.animIn && tx.animIn !== 'none' && local < d) apply(tx.animIn, clamp(local / d, 0, 1));
    if (tx.animOut && tx.animOut !== 'none' && local > dur - d) apply(tx.animOut === 'words' || tx.animOut === 'type' ? 'fade' : tx.animOut, clamp((dur - local) / d, 0, 1));
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
  if (tx.rotation || st.rot) ctx.rotate(((tx.rotation || 0) * Math.PI) / 180 + st.rot);
  ctx.scale(st.scale * st.sx, st.scale * st.sy);
  if (st.blur > 0.5) ctx.filter = `blur(${st.blur.toFixed(1)}px)`;
  // الكشف من اليمين إلى اليسار
  if (st.wipe < 1) { ctx.beginPath(); ctx.rect(maxW / 2 - (maxW + px) * st.wipe, -blockH, (maxW + px) * st.wipe + px, blockH * 2); ctx.clip(); }
  if (st.wipeV < 1) { const hh = blockH + px; ctx.beginPath(); ctx.rect(-maxW, hh / 2 - hh * st.wipeV, maxW * 2, hh * st.wipeV); ctx.clip(); }
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
  const totalChars = lines.reduce((a, l) => a + [...l].length, 0);
  let charsLeft = st.chars < 1 ? Math.floor(st.chars * totalChars) : Infinity;
  let wordIdx = 0;
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
    if (charsLeft !== Infinity) {
      const cs = [...line];
      str = cs.slice(0, Math.max(0, charsLeft)).join('');
      charsLeft -= cs.length;
      if (!str) return;
    }
    ctx.textAlign = 'right';
    if (st.glow > 0) { ctx.shadowColor = tx.color; ctx.shadowBlur = px * (0.3 + st.glow * 1.6); }
    if (st.wordFx && !kp) {
      // كل كلمة تتحرك وحدها بتتابع (الكلمات منفصلة فلا يتأثر اتصال الحروف)
      const ws = str.split(/\s+/).filter(Boolean);
      const sp = ctx.measureText(' ').width;
      let x = xr;
      for (const wd of ws) {
        const k = wordIdx++ / Math.max(1, totalWords);
        const q = clamp((st.wordFx.p - k * 0.5) / 0.5, 0, 1);
        const e2 = 1 - Math.pow(1 - q, 3);
        ctx.save();
        ctx.globalAlpha *= q;
        ctx.translate(0, (1 - e2) * px * 1.6 * (st.wordFx.type === 'drop' ? -1 : 1));
        paintStr(wd, x, y, tx.color);
        ctx.restore();
        x -= ctx.measureText(wd).width + sp;
      }
      return;
    }
    const paint = (color) => paintStr(str, xr, y, color);
    function paintStr(str, xr, y, color) {
      if (tx.shadow && !st.glow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.06; paintRaw(str, xr, y, color); ctx.restore(); }
      else paintRaw(str, xr, y, color);
    }
    function paintRaw(str, xr, y, color) {
      if (tx.stroke && tx.stroke.width > 0) {
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = tx.stroke.width * px * 0.16;
        ctx.strokeStyle = tx.stroke.color;
        ctx.strokeText(str, xr, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, xr, y);
    }
    paint(tx.color);
    if (kp && kp[i] > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(xr - w * kp[i], y - lh / 2, w * kp[i] + px * 0.3, lh);
      ctx.clip();
      paintRaw(str, xr, y, tx.kcolor || '#ffd400');
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
