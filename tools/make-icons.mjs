// توليد أيقونات PNG من SVG بمتصفح Chromium المثبت
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW_PATH || 'playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:#12141a;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div></body>`);
  await p.screenshot({ path: new URL('../public/icons/' + name, import.meta.url).pathname, omitBackground: false });
}
await b.close();
