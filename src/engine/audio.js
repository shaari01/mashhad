// محرك الصوت: فك ترميز الأصوات، وجدولة المزج في AudioContext (المعاينة)
// أو OfflineAudioContext (التصدير) بنفس الكود حتى يتطابق ما تسمعه مع الناتج.
import { buildAudioPlan, energyRegions, mergeRegions } from './audioplan.js';

export const SAMPLE_RATE = 48000;

export async function decodeAudio(blob) {
  const ab = await blob.arrayBuffer();
  try {
    const ctx = new OfflineAudioContext(2, 1, SAMPLE_RATE);
    return await ctx.decodeAudioData(ab);
  } catch (e) {
    // احتياط: فك عبر mediabunny (يدعم صيغًا أكثر داخل الحاويات)
    try {
      const mb = await import('mediabunny');
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
      const track = await input.getPrimaryAudioTrack();
      if (!track || !(await track.canDecode())) return null;
      const sink = new mb.AudioBufferSink(track);
      const parts = [];
      let len = 0, ch = 1, sr = SAMPLE_RATE;
      for await (const { buffer } of sink.buffers()) {
        parts.push(buffer); len += buffer.length; ch = Math.max(ch, buffer.numberOfChannels); sr = buffer.sampleRate;
      }
      if (!len) return null;
      const out = new AudioBuffer({ length: len, numberOfChannels: Math.min(2, ch), sampleRate: sr });
      let off = 0;
      for (const b of parts) {
        for (let c = 0; c < out.numberOfChannels; c++) out.getChannelData(c).set(b.getChannelData(Math.min(c, b.numberOfChannels - 1)), off);
        off += b.length;
      }
      return out;
    } catch (e2) {
      return null;
    }
  }
}

// قمم الشكل الموجي
export function computePeaks(buffer, count = 400) {
  const d = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / count));
  const peaks = new Float32Array(Math.ceil(d.length / step));
  for (let i = 0, k = 0; i < d.length; i += step, k++) {
    let m = 0;
    const end = Math.min(d.length, i + step);
    for (let j = i; j < end; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; }
    peaks[k] = m;
  }
  return Array.from(peaks, (v) => Math.round(v * 1000) / 1000);
}

