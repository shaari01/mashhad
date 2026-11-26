// التصدير إلى MP4 داخل المتصفح: فك ترميز المقاطع بـ WebCodecs (عبر mediabunny)،
// ثم الرسم إطارًا إطارًا بنفس مركِّب المعاينة، ثم الترميز والتغليف في MP4.
import { layout, activeAt, sourceTime } from '../core/timeline.js';
import { drawFrame, outputSize } from './render.js';
import { renderMix, encodeWav, SAMPLE_RATE } from './audio.js';
import * as lib from '../media/library.js';
import { overlayFrameSpecs } from './overlays.js';
import { ensureProjectFonts } from '../fonts.js';

let mbp = null;
const mb = () => (mbp ||= import('mediabunny'));

class VideoFrames {
  constructor(file, maxLong) { this.file = file; this.maxLong = maxLong; }
  async init() {
    const m = await mb();
    this.input = new m.Input({ formats: m.ALL_FORMATS, source: new m.BlobSource(this.file) });
    this.track = await this.input.getPrimaryVideoTrack();
    if (!this.track) throw new Error('لا يوجد مسار فيديو في الملف');
    if (!(await this.track.canDecode())) throw new Error('هذا الجهاز لا يستطيع فك ترميز الفيديو (' + (this.track.codec || '?') + ')');
    const dw = this.track.displayWidth, dh = this.track.displayHeight;
    const s = Math.min(1, this.maxLong / Math.max(dw, dh));
    this.sink = new m.CanvasSink(this.track, { width: Math.max(2, Math.round(dw * s)), height: Math.max(2, Math.round(dh * s)), fit: 'fill', poolSize: 4 });
    this.cur = null; this.next = null; this.iter = null;
    return this;
  }
  async reset(t) {
    if (this.iter) { try { await this.iter.return(); } catch (e) {} }
    this.iter = this.sink.canvases(Math.max(0, t));
    this.cur = (await this.iter.next()).value || null;
    this.next = this.cur ? (await this.iter.next()).value || null : null;
  }
  // الإطار المعروض عند الزمن t (قراءة متتابعة سريعة، أو قفز عند الحاجة)
  async frameAt(t) {
    const eps = 1e-4;
    if (!this.iter || !this.cur || t < this.cur.timestamp - 0.02 || t > this.cur.timestamp + 1.0) {
      if (this.iter && this.cur && t < this.cur.timestamp - 0.02 && this.cur.timestamp - t < 2) {
        // للخلف (مقطع معكوس): وصول عشوائي
        const wc = await this.sink.getCanvas(Math.max(0, t));
        return wc ? { img: wc.canvas, w: wc.canvas.width, h: wc.canvas.height } : null;
      }
      await this.reset(t);
    }
    while (this.next && this.next.timestamp <= t + eps) {
      this.cur = this.next;
      this.next = (await this.iter.next()).value || null;
    }
    const c = this.cur?.canvas;
    return c ? { img: c, w: c.width, h: c.height } : null;
  }
  async still(t) {
    if (!this.stillCache || this.stillT !== t) {
      const wc = await this.sink.getCanvas(t);
      if (wc) {
        const c = document.createElement('canvas');
        c.width = wc.canvas.width; c.height = wc.canvas.height;
        c.getContext('2d').drawImage(wc.canvas, 0, 0);
        this.stillCache = { img: c, w: c.width, h: c.height };
        this.stillT = t;
      }
    }
    return this.stillCache;
  }
  async dispose() { if (this.iter) { try { await this.iter.return(); } catch (e) {} } this.input?.dispose?.(); }
}

export const PRESETS = [
  { id: 'wa', label: 'واتساب', aspect: null, short: 720, fps: 30 },
  { id: 'tiktok', label: 'تيك توك / ريلز / شورتس', aspect: '9:16', short: 1080, fps: 30 },
  { id: 'yt', label: 'يوتيوب', aspect: '16:9', short: 1080, fps: 30 },
  { id: 'ig', label: 'منشور إنستغرام', aspect: '4:5', short: 1080, fps: 30 },
  { id: 'sq', label: 'مربع', aspect: '1:1', short: 1080, fps: 30 },
];

