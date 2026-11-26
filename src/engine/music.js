// موسيقى مدمجة للقوالب، تُولَّد داخل البرنامج (بلا حقوق ولا إنترنت). معروفة الإيقاع، فتُوضع علاماته تلقائيًا.
const SR = 44100;

export const MUSIC = {
  calm: { label: 'هادئة', bpm: 76 },
  fun: { label: 'مرحة سريعة', bpm: 124 },
  festive: { label: 'احتفالية (دُم تَك)', bpm: 108 },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function tone(ctx, out, { f, t, d, type = 'sine', vol = 0.2, a = 0.01, r = 0.2, detune = 0 }) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.connect(g); g.connect(out);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, d - r)); g.gain.linearRampToValueAtTime(0, t + d);
  o.start(t); o.stop(t + d + 0.02);
}

let noiseBuf = null;
function noise(ctx, out, { t, d, vol, f = 6000, type = 'highpass', q = 0.7 }) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const x = noiseBuf.getChannelData(0); let s = 7;
    for (let i = 0; i < x.length; i++) { s = (s * 16807) % 2147483647; x[i] = s / 1073741823.5 - 1; }
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain();
  src.connect(fl); fl.connect(g); g.connect(out);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
}

function kick(ctx, out, t, vol = 0.9) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
}

// درّبكة مبسطة: «دُم» عميقة و«تَك» حادة
function doum(ctx, out, t) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4); }
function tak(ctx, out, t, vol = 0.5) { noise(ctx, out, { t, d: 0.07, vol, f: 3500, type: 'bandpass', q: 2 }); tone(ctx, out, { f: 600, t, d: 0.05, type: 'triangle', vol: vol * 0.4, a: 0.001, r: 0.04 }); }

const PROG = { // تتابع الأوتار (أرقام MIDI للجذر)
  calm: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], // Am F C G
  fun: [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], // C G Am F
  festive: [[50, 'm'], [50, 'm'], [48, 'M'], [50, 'm']], // Dm Dm C Dm (طابع شرقي خفيف)
};
const chord = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

export async function renderMusic(style, seconds) {
  const meta = MUSIC[style] || MUSIC.calm;
  const dur = Math.max(4, Math.min(240, seconds));
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
  const master = ctx.createGain(); master.gain.value = 0.8;
  comp.connect(master); master.connect(ctx.destination);
  const beat = 60 / meta.bpm, bar = beat * 4;
  const prog = PROG[style] || PROG.calm;
  for (let b = 0, t = 0; t < dur; b++, t += bar) {
    const [root, q] = prog[b % prog.length];
    const notes = chord(root, q);
    if (style === 'calm') {
      for (const n of notes) tone(ctx, comp, { f: midi(n), t, d: bar, type: 'triangle', vol: 0.06, a: 0.6, r: 0.8, detune: 4 });
      tone(ctx, comp, { f: midi(root - 12), t, d: bar, type: 'sine', vol: 0.12, a: 0.3, r: 0.6 });
      const arp = [0, 1, 2, 1, 0, 2, 1, 2];
      arp.forEach((k, i) => tone(ctx, comp, { f: midi(notes[k] + 12), t: t + i * beat / 2, d: beat * 0.9, type: 'sine', vol: 0.07, a: 0.01, r: 0.5 }));
    } else if (style === 'fun') {
      for (let i = 0; i < 4; i++) {
        kick(ctx, comp, t + i * beat, 0.8);
        if (i % 2) noise(ctx, comp, { t: t + i * beat, d: 0.12, vol: 0.35, f: 1500, type: 'bandpass', q: 0.8 }); // تصفيقة
        noise(ctx, comp, { t: t + i * beat + beat / 2, d: 0.04, vol: 0.12 });
        tone(ctx, comp, { f: midi(root - 12), t: t + i * beat + beat / 2, d: beat / 2, type: 'square', vol: 0.06, a: 0.005, r: 0.1 });
      }
      const mel = [2, 1, 0, 1, 2, 2, 1, 0];
      mel.forEach((k, i) => tone(ctx, comp, { f: midi(notes[k] + 12), t: t + i * beat / 2, d: beat / 2.2, type: 'square', vol: 0.035, a: 0.005, r: 0.08 }));
    } else {
      // إيقاع «مقسوم» مبسط: دُم تَك - تَك دُم تَك -
      const pat = [['d', 0], ['t', 1], ['t', 1.5], ['d', 2], ['t', 3]];
      for (const [k, pos] of pat) (k === 'd' ? doum : tak)(ctx, comp, t + pos * beat);
      for (let i = 0; i < 8; i++) noise(ctx, comp, { t: t + i * beat / 2, d: 0.05, vol: 0.06 + (i % 2) * 0.04, f: 8000 }); // دف
      tone(ctx, comp, { f: midi(root - 12), t, d: bar, type: 'sawtooth', vol: 0.03, a: 0.2, r: 0.5 });
      const scale = [0, 1, 4, 5, 7, 8, 10, 12]; // حجاز تقريبي
      [0, 2, 3, 4, 3, 2, 1, 0].forEach((k, i) => tone(ctx, comp, { f: midi(root + 12 + scale[(k + b) % scale.length]), t: t + i * beat / 2, d: beat / 2.1, type: 'triangle', vol: 0.06, a: 0.01, r: 0.1 }));
    }
  }
  // تلاشٍ في النهاية
  master.gain.setValueAtTime(0.8, Math.max(0, dur - 2));
  master.gain.linearRampToValueAtTime(0, dur);
  const buffer = await ctx.startRendering();
  const beats = [];
  for (let t = 0; t < dur - 0.01; t += beat) beats.push(Math.round(t * 1000) / 1000);
  return { buffer, beats, bpm: meta.bpm };
}
