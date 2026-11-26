// الانتقالات بين مقطعين: a هو المقطع الخارج، b الداخل، p من 0 إلى 1.
export const TRANSITIONS = {
  none: 'بلا',
  fade: 'تلاشٍ',
  black: 'عبر الأسود',
  flash: 'وميض',
  slideL: 'انزلاق يسار',
  slideR: 'انزلاق يمين',
  slideU: 'انزلاق أعلى',
  push: 'دفع',
  zoomIn: 'تكبير',
  zoomOut: 'تصغير',
  spin: 'دوران',
  blur: 'تمويه',
  wipe: 'مسح',
  circle: 'دائرة',
  glitch: 'تشويش',
};

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function drawTransition(ctx, a, b, p, type, W, H) {
  const e = ease(Math.min(1, Math.max(0, p)));
  ctx.save();
  switch (type) {
    case 'black':
    case 'flash': {
      const col = type === 'black' ? '#000' : '#fff';
      if (p < 0.5) { ctx.drawImage(a, 0, 0); ctx.globalAlpha = p * 2; } else { ctx.drawImage(b, 0, 0); ctx.globalAlpha = (1 - p) * 2; }
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'slideL': case 'slideR': case 'slideU': {
      ctx.drawImage(a, 0, 0);
      const dx = type === 'slideL' ? W * (1 - e) : type === 'slideR' ? -W * (1 - e) : 0;
      const dy = type === 'slideU' ? H * (1 - e) : 0;
      ctx.drawImage(b, dx, dy);
      break;
    }
    case 'push': {
      ctx.drawImage(a, -W * e, 0);
      ctx.drawImage(b, W * (1 - e), 0);
      break;
    }
    case 'zoomIn': {
      const s = 1 + e * 0.6;
      ctx.save(); ctx.globalAlpha = 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(a, -W / 2, -H / 2); ctx.restore();
      ctx.globalAlpha = e; ctx.drawImage(b, 0, 0);
      break;
    }
    case 'zoomOut': {
      ctx.drawImage(a, 0, 0);
      const s = 1.6 - 0.6 * e;
      ctx.globalAlpha = e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(b, -W / 2, -H / 2);
      break;
    }
    case 'spin': {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const img = p < 0.5 ? a : b;
      const k = p < 0.5 ? 1 - e * 2 * 0.9 : 0.1 + (e - 0.5) * 2 * 0.9;
      ctx.translate(W / 2, H / 2); ctx.rotate(e * Math.PI * 2); ctx.scale(Math.max(0.05, k), Math.max(0.05, k));
      ctx.drawImage(img, -W / 2, -H / 2);
      break;
    }
    case 'blur': {
      const r = Math.sin(p * Math.PI) * Math.max(W, H) * 0.02;
      ctx.filter = `blur(${r.toFixed(1)}px)`;
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = e;
      ctx.drawImage(b, 0, 0);
      break;
    }
    case 'wipe': { // من اليمين إلى اليسار
      ctx.drawImage(a, 0, 0);
      ctx.beginPath(); ctx.rect(W * (1 - e), 0, W * e + 1, H); ctx.clip();
      ctx.drawImage(b, 0, 0);
      break;
    }
    case 'circle': {
      ctx.drawImage(a, 0, 0);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(b, 0, 0);
      break;
    }
    case 'glitch': {
      const img = p < 0.5 ? a : b;
      ctx.drawImage(img, 0, 0);
      const n = 8, amp = Math.sin(p * Math.PI) * W * 0.08;
      for (let i = 0; i < n; i++) {
        const y = ((i * 97 + Math.floor(p * 20) * 31) % n) * (H / n);
        const off = (((i * 53 + Math.floor(p * 30) * 17) % 7) - 3) / 3 * amp;
        ctx.drawImage(img, 0, y, W, H / n, off, y, W, H / n);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.25;
      ctx.drawImage(p < 0.5 ? b : a, amp * 0.3, 0);
      break;
    }
    default: { // fade
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(b, 0, 0);
    }
  }
  ctx.restore();
}
