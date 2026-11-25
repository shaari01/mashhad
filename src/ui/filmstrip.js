// شريط صور مصغرة من الفيديو (للقص)، يُولَّد مرة ويُحفظ مؤقتًا
import * as lib from '../media/library.js';

const cache = new Map();

export async function filmstrip(mediaId, count = 10) {
  const key = mediaId + ':' + count;
  if (cache.has(key)) return cache.get(key);
  const pr = (async () => {
    const r = await lib.ensure(mediaId);
    const rec = await lib.getRecord(mediaId);
    if (!r.ok || !rec) return [];
    if (rec.kind === 'image') return [rec.thumb];
    const D = rec.duration || 1;
    const times = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * D);
    try {
      const mb = await import('mediabunny');
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(r.rt.file) });
      const vt = await input.getPrimaryVideoTrack();
      if (!vt || !(await vt.canDecode())) throw new Error('no decode');
      const sink = new mb.CanvasSink(vt, { width: 96 });
      const out = [];
      for await (const wc of sink.canvasesAtTimestamps(times)) {
        if (!wc) { out.push(rec.thumb); continue; }
        const c = document.createElement('canvas');
        c.width = wc.canvas.width; c.height = wc.canvas.height;
        c.getContext('2d').drawImage(wc.canvas, 0, 0);
        out.push(c.toDataURL('image/jpeg', 0.6));
      }
      return out;
    } catch (e) {
      return await viaElement(r.rt.url, times, rec.thumb);
    }
  })();
  cache.set(key, pr);
  return pr;
}

async function viaElement(url, times, fallback) {
  const v = document.createElement('video');
  v.muted = true; v.src = url; v.preload = 'auto';
  await new Promise((r) => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 5000); });
  const out = [];
  const c = document.createElement('canvas');
  for (const t of times) {
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; setTimeout(r, 1500); });
    const s = 96 / Math.max(1, v.videoWidth);
    c.width = 96; c.height = Math.max(1, Math.round(v.videoHeight * s));
    try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); out.push(c.toDataURL('image/jpeg', 0.6)); } catch (e) { out.push(fallback); }
  }
  return out;
}