export async function supportInfo(w = 1280, h = 720) {
  const m = await mb();
  const video = await m.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: w, height: h });
  const audio = await m.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  return { webcodecs: typeof VideoEncoder !== 'undefined', video, audio };
}

async function prepareAudio(project) {
  const ids = lib.mediaIdsOf(project);
  for (const id of ids) { await lib.ensure(id); await lib.loadAudio(id); }
  return lib.audioBuffers(ids);
}

// تصدير الفيديو. opts: {short, fps, aspect?, onProgress, signal, range?}
export async function exportVideo(project, opts = {}) {
  const m = await mb();
  const p = opts.aspect ? { ...project, aspect: opts.aspect } : project;
  const fps = opts.fps || 30;
  const { w: W, h: H } = outputSize(p.aspect, opts.short || 720);
  const lay = layout(p);
  const total = opts.range ? Math.min(opts.range, lay.duration) : lay.duration;
  if (total <= 0) throw new Error('المشروع فارغ');
  const info = await supportInfo(W, H);
  if (!info.video) throw new Error('هذا المتصفح لا يدعم ترميز الفيديو (WebCodecs). استخدم Chrome أو Edge حديثًا.');
  const t0 = performance.now();
  const progress = (phase, v) => opts.onProgress?.({ phase, value: v, elapsed: (performance.now() - t0) / 1000 });

  await ensureProjectFonts(p);
  // الصوت أولًا
  progress('audio', 0);
  const buffers = await prepareAudio(p);
  const mix = await renderMix(p, buffers, total);
  if (opts.signal?.aborted) throw new DOMException('أُلغي', 'AbortError');

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  const target = new m.BufferTarget();
  const output = new m.Output({ format: new m.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const bitrate = Math.round(W * H * fps * (opts.quality || 0.12));
  const vsrc = new m.CanvasSource(canvas, { codec: info.video, bitrate, keyFrameInterval: 2, latencyMode: 'quality' });
  output.addVideoTrack(vsrc, { frameRate: fps });
  let asrc = null;
  if (info.audio) {
    asrc = new m.AudioBufferSource({ codec: info.audio, bitrate: 160000 });
    output.addAudioTrack(asrc);
  }
  await output.start();

  const providers = new Map();
  const maxLong = Math.max(W, H);
  const prov = async (key, mediaId) => {
    if (!providers.has(key)) {
      const r = await lib.ensure(mediaId);
      if (!r.ok) { providers.set(key, null); return null; }
      providers.set(key, await new VideoFrames(r.rt.file, maxLong).init());
    }
    return providers.get(key);
  };
  const assets = lib.assetMap();
  for (const id of lib.mediaIdsOf(p)) await lib.ensure(id);

  const n = Math.max(1, Math.round(total * fps));
  try {
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new DOMException('أُلغي', 'AbortError');
      const t = i / fps;
      const frames = new Map();
      for (const it of activeAt(lay, t)) {
        const c = it.clip;
        if (c.type === 'image') {
          const r = lib.rt(c.mediaId);
          if (r?.bitmap) frames.set(c.id, { img: r.bitmap, w: r.bitmap.width, h: r.bitmap.height });
        } else {
          const pv = await prov(c.id, c.mediaId);
          if (!pv) continue;
          const f = c.type === 'freeze' ? await pv.still(c.freezeAt || 0) : await pv.frameAt(sourceTime(c, t - it.start));
          if (f) frames.set(c.id, f);
        }
      }
      const ovFrames = new Map();
      for (const spec of overlayFrameSpecs(p, t)) {
        if (spec.kind === 'image') {
          const a = assets.get(spec.mediaId);
          if (a) ovFrames.set(spec.id, a);
        } else {
          const pv = await prov('o:' + spec.id, spec.mediaId);
          const f = pv && (await pv.frameAt(spec.src));
          if (f) ovFrames.set(spec.id, f);
        }
      }
      drawFrame(ctx, W, H, p, lay, t, frames, assets, ovFrames);
      await vsrc.add(t, 1 / fps);
      if (i % 3 === 0) progress('video', (i + 1) / n);
    }
    vsrc.close();
    if (asrc) { await asrc.add(mix); asrc.close(); }
    progress('finalize', 1);
    await output.finalize();
  } catch (e) {
    try { await output.cancel(); } catch (e2) {}
    throw e;
  } finally {
    for (const pv of providers.values()) pv?.dispose();
  }
  const elapsed = (performance.now() - t0) / 1000;
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  return { blob, stats: { W, H, fps, frames: n, duration: total, elapsed, speed: total / elapsed, renderFps: n / elapsed, videoCodec: info.video, audioCodec: info.audio, size: blob.size } };
}

// تصدير إطار واحد كصورة PNG
export async function exportFrame(project, t, short = 1080) {
  await ensureProjectFonts(project);
  const { w: W, h: H } = outputSize(project.aspect, short);
  const lay = layout(project);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const frames = new Map();
  const toDispose = [];
  for (const it of activeAt(lay, t)) {
    const c = it.clip;
    const r = await lib.ensure(c.mediaId);
    if (!r.ok) continue;
    if (c.type === 'image') frames.set(c.id, { img: r.rt.bitmap, w: r.rt.bitmap.width, h: r.rt.bitmap.height });
    else {
      const pv = await new VideoFrames(r.rt.file, Math.max(W, H)).init();
      toDispose.push(pv);
      const f = await pv.still(c.type === 'freeze' ? c.freezeAt || 0 : sourceTime(c, t - it.start));
      if (f) frames.set(c.id, f);
    }
  }
  const ovFrames = new Map();
  const assets = lib.assetMap();
  for (const spec of overlayFrameSpecs(project, t)) {
    const r = await lib.ensure(spec.mediaId);
    if (!r.ok) continue;
    if (spec.kind === 'image') ovFrames.set(spec.id, assets.get(spec.mediaId));
    else { const pv = await new VideoFrames(r.rt.file, Math.max(W, H)).init(); toDispose.push(pv); const f = await pv.still(spec.src); if (f) ovFrames.set(spec.id, f); }
  }
  drawFrame(canvas.getContext('2d'), W, H, project, lay, t, frames, assets, ovFrames);
  toDispose.forEach((d) => d.dispose());
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

// تصدير الصوت فقط: M4A إن أمكن، وإلا WAV
export async function exportAudio(project) {
  const lay = layout(project);
  const buffers = await prepareAudio(project);
  const mix = await renderMix(project, buffers, lay.duration);
  const m = await mb();
  const codec = await m.getFirstEncodableAudioCodec(['aac'], { numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  if (codec) {
    const target = new m.BufferTarget();
    const output = new m.Output({ format: new m.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const src = new m.AudioBufferSource({ codec, bitrate: 192000 });
    output.addAudioTrack(src);
    await output.start();
    await src.add(mix);
    src.close();
    await output.finalize();
    return { blob: new Blob([target.buffer], { type: 'audio/mp4' }), ext: 'm4a' };
  }
  return { blob: encodeWav(mix), ext: 'wav' };
}

// اختبار أداء الجهاز: تصدير فيديو اصطناعي قصير وقياس السرعة
export async function benchmark(short = 720, fps = 30, seconds = 4, onProgress) {
  const m = await mb();
  const { w: W, h: H } = outputSize('9:16', short);
  const info = await supportInfo(W, H);
  if (!info.video) return { ok: false, reason: 'لا يدعم المتصفح ترميز الفيديو' };
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const output = new m.Output({ format: new m.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new m.BufferTarget() });
  const vsrc = new m.CanvasSource(canvas, { codec: info.video, bitrate: Math.round(W * H * fps * 0.12) });
  output.addVideoTrack(vsrc, { frameRate: fps });
  await output.start();
  const n = seconds * fps;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${i * 3},70%,40%)`); g.addColorStop(1, `hsl(${i * 3 + 120},70%,30%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.filter = 'blur(4px)';
    ctx.drawImage(canvas, 0, 0, W / 8, H / 8, 0, 0, W, H);
    ctx.filter = 'none';
    ctx.fillStyle = '#fff'; ctx.font = `bold ${W / 8}px Cairo, sans-serif`; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText('اختبار ' + i, W / 2, H / 2);
    await vsrc.add(i / fps, 1 / fps);
    if (i % 10 === 0) onProgress?.(i / n);
  }
  vsrc.close();
  await output.finalize();
  const elapsed = (performance.now() - t0) / 1000;
  return { ok: true, W, H, fps, renderFps: n / elapsed, realtime: seconds / elapsed, codec: info.video };
}
