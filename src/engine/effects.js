// الفلاتر، والتعديل البسيط (سطوع وتباين وتشبع وحرارة)، والمؤثرات المرئية، والإطارات الزخرفية.
// كلها عبر Canvas 2D (مرشحات CSS) فتعمل على الجوال دون WebGL.
import { clamp } from '../core/timeline.js';

export const FILTERS = {
  none: { label: 'الأصل', css: '' },
  vivid: { label: 'حيوي', css: 'saturate(1.45) contrast(1.08)' },
  warm: { label: 'دافئ', css: 'sepia(0.25) saturate(1.2) hue-rotate(-8deg)' },
  cool: { label: 'بارد', css: 'saturate(1.05) hue-rotate(12deg) brightness(1.03)', tint: ['#2a6cff', 0.08] },
  bw: { label: 'أبيض وأسود', css: 'grayscale(1) contrast(1.12)' },
  sepia: { label: 'بني قديم', css: 'sepia(0.85) contrast(1.05)' },
  vintage: { label: 'عتيق', css: 'sepia(0.35) saturate(0.8) contrast(0.92) brightness(1.06)', tint: ['#ffb070', 0.1] },
  fade: { label: 'باهت', css: 'saturate(0.7) contrast(0.82) brightness(1.1)' },
  drama: { label: 'درامي', css: 'contrast(1.35) saturate(1.15) brightness(0.92)' },
  cinema: { label: 'سينمائي', css: 'contrast(1.15) saturate(0.9)', tint: ['#0a7a8a', 0.12] },
  pink: { label: 'وردي', css: 'saturate(1.15)', tint: ['#ff5fa2', 0.12] },
  night: { label: 'ليلي', css: 'brightness(0.8) saturate(0.8) hue-rotate(20deg)', tint: ['#1a237e', 0.18] },
  gold: { label: 'ذهبي', css: 'sepia(0.4) saturate(1.4) brightness(1.05)', tint: ['#ffcc33', 0.08] },
};

export const EFFECTS = {
  shake: 'اهتزاز',
  punch: 'تكبير مفاجئ',
  blur: 'تمويه',
  glow: 'توهج',
  oldfilm: 'فيلم قديم',
  flash: 'وميض',
  rgb: 'تشويش ألوان',
  bw: 'أبيض وأسود',
};

export const FRAMES = {
  none: 'بلا',
  white: 'حد أبيض',
  polaroid: 'بولارويد',
  cinema: 'شريط سينمائي',
  gold: 'ذهبي مزدوج',
  rounded: 'زوايا مستديرة',
  film: 'شريط فيلم',
  hearts: 'قلوب',
  ornament: 'زخرفة إسلامية',
  vignette: 'تعتيم الأطراف',
};

