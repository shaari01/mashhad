// المؤثرات الصوتية المدمجة، وأصواتك، والتسجيل الصوتي بالميكروفون فوق الفيديو، والتجميد.
import { app, edit, select, shown } from '../../app.js';
import * as db from '../../storage/db.js';
import * as lib from '../../media/library.js';
import { SFX, renderSfx } from '../../engine/sfx.js';
import { encodeWav } from '../../engine/audio.js';
import { freezeAt } from '../../core/edits.js';
import { h, btn, openSheet, refreshSheet, toast } from '../dom.js';
import { addAudioItem, addAudioFile, openAudioPanel } from './music.js';
import { inboxSection } from './stickers.js';

let previewCtx = null;
function play(buffer) {
  previewCtx ||= new AudioContext();
  previewCtx.resume();
  const s = previewCtx.createBufferSource();
  s.buffer = buffer; s.connect(previewCtx.destination); s.start();
}

// صوت مدمج ← وسيط محفوظ (يُولَّد مرة واحدة على الجهاز)
export async function sfxMedia(id) {
  const key = 'sfx:' + id;
  const mid = await db.get('kv', key);
  if (mid) {
    const r = await lib.ensure(mid);
    if (r.ok) { const rec = await lib.getRecord(mid); if (rec) return rec; }
  }
  const buf = await renderSfx(id);
  const meta = SFX.find((s) => s.id === id);
  const rec = await lib.importBlob(encodeWav(buf), meta.label + '.wav', 'audio', { role: 'sfx' });
  await db.put('kv', rec.id, key);
  return rec;
}

export function openSfxPanel() {
  openSheet('sfx', 'مؤثرات صوتية', (body) => {
    body.append(h('p.hint', {}, 'المس الصوت ليُضاف عند المؤشر ويُسمَع. لتعديل مستواه أو موضعه المسه في مسار المؤثرات.'));
    const grid = h('div.grid');
    for (const s of SFX) {
      if (!shown('sfx', s.id)) continue;
      grid.append(h('button.cell', { style: { display: 'flex', flexDirection: 'column', fontSize: '28px', aspectRatio: 'auto', minHeight: '76px' }, 'aria-label': s.label, onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        try {
          const rec = await sfxMedia(s.id);
          addAudioItem(rec, 'sfx');
          const buf = await lib.loadAudio(rec.id);
          if (buf) play(buf);
          toast(`أُضيف «${s.label}» عند ${app.preview.time.toFixed(1)} ث`);
        } catch (err) { toast('تعذّر: ' + err.message); }
        b.disabled = false;
      } }, s.emoji, h('span', { style: { fontSize: '12px' } }, s.label)));
    }
    body.append(grid);
    body.append(h('div.row', {}, btn('أضف صوتًا من ملفاتك', async () => { await addAudioFile('sfx'); }, { icon: 'plus' }), btn('تعديل المؤثرات المضافة', () => openAudioPanel(null, 'sfx'), { icon: 'adjust' })));
    inboxSection(body, 'audio', (rec) => addAudioItem(rec, 'sfx'));
  });
}

// ———— التسجيل الصوتي ————
let rec = null;
export function openMicPanel() {
  openSheet('mic', 'تسجيل صوتي', (body) => {
    const status = h('p', { style: { textAlign: 'center', fontSize: '18px' } }, rec ? 'جارٍ التسجيل…' : 'سجّل تعليقك بصوتك فوق الفيديو. يبدأ التشغيل من المؤشر أثناء التسجيل.');
    const big = btn(rec ? 'أوقف التسجيل' : 'ابدأ التسجيل', async () => {
      if (rec) { rec.stop(); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { toast('لم يُسمح باستخدام الميكروفون'); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      const startT = app.preview.time;
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        app.preview.pause();
        app.preview.muted = false;
        rec = null;
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        try {
          const r = await lib.importBlob(blob, 'تسجيل ' + new Date().toLocaleTimeString('ar') + (blob.type.includes('mp4') ? '.m4a' : '.webm'), 'audio');
          addAudioItem(r, 'voice', startT);
          toast('أُضيف التسجيل');
        } catch (e) { toast('تعذّر حفظ التسجيل: ' + e.message); }
        refreshSheet();
      };
      rec = mr;
      mr.start(250);
      // الموسيقى تُخفض تلقائيًا عند الكلام في الناتج؛ أثناء التسجيل نشغّل الفيديو بلا صوت لتجنب الصدى
      app.preview.muted = true;
      app.preview.play();
      refreshSheet();
    }, { cls: 'pri', icon: rec ? 'stop' : 'record' });
    Object.assign(big.style, { width: '100%', minHeight: '88px', fontSize: '20px', background: rec ? '#ff5470' : '' });
    body.append(status, big, h('p.hint', {}, 'نصيحة: استخدم سماعة أذن حتى لا يدخل صوت الفيديو في التسجيل.'));
    body.append(h('div.row', {}, btn('تعديل التسجيلات', () => openAudioPanel(null, 'voice'), { icon: 'adjust' })));
  });
}

export function doFreeze() {
  const t = app.preview.time;
  const fr = edit('تجميد', (p) => freezeAt(p, t, 2));
  if (!fr) return toast('ضع المؤشر داخل مقطع فيديو ثم جمّد');
  select('clip', fr.id);
  toast('جُمّد الإطار ثانيتين مع تكبير. غيّر المدة من «قص».');
}
