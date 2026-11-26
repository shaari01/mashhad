// المعاينة الحية: عناصر <video> مخفية لكل مقطع ظاهر، تُرسَم على Canvas عبر المركِّب نفسه.
// الساعة الرئيسية هي ساعة الصوت، فيبقى الصوت والصورة متزامنين.
import { layout, activeAt, sourceTime, speedAt, clamp } from '../core/timeline.js';
import { drawFrame } from './render.js';
import { scheduleMix } from './audio.js';
import * as lib from '../media/library.js';
import { overlayFrameSpecs } from './overlays.js';

export class Preview {
  constructor(canvas, getProject) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getProject = getProject;
    this.time = 0;
    this.playing = false;
    this.els = new Map(); // key -> {el, lastUse}
    this.listeners = new Set();
    this.dirty = true;
    this.lay = null;
    this.audioCtx = null;
    this.mix = null;
    this.raf = null;
    this.loop = this.loop.bind(this);
    this.extraDraw = null; // رسم إضافي فوق المعاينة (أدلة التحرير)
    this.raf = requestAnimationFrame(this.loop);
    lib.onMediaChange(() => { this.dirty = true; if (this.playing) this.restartAudio(); });
  }

  onTime(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const f of this.listeners) f(this.time, this.playing); }

  invalidate() {
    this.lay = null;
    this.dirty = true;
    if (this.playing) {
      clearTimeout(this._rs);
      this._rs = setTimeout(() => this.restartAudio(), 120);
    }
  }

  get layout() {
    if (!this.lay) this.lay = layout(this.getProject());
    return this.lay;
  }
  get duration() { return this.layout.duration; }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h; this.dirty = true;
    }
  }

  el(key, mediaId) {
    let e = this.els.get(key);
    const r = lib.rt(mediaId);
    if (!r?.url) return null;
    if (!e || e.mediaId !== mediaId) {
      if (e) { e.el.pause(); e.el.removeAttribute('src'); e.el.load(); }
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      v.src = r.url;
      v.addEventListener('seeked', () => { this.dirty = true; });
      v.addEventListener('loadeddata', () => { this.dirty = true; });
      e = { el: v, mediaId, lastUse: 0 };
      this.els.set(key, e);
    }
    e.lastUse = performance.now();
    return e.el;
  }

  gc() {
    const now = performance.now();
    if (this.els.size <= 4) return;
    for (const [k, e] of this.els) {
      if (now - e.lastUse > 4000) {
        e.el.pause(); e.el.removeAttribute('src'); e.el.load();
        this.els.delete(k);
      }
    }
  }

  async play() {
    if (this.playing) return;
    if (this.time >= this.duration - 0.05) this.time = 0;
    this.playing = true;
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    try { await this.audioCtx.resume(); } catch (e) {}
    const p = this.getProject();
    await Promise.race([Promise.all(lib.mediaIdsOf(p).map((id) => lib.loadAudio(id))), new Promise((r) => setTimeout(r, 600))]);
    if (!this.playing) return;
    this.restartAudio();
    this.emit();
  }

  restartAudio() {
    if (this.mix) { this.mix.stop(); this.mix = null; }
    if (!this.playing || !this.audioCtx) return;
    const p = this.getProject();
    const buffers = lib.audioBuffers(lib.mediaIdsOf(p));
    this.clockBase = this.audioCtx.currentTime + 0.05;
    this.clockFrom = this.time;
    if (!this.out) { this.out = this.audioCtx.createGain(); this.out.connect(this.audioCtx.destination); }
    this.out.gain.value = this.muted ? 0 : 1;
    this.mix = scheduleMix(this.audioCtx, p, buffers, { from: this.time, base: this.clockBase, destination: this.out });
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.mix) { this.mix.stop(); this.mix = null; }
    for (const { el } of this.els.values()) el.pause();
    this.dirty = true;
    this.emit();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t) {
    this.time = clamp(t, 0, Math.max(0, this.duration));
    this.dirty = true;
    if (this.playing) this.restartAudio();
    this.emit();
  }

  clock() {
    if (this.playing && this.audioCtx && this.mix) return this.clockFrom + Math.max(0, this.audioCtx.currentTime - this.clockBase);
    return this.time;
  }

  frameFor(item, local) {
    const c = item.clip;
    if (c.type === 'image') {
      const r = lib.rt(c.mediaId);
      return r?.bitmap ? { img: r.bitmap, w: r.bitmap.width, h: r.bitmap.height, ok: true } : { ok: true, missing: true };
    }
    const key = c.type === 'freeze' ? 'f:' + c.id : 'c:' + c.id;
    const v = this.el(key, c.mediaId);
    if (!v) return { ok: true, missing: true };
    const ds = sourceTime(c, local);
    if (c.type === 'video' && this.playing && !c.reverse) {
      const rate = clamp(speedAt(c, local), 0.0625, 16);
      if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
      if (v.paused) { v.currentTime = ds; v.play().catch(() => {}); }
      else if (Math.abs(v.currentTime - ds) > 0.3) v.currentTime = ds;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - ds) > 0.02 && !v.seeking) v.currentTime = ds;
    }
    const ready = v.readyState >= 2 && !v.seeking;
    return { img: v, w: v.videoWidth, h: v.videoHeight, ok: ready || this.playing };
  }

  // تحضير المقطع التالي قبل وصوله لتجنب التقطع
  prewarm(lay, t) {
    for (const it of lay.items) {
      if (it.start > t && it.start - t < 1.5 && it.clip.type !== 'image') {
        const v = this.el((it.clip.type === 'freeze' ? 'f:' : 'c:') + it.clip.id, it.clip.mediaId);
        const ds = sourceTime(it.clip, 0);
        if (v && Math.abs(v.currentTime - ds) > 0.05 && !v.seeking && v.paused) v.currentTime = ds;
      }
    }
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const p = this.getProject();
    const lay = this.layout;
    if (this.playing) {
      this.time = this.clock();
      if (this.time >= lay.duration) {
        this.time = lay.duration;
        this.pause();
      }
      this.dirty = true;
      this.emit();
    }
    if (!this.dirty) return;
    const t = Math.min(this.time, Math.max(0, lay.duration - 0.001));
    const act = activeAt(lay, t);
    const frames = new Map();
    let ok = true;
    for (const it of act) {
      const f = this.frameFor(it, t - it.start);
      if (!f.ok) ok = false;
      if (!f.missing && f.w) frames.set(it.clip.id, f);
    }
    // إيقاف عناصر المقاطع غير الظاهرة
    const activeKeys = new Set(act.map((it) => (it.clip.type === 'freeze' ? 'f:' : 'c:') + it.clip.id));
    for (const spec of overlayFrameSpecs(p, t)) activeKeys.add('o:' + spec.id);
    for (const [k, e] of this.els) if (!activeKeys.has(k) && !e.el.paused) e.el.pause();
    // الطبقات (فيديو فوق فيديو)
    const ovFrames = new Map();
    for (const spec of overlayFrameSpecs(p, t)) {
      if (spec.kind === 'image') {
        const r = lib.rt(spec.mediaId);
        if (r?.bitmap) ovFrames.set(spec.id, { img: r.bitmap, w: r.bitmap.width, h: r.bitmap.height });
      } else if (spec.kind === 'anim') {
        const f = lib.animFrameAt(spec.mediaId, spec.src);
        if (f) ovFrames.set(spec.id, f);
        if (this.playing === false) this.dirty = this.dirty || !lib.rt(spec.mediaId)?.anim;
      } else {
        const v = this.el('o:' + spec.id, spec.mediaId);
        if (!v) continue;
        if (this.playing) { if (v.paused) { v.currentTime = spec.src; v.play().catch(() => {}); } else if (Math.abs(v.currentTime - spec.src) > 0.3) v.currentTime = spec.src; }
        else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - spec.src) > 0.03 && !v.seeking) v.currentTime = spec.src; }
        if (v.readyState >= 2) ovFrames.set(spec.id, { img: v, w: v.videoWidth, h: v.videoHeight });
      }
    }
    if (this.playing) this.prewarm(lay, t);
    if (!ok && !this.playing) return; // ننتظر اكتمال البحث في الفيديو
    const { width: W, height: H } = this.canvas;
    drawFrame(this.ctx, W, H, p, lay, t, frames, lib.assetMap?.() || null, ovFrames);
    if (!lay.items.length) {
      this.ctx.fillStyle = '#15171c';
      this.ctx.fillRect(0, 0, W, H);
    }
    if (this.extraDraw) this.extraDraw(this.ctx, W, H, t);
    this.dirty = !ok;
    this.gc();
  }

  snapshot(type = 'image/png') {
    return new Promise((res) => this.canvas.toBlob(res, type, 0.95));
  }
}