const revCache = new WeakMap();
function reversed(buffer) {
  if (revCache.has(buffer)) return revCache.get(buffer);
  const out = new AudioBuffer({ length: buffer.length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  revCache.set(buffer, out);
  return out;
}

const duckCache = new Map();
// مناطق الكلام في المشروع (لخفض الموسيقى تلقائيًا)
export function speechRegions(plan, buffers) {
  const all = [];
  for (const s of plan.segs) {
    if (!(s.kind === 'clip' || s.kind === 'voice' || s.kind === 'detached')) continue;
    const b = buffers.get(s.mediaId);
    if (!b) continue;
    const key = `${s.key}|${s.offset}|${s.srcDur}|${s.when}|${s.rate}|${s.reverse}`;
    let r = duckCache.get(key);
    if (!r) {
      const ch = b.getChannelData(0);
      const a = Math.floor(s.offset * b.sampleRate), e = Math.min(ch.length, Math.floor((s.offset + s.srcDur) * b.sampleRate));
      const slice = ch.subarray(a, e);
      r = energyRegions(s.reverse ? slice.slice().reverse() : slice, b.sampleRate, s.when, s.rate || 1);
      duckCache.set(key, r);
    }
    all.push(...r);
  }
  return mergeRegions(all, 0.6, 0.3);
}

// جدولة كل القطع. from: زمن البداية على الخط الزمني. base: زمن السياق المقابل لـ from.
export function scheduleMix(ctx, project, buffers, { from = 0, base = ctx.currentTime, destination = ctx.destination, total = null } = {}) {
  const plan = buildAudioPlan(project, total);
  const nodes = [];
  const master = ctx.createGain();
  master.connect(destination);
  const duck = project.duck?.enabled ? speechRegions(plan, buffers) : [];
  const toCtx = (x) => base + (x - from);

  for (const s of plan.segs) {
    let buf = buffers.get(s.mediaId);
    if (!buf) continue;
    const end = s.when + s.dur;
    if (end <= from + 0.01) continue;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.connect(g);
    let out = g;
    // الموضع داخل المصدر
    let srcPos = s.offset;
    if (s.reverse) {
      buf = reversed(buf);
      srcPos = buf.duration - (s.offset + s.srcDur);
    }
    src.buffer = buf;
    const skip = Math.max(0, from - s.when); // كم فاتنا من القطعة (بزمن الإخراج)
    const startAt = toCtx(Math.max(s.when, from));
    let srcSkip;
    if (s.rateCurve) {
      const n = s.rateCurve.length;
      const dt = s.dur / (n - 1);
      let acc = 0;
      for (let i = 0; i < n - 1 && (i + 1) * dt <= skip + 1e-9; i++) acc += ((s.rateCurve[i] + s.rateCurve[i + 1]) / 2) * dt;
      srcSkip = acc;
      const i0 = Math.min(n - 1, Math.floor(skip / dt));
      const rest = s.rateCurve.slice(i0);
      if (rest.length >= 2) src.playbackRate.setValueCurveAtTime(rest, startAt, Math.max(0.01, s.dur - i0 * dt));
      else src.playbackRate.value = s.rateCurve[n - 1];
    } else {
      src.playbackRate.value = s.rate || 1;
      srcSkip = skip * (s.rate || 1);
    }
    // التلاشي ومستوى الصوت
    const gain = s.gain;
    const fi = s.fadeIn || 0, fo = s.fadeOut || 0;
    const valAt = (x) => {
      let v = gain;
      if (fi > 0 && x < s.when + fi) v *= Math.max(0, (x - s.when) / fi);
      if (fo > 0 && x > end - fo) v *= Math.max(0, (end - x) / fo);
      return v;
    };
    const x0 = Math.max(s.when, from);
    g.gain.setValueAtTime(valAt(x0), toCtx(x0));
    if (fi > 0 && x0 < s.when + fi) g.gain.linearRampToValueAtTime(gain, toCtx(s.when + fi));
    if (fo > 0) {
      const fs = Math.max(x0, end - fo);
      g.gain.setValueAtTime(valAt(fs), toCtx(fs));
      g.gain.linearRampToValueAtTime(0, toCtx(end));
    }
    // الخفض التلقائي للموسيقى عند الكلام
    if (s.duck && duck.length) {
      const dg = ctx.createGain();
      g.connect(dg);
      out = dg;
      const lvl = project.duck.level ?? 0.3, ramp = 0.2;
      dg.gain.setValueAtTime(1, toCtx(x0));
      for (const [a, b] of duck) {
        if (b < x0 || a > end) continue;
        const ra = Math.max(x0, a - ramp), rb = Math.max(x0, b);
        dg.gain.setValueAtTime(1, toCtx(ra));
        dg.gain.linearRampToValueAtTime(lvl, toCtx(Math.max(ra + 0.01, a)));
        dg.gain.setValueAtTime(lvl, toCtx(Math.max(ra + 0.02, rb)));
        dg.gain.linearRampToValueAtTime(1, toCtx(Math.max(ra + 0.03, rb + ramp)));
      }
    }
    out.connect(master);
    const remainingSrc = s.srcDur - srcSkip;
    if (remainingSrc <= 0.005) continue;
    try {
      src.start(startAt, Math.max(0, srcPos + srcSkip), remainingSrc);
      src.stop(toCtx(end) + 0.02);
    } catch (e) { continue; }
    nodes.push(src, g);
  }
  return {
    master,
    stop() {
      for (const n of nodes) { try { n.stop?.(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
      try { master.disconnect(); } catch (e) {}
    },
  };
}

// مزج كامل للتصدير
export async function renderMix(project, buffers, duration, sampleRate = SAMPLE_RATE) {
  const len = Math.max(1, Math.ceil(duration * sampleRate));
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  scheduleMix(ctx, project, buffers, { from: 0, base: 0, total: duration });
  return ctx.startRendering();
}

// ترميز WAV (لتصدير الصوت فقط عند تعذّر AAC)
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  return new Blob([out], { type: 'audio/wav' });
}
