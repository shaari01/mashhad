// خطة الصوت: تحويل المشروع إلى قطع صوتية مجدولة على الخط الزمني (دالة صافية).
import { layout, srcLength, speedAt, clipDuration } from '../core/timeline.js';

export function audioItemDuration(a) {
  return Math.max(0, (a.out ?? 0) - (a.in ?? 0)) / (a.speed || 1);
}

// كل قطعة: {key, mediaId, when, offset, srcDur, dur, rate|rateCurve, reverse, gain, fadeIn, fadeOut, kind}
export function buildAudioPlan(project, total = null) {
  const lay = layout(project);
  const T = total ?? lay.duration;
  const segs = [];
  for (const it of lay.items) {
    const c = it.clip;
    if (c.type !== 'video' || c.muted || c.volume <= 0) continue;
    const L = srcLength(c);
    if (L <= 0) continue;
    const seg = {
      key: 'clip:' + c.id,
      mediaId: c.mediaId,
      kind: c.audioDetached ? 'detached' : 'clip',
      when: it.start,
      offset: c.in,
      srcDur: L,
      dur: it.dur,
      reverse: !!c.reverse,
      gain: c.volume,
      fadeIn: it.transIn,
      fadeOut: it.transOut,
      rate: null,
      rateCurve: null,
    };
    if (!c.curve || c.curve === 'none') seg.rate = c.speed || 1;
    else {
      const n = 32, D = clipDuration(c), arr = new Float32Array(n);
      for (let i = 0; i < n; i++) arr[i] = speedAt(c, (i / (n - 1)) * D);
      seg.rateCurve = arr;
    }
    segs.push(seg);
  }
  for (const a of project.audio || []) {
    const d = audioItemDuration(a);
    if (d <= 0 || a.muted) continue;
    const when = a.start || 0;
    if (when >= T) continue;
    const dur = Math.min(d, T - when);
    segs.push({
      key: 'aud:' + a.id,
      mediaId: a.mediaId,
      kind: a.kind || 'music',
      when,
      offset: a.in || 0,
      srcDur: dur * (a.speed || 1),
      dur,
      reverse: false,
      gain: a.volume ?? 1,
      fadeIn: a.fadeIn || 0,
      fadeOut: Math.min(a.fadeOut || 0, dur),
      rate: a.speed || 1,
      rateCurve: null,
      duck: a.kind === 'music',
    });
  }
  return { segs, duration: T };
}

// دمج مناطق الكلام المتقاربة
export function mergeRegions(regions, gap = 0.4, minLen = 0.25) {
  const r = [...regions].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const x of r) {
    const last = out[out.length - 1];
    if (last && x[0] - last[1] <= gap) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out.filter((x) => x[1] - x[0] >= minLen);
}

// مناطق فيها طاقة صوتية (كلام) من بيانات قناة مع زمن بدايتها على الخط الزمني
export function energyRegions(channel, sampleRate, when, rate = 1, threshold = 0.025, win = 0.05) {
  const step = Math.max(1, Math.floor(sampleRate * win));
  const regions = [];
  for (let i = 0; i < channel.length; i += step) {
    let sum = 0;
    const end = Math.min(channel.length, i + step);
    for (let j = i; j < end; j++) sum += channel[j] * channel[j];
    const rms = Math.sqrt(sum / (end - i));
    if (rms > threshold) {
      const t0 = when + i / sampleRate / rate;
      regions.push([t0, t0 + step / sampleRate / rate]);
    }
  }
  return mergeRegions(regions);
}
