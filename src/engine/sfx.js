// مكتبة المؤثرات الصوتية المدمجة: تُولَّد داخل البرنامج (بلا ملفات ولا حقوق)، فتعمل بلا إنترنت.
const SR = 44100;

export const SFX = [
  { id: 'laugh', label: 'ضحك', emoji: '😂', dur: 2.2 },
  { id: 'applause', label: 'تصفيق', emoji: '👏', dur: 3 },
  { id: 'rimshot', label: 'طبل نكتة', emoji: '🥁', dur: 1.4 },
  { id: 'drumroll', label: 'دحرجة طبل', emoji: '🪘', dur: 2.5 },
  { id: 'whoosh', label: 'ووووش', emoji: '💨', dur: 0.8 },
  { id: 'boing', label: 'بوينغ', emoji: '🌀', dur: 0.9 },
  { id: 'pop', label: 'فقعة', emoji: '🫧', dur: 0.25 },
  { id: 'ding', label: 'دينغ', emoji: '🔔', dur: 1.6 },
  { id: 'buzzer', label: 'خطأ', emoji: '❌', dur: 0.9 },
  { id: 'magic', label: 'سحر', emoji: '✨', dur: 1.3 },
  { id: 'boom', label: 'انفجار', emoji: '💥', dur: 1.8 },
  { id: 'fall', label: 'سقوط', emoji: '📉', dur: 1.2 },
  { id: 'crickets', label: 'صمت محرج', emoji: '🦗', dur: 2.5 },
  { id: 'tick', label: 'تيك تاك', emoji: '⏰', dur: 2 },
  { id: 'camera', label: 'كاميرا', emoji: '📸', dur: 0.5 },
  { id: 'heart', label: 'نبض', emoji: '💓', dur: 1.6 },
];

function noiseBuffer(ctx, dur) {
  const b = ctx.createBuffer(1, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
  return b;
}

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function osc(ctx, type, f, t, dur, peak, out, a = 0.005) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  o.connect(g); g.connect(out); env(g, t, a, peak, dur);
  o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}

function noise(ctx, t, dur, peak, out, { type = 'bandpass', f = 1000, q = 1, a = 0.005 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, dur + a + 0.05);
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain();
  s.connect(fl); fl.connect(g); g.connect(out); env(g, t, a, peak, dur);
  s.start(t);
  return { s, fl, g };
}