function adjustCss(a) {
  if (!a) return '';
  const parts = [];
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness * 0.6).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast * 0.6).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${Math.max(0, 1 + a.saturation).toFixed(3)})`);
  return parts.join(' ');
}

// المؤثرات النشطة في زمن محلي
function activeEffects(clip, local) {
  return (clip.effects || []).filter((e) => local >= (e.start ?? 0) && local < (e.end ?? Infinity));
}

export function clipFilter(clip, project, local, dur) {
  const f = FILTERS[clip.filter] || FILTERS.none;
  const parts = [f.css, adjustCss(clip.adjust)];
  for (const e of activeEffects(clip, local)) {
    if (e.type === 'blur') parts.push('blur(6px)');
    if (e.type === 'oldfilm') parts.push('sepia(0.8) contrast(1.1)');
    if (e.type === 'bw') parts.push('grayscale(1)');
  }
  const s = parts.filter(Boolean).join(' ');
  return s || 'none';
}

const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export function effectTransform(clip, local) {
  const r = { s: 1, dx: 0, dy: 0, rot: 0 };
  for (const e of activeEffects(clip, local)) {
    const el = local - (e.start ?? 0);
    if (e.type === 'shake') {
      const k = Math.floor(el * 30);
      r.dx += (hash(k) - 0.5) * 0.04; r.dy += (hash(k + 99) - 0.5) * 0.04; r.rot += (hash(k + 7) - 0.5) * 0.03;
      r.s *= 1.06;
    }
    if (e.type === 'punch') {
      const a = Math.min(1, el / 0.08);
      r.s *= 1 + 0.45 * a;
    }
  }
  return r;
}

export function drawClipEffects(ctx, W, H, clip, local) {
  const f = FILTERS[clip.filter];
  // الحرارة: طبقة لون دافئ أو بارد
  const temp = clip.adjust?.temperature || 0;
  if (temp) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = Math.min(0.6, Math.abs(temp) * 0.6);
    ctx.fillStyle = temp > 0 ? '#ff8a00' : '#0066ff'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  if (f?.tint) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = f.tint[1] * 2;
    ctx.fillStyle = f.tint[0]; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  for (const e of activeEffects(clip, local)) {
    const el = local - (e.start ?? 0);
    if (e.type === 'glow') {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55;
      ctx.filter = `blur(${Math.round(Math.min(W, H) / 40)}px) brightness(1.3)`;
      ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, W, H);
      ctx.restore();
    }
    if (e.type === 'flash') {
      const a = Math.max(0, 1 - el / 0.35);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
    if (e.type === 'rgb') {
      const k = Math.floor(el * 20), off = (hash(k) - 0.5) * W * 0.03;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
      ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, off, 0, W, H);
      ctx.restore();
    }
    if (e.type === 'oldfilm') {
      const k = Math.floor(el * 24);
      ctx.save();
      // حبيبات
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 120; i++) { ctx.fillStyle = hash(k * 131 + i) > 0.5 ? '#fff' : '#000'; ctx.fillRect(hash(k * 7 + i) * W, hash(k * 13 + i * 3) * H, 2, 2); }
      // خدوش
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) { if (hash(k + i * 50) > 0.6) { const x = hash(k * 3 + i) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (hash(k + i) - 0.5) * 20, H); ctx.stroke(); } }
      // تعتيم الأطراف
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // ارتعاش الإضاءة
      ctx.globalAlpha = hash(k) * 0.12; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

// الإطار الزخرفي فوق الفيديو كله
export function drawGlobalEffects(ctx, W, H, project) {
  const fr = project.frame;
  if (!fr || fr === 'none') return;
  const S = Math.min(W, H);
  ctx.save();
  switch (fr) {
    case 'white': ctx.lineWidth = S * 0.06; ctx.strokeStyle = '#fff'; ctx.strokeRect(0, 0, W, H); break;
    case 'polaroid': {
      const b = S * 0.05;
      ctx.fillStyle = '#f7f5ef';
      ctx.fillRect(0, 0, W, b); ctx.fillRect(0, 0, b, H); ctx.fillRect(W - b, 0, b, H); ctx.fillRect(0, H - b * 3.2, W, b * 3.2);
      break;
    }
    case 'cinema': { const b = H * 0.1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); break; }
    case 'gold': {
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = S * 0.018; ctx.strokeRect(S * 0.03, S * 0.03, W - S * 0.06, H - S * 0.06);
      ctx.lineWidth = S * 0.006; ctx.strokeRect(S * 0.055, S * 0.055, W - S * 0.11, H - S * 0.11);
      break;
    }
    case 'rounded': {
      const r = S * 0.08;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.roundRect(S * 0.02, S * 0.02, W - S * 0.04, H - S * 0.04, r); ctx.fill('evenodd');
      break;
    }
    case 'film': {
      const b = S * 0.07; ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, b, H); ctx.fillRect(W - b, 0, b, H);
      ctx.fillStyle = '#eee';
      for (let y = b * 0.3; y < H; y += b * 0.8) { ctx.fillRect(b * 0.3, y, b * 0.4, b * 0.45); ctx.fillRect(W - b * 0.7, y, b * 0.4, b * 0.45); }
      break;
    }
    case 'hearts': {
      ctx.font = `${S * 0.09}px "Noto Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [x, y] of [[0.08, 0.06], [0.92, 0.06], [0.08, 0.94], [0.92, 0.94], [0.5, 0.04]]) ctx.fillText('💖', x * W, y * H);
      ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = S * 0.012; ctx.setLineDash([S * 0.03, S * 0.02]); ctx.strokeRect(S * 0.03, S * 0.03, W - S * 0.06, H - S * 0.06);
      break;
    }
    case 'ornament': {
      // نجمة ثمانية في الزوايا مع حد مزدوج
      ctx.strokeStyle = '#e8c872'; ctx.fillStyle = '#e8c872';
      ctx.lineWidth = S * 0.008; ctx.strokeRect(S * 0.035, S * 0.035, W - S * 0.07, H - S * 0.07);
      const star = (cx, cy, r) => {
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * 0.62 : r; const a = (i / 16) * Math.PI * 2; i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + rr, cy); }
        ctx.closePath(); ctx.fill();
        ctx.save(); ctx.fillStyle = '#0c3b2e'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      };
      const r = S * 0.055;
      for (const [x, y] of [[S * 0.035, S * 0.035], [W - S * 0.035, S * 0.035], [S * 0.035, H - S * 0.035], [W - S * 0.035, H - S * 0.035]]) star(x, y, r);
      break;
    }
    case 'vignette': {
      const g = ctx.createRadialGradient(W / 2, H / 2, S * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      break;
    }
  }
  ctx.restore();
}

// توحيد الألوان تلقائيًا: يحسب سطوع وتشبع كل مقطع من صورته المصغرة، ويقرّبها من المتوسط
export function matchAdjust(stats) {
  const n = stats.length;
  if (!n) return [];
  const mb = stats.reduce((a, s) => a + s.luma, 0) / n;
  const ms = stats.reduce((a, s) => a + s.sat, 0) / n;
  return stats.map((s) => ({
    brightness: clamp((mb - s.luma) / Math.max(0.05, s.luma) / 0.6 * 0.8, -0.6, 0.6),
    saturation: clamp((ms - s.sat) / Math.max(0.05, s.sat) * 0.8, -0.6, 0.6),
  }));
}
