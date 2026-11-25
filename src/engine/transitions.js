// الانتقالات بين مقطعين: a هو المقطع الخارج، b الداخل، p من 0 إلى 1.
export function drawTransition(ctx, a, b, p, type, W, H) {
  ctx.drawImage(a, 0, 0);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.drawImage(b, 0, 0);
  ctx.restore();
}
