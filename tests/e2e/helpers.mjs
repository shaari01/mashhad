// أدوات مشتركة للاختبارات الآلية في المتصفح (Playwright + Chromium)
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright'); }
export const { chromium } = pw;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MEDIA = path.join(ROOT, 'tests/media');
export const OUT = path.join(ROOT, 'tests/out');
fs.mkdirSync(OUT, { recursive: true });

export async function startServer(port = 4173) {
  const proc = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('server timeout')), 20000);
    proc.stdout.on('data', (d) => { if (String(d).includes('http')) { clearTimeout(to); res(); } });
    proc.on('exit', (c) => rej(new Error('server exit ' + c)));
  });
  proc.unref(); proc.stdout.unref?.(); proc.stderr?.unref?.();
  return { url: `http://localhost:${port}/`, stop: () => proc.kill() };
}

export async function openApp(url, { mobile = true, noHandles = true, context = null } = {}) {
  const browser = context ? null : await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = context || await browser.newContext(mobile ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ar' } : { viewport: { width: 1366, height: 768 }, locale: 'ar' });
  if (noHandles) await ctx.addInitScript(() => { delete window.showOpenFilePicker; window.showOpenFilePicker = undefined; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
  return { browser, ctx, page, errors };
}

// اختيار ملفات عبر نافذة الاختيار
export async function chooseFiles(page, trigger, files) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), trigger()]);
  await fc.setFiles(files.map((f) => path.join(MEDIA, f)));
}

export const proj = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.project)));

export async function waitFor(page, fn, arg, timeout = 20000) {
  await page.waitForFunction(fn, arg, { timeout });
}

// هل في اللوحة محتوى غير أسود؟
export async function canvasStats(page, sel = '#preview') {
  return page.evaluate((s) => {
    const c = document.querySelector(s);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0, n = 0, varc = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; varc += v * v; n++; }
    const mean = sum / n;
    return { mean, std: Math.sqrt(varc / n - mean * mean), w: c.width, h: c.height };
  }, sel);
}

export async function saveExport(page, name) {
  const b64 = await page.evaluate(async () => {
    const b = window.__lastExport.blob;
    const buf = new Uint8Array(await b.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const f = path.join(OUT, name);
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  return f;
}

export function ffprobe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).toString());
  return j;
}

// قراءة إطار من ملف فيديو كمتوسط ألوان (للتحقق من المحتوى)
export function frameColor(file, t) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=8:8', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < buf.length; i += 3) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
  const n = buf.length / 3;
  return [r / n, g / n, b / n];
}

// مستوى الصوت في مقطع زمني من ملف
export function audioLevel(file, from, dur) {
  const out = execFileSync('ffmpeg', ['-v', 'info', '-ss', String(from), '-t', String(dur), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  return out;
}
export function meanVolume(file, from, dur) {
  try {
    const r = require('node:child_process').spawnSync('ffmpeg', ['-v', 'info', '-ss', String(from), '-t', String(dur), '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
    const m = String(r.stderr).match(/mean_volume:\s*(-?[\d.]+)/);
    return m ? +m[1] : -99;
  } catch { return -99; }
}
