// أداة القص بالسحب: مقبضان (البداية والنهاية) فوق شريط صور أو شكل موجي.
// الزمن من اليمين إلى اليسار. مقابض كبيرة تناسب اللمس.
import { h } from './dom.js';

export function trimmer({ duration, a, b, images = null, peaksDraw = null, cut = null, playhead = null, onInput, onEnd, minGap = 0.1 }) {
  const el = h('div.trimmer');
  const strip = h('div.strip');
  if (images) for (const src of images) strip.append(h('img', { src, alt: '', draggable: false }));
  if (peaksDraw) { const cv = h('canvas', { style: { width: '100%', height: '100%' } }); strip.append(cv); requestAnimationFrame(() => peaksDraw(cv)); }
  const shR = h('div.shade'), shL = h('div.shade');
  const win = h('div.win' + (cut ? '.cut' : ''));
  const hA = h('div.h' + (cut ? '.cut' : ''), { role: 'slider', 'aria-label': 'البداية', tabindex: 0 });
  const hB = h('div.h' + (cut ? '.cut' : ''), { role: 'slider', 'aria-label': 'النهاية', tabindex: 0 });
  const ph = h('div.ph');
  el.append(strip, shR, shL, win, ph, hA, hB);
  const st = { a, b };
  const pos = (t) => (t / duration) * 100; // نسبة من اليمين
  const paint = () => {
    shR.style.right = '0'; shR.style.width = pos(st.a) + '%';
    shL.style.left = '0'; shL.style.width = 100 - pos(st.b) + '%';
    win.style.right = pos(st.a) + '%'; win.style.width = pos(st.b - st.a) + '%';
    hA.style.left = 100 - pos(st.a) + '%';
    hB.style.left = 100 - pos(st.b) + '%';
  };
  paint();
  const drag = (which) => (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const handle = which === 'a' ? hA : hB;
    handle.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      let t = ((r.right - ev.clientX) / r.width) * duration;
      if (which === 'a') st.a = Math.max(0, Math.min(t, st.b - minGap));
      else st.b = Math.min(duration, Math.max(t, st.a + minGap));
      paint();
      onInput?.(st.a, st.b, which);
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); onEnd?.(st.a, st.b, which); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  hA.addEventListener('pointerdown', drag('a'));
  hB.addEventListener('pointerdown', drag('b'));
  const key = (which) => (e) => {
    const d = e.key === 'ArrowLeft' ? 0.1 : e.key === 'ArrowRight' ? -0.1 : 0;
    if (!d) return;
    if (which === 'a') st.a = Math.max(0, Math.min(st.a + d, st.b - minGap)); else st.b = Math.min(duration, Math.max(st.b + d, st.a + minGap));
    paint(); onInput?.(st.a, st.b, which); onEnd?.(st.a, st.b, which);
  };
  hA.addEventListener('keydown', key('a'));
  hB.addEventListener('keydown', key('b'));
  el.set = (na, nb) => { st.a = na; st.b = nb; paint(); };
  el.setPlayhead = (t) => { if (t == null) ph.style.display = 'none'; else { ph.style.display = ''; ph.style.left = 100 - pos(t) + '%'; } };
  el.setPlayhead(playhead);
  el.state = st;
  return el;
}