const builders = {
  laugh(ctx, out) {
    // «ها ها ها» بتشكيل صوتي بسيط: نغمة حنجرية تمر عبر مرشحين للحروف المتحركة
    for (let i = 0; i < 7; i++) {
      const t = 0.05 + i * 0.27 + (i % 2) * 0.02;
      const f0 = 260 - i * 12 + (i % 3) * 18;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 1.1, t); o.frequency.linearRampToValueAtTime(f0 * 0.85, t + 0.18);
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 6;
      const g = ctx.createGain();
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out);
      env(g, t, 0.02, 0.9, 0.17);
      o.start(t); o.stop(t + 0.25);
      noise(ctx, t, 0.05, 0.25, out, { f: 2500, q: 1 }); // الهاء
    }
  },
  applause(ctx, out) {
    for (let i = 0; i < 160; i++) {
      const t = Math.random() * 2.6;
      noise(ctx, t, 0.02 + Math.random() * 0.03, 0.12 + Math.random() * 0.15, out, { f: 1200 + Math.random() * 2000, q: 0.8 });
    }
  },
  rimshot(ctx, out) {
    const kick = (t) => { const o = osc(ctx, 'sine', 150, t, 0.25, 1, out); o.frequency.exponentialRampToValueAtTime(45, t + 0.2); };
    const snare = (t) => { noise(ctx, t, 0.18, 0.6, out, { type: 'highpass', f: 1500 }); osc(ctx, 'triangle', 200, t, 0.1, 0.4, out); };
    snare(0.05); kick(0.3); snare(0.3);
    noise(ctx, 0.6, 0.8, 0.35, out, { type: 'highpass', f: 6000 }); // صنج
  },
  drumroll(ctx, out) {
    for (let i = 0; i < 44; i++) { const t = i * 0.045; noise(ctx, t, 0.05, 0.15 + (i / 44) * 0.35, out, { type: 'highpass', f: 1200 }); }
    noise(ctx, 2.0, 0.5, 0.6, out, { type: 'highpass', f: 5000 });
    const o = osc(ctx, 'sine', 120, 2.0, 0.3, 0.8, out); o.frequency.exponentialRampToValueAtTime(40, 2.25);
  },
  whoosh(ctx, out) {
    const n = noise(ctx, 0.0, 0.7, 0.8, out, { f: 300, q: 3, a: 0.25 });
    n.fl.frequency.setValueAtTime(300, 0); n.fl.frequency.exponentialRampToValueAtTime(4000, 0.4); n.fl.frequency.exponentialRampToValueAtTime(800, 0.75);
  },
  boing(ctx, out) {
    const o = osc(ctx, 'sine', 180, 0, 0.85, 0.8, out);
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 18; lg.gain.setValueAtTime(90, 0); lg.gain.exponentialRampToValueAtTime(5, 0.85);
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(0); lfo.stop(0.9);
    o.frequency.setValueAtTime(180, 0); o.frequency.exponentialRampToValueAtTime(320, 0.8);
  },
  pop(ctx, out) { const o = osc(ctx, 'sine', 900, 0, 0.12, 0.9, out, 0.002); o.frequency.exponentialRampToValueAtTime(200, 0.1); },
  ding(ctx, out) { osc(ctx, 'sine', 1318, 0, 1.5, 0.6, out); osc(ctx, 'sine', 2636, 0, 0.8, 0.2, out); osc(ctx, 'sine', 3950, 0, 0.4, 0.08, out); },
  buzzer(ctx, out) { osc(ctx, 'square', 110, 0, 0.8, 0.35, out, 0.01); osc(ctx, 'sawtooth', 116, 0, 0.8, 0.25, out, 0.01); },
  magic(ctx, out) { [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => osc(ctx, 'triangle', f, i * 0.08, 0.6, 0.3, out)); noise(ctx, 0, 1.1, 0.12, out, { type: 'highpass', f: 7000, a: 0.3 }); },
  boom(ctx, out) {
    const o = osc(ctx, 'sine', 90, 0, 1.6, 1, out, 0.003); o.frequency.exponentialRampToValueAtTime(30, 1.2);
    noise(ctx, 0, 1.5, 0.9, out, { type: 'lowpass', f: 900, q: 0.5, a: 0.003 });
  },
  fall(ctx, out) { const o = osc(ctx, 'sine', 1400, 0, 1.1, 0.5, out, 0.02); o.frequency.exponentialRampToValueAtTime(180, 1.1); },
  crickets(ctx, out) {
    for (let k = 0; k < 6; k++) { const t = 0.1 + k * 0.4; for (let j = 0; j < 4; j++) osc(ctx, 'sine', 4300, t + j * 0.035, 0.025, 0.25, out, 0.003); }
  },
  tick(ctx, out) { for (let i = 0; i < 4; i++) { osc(ctx, 'square', i % 2 ? 1800 : 2400, i * 0.5, 0.03, 0.4, out, 0.001); } },
  camera(ctx, out) { noise(ctx, 0, 0.06, 0.8, out, { type: 'highpass', f: 2000 }); noise(ctx, 0.12, 0.1, 0.6, out, { type: 'bandpass', f: 1500 }); },
  heart(ctx, out) { for (const t of [0.05, 0.3, 0.85, 1.1]) { const o = osc(ctx, 'sine', 70, t, 0.15, 1, out, 0.005); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); } },
};

export async function renderSfx(id) {
  const meta = SFX.find((s) => s.id === id);
  if (!meta) throw new Error('صوت غير معروف');
  const ctx = new OfflineAudioContext(1, Math.ceil(meta.dur * SR), SR);
  const comp = ctx.createDynamicsCompressor();
  const master = ctx.createGain(); master.gain.value = 0.9;
  comp.connect(master); master.connect(ctx.destination);
  builders[id](ctx, comp);
  return ctx.startRendering();
}
