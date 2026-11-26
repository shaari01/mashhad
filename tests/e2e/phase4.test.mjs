// المرحلة 4: الملصقات، وفيديو فوق فيديو، والمؤثرات الصوتية، والتجميد، والتسجيل، والوارد من البرامج الأخرى
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, saveExport, ffprobe, waitFor, meanVolume } from './helpers.mjs';

test('المرحلة 4: ملصقات وطبقات ومؤثرات وتجميد', { timeout: 240000 }, async () => {
  const srv = await startServer(4178);
  const { browser, ctx, page, errors } = await openApp(srv.url);
  await ctx.grantPermissions(['microphone']);
  try {
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['clipA.webm', 'photo.jpg']);
    await waitFor(page, () => window.__app.project.clips.length === 2);

    // إيموجي
    await page.evaluate(() => window.__app.preview.seek(0.5));
    await page.click('[data-tool="sticker"]');
    await page.locator('.sheet .grid .cell', { hasText: '😂' }).click();
    let p = await proj(page);
    assert.equal(p.overlays.length, 1);
    assert.equal(p.overlays[0].kind, 'emoji');
    // سحب الملصق
    await page.waitForTimeout(500);
    const box = await page.locator('#preview').boundingBox();
    const o = p.overlays[0];
    await page.mouse.move(box.x + box.width * o.x, box.y + box.height * o.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.2, { steps: 6 });
    await page.mouse.up();
    p = await proj(page);
    assert.ok(p.overlays[0].x < 0.4 && p.overlays[0].y < 0.3, 'تحرك الملصق');

    // سهم وفقاعة كلام
    await page.locator('.sheet button', { hasText: 'ملصق آخر' }).click();
    await page.locator('.sheet .seg button', { hasText: 'أشكال وأسهم' }).click();
    await page.locator('.sheet .grid .cell[aria-label="سهم"]').click();
    await page.locator('.sheet button', { hasText: 'ملصق آخر' }).click();
    await page.locator('.sheet .seg button', { hasText: 'فقاعات كلام' }).click();
    await page.locator('.sheet .grid .cell', { hasText: 'ههههه' }).click();
    // GIF متحرك
    await page.locator('.sheet button', { hasText: 'ملصق آخر' }).click();
    await page.locator('.sheet .seg button', { hasText: 'ملصقاتك' }).click();
    await chooseFiles(page, () => page.getByText('استورد PNG شفاف أو GIF').click(), ['sticker.gif']);
    await waitFor(page, () => window.__app.project.overlays.length === 4);
    p = await proj(page);
    assert.deepEqual(p.overlays.map((x) => x.kind), ['emoji', 'shape', 'shape', 'anim']);
    assert.equal(p.overlays[2].text, 'ههههه');
    await page.click('#sheet-close');

    // فيديو فوق فيديو
    await page.click('[data-tool="pip"]');
    await chooseFiles(page, () => page.getByText('فيديو فوق الفيديو').click(), ['clipB.mp4']);
    await waitFor(page, () => window.__app.project.overlays.some((x) => x.kind === 'video'));
    await page.click('#sheet-close');

    // مؤثر صوتي
    await page.evaluate(() => window.__app.preview.seek(1.5));
    await page.click('[data-tool="sfx"]');
    await page.locator('.sheet .grid .cell[aria-label="تصفيق"]').click();
    await waitFor(page, () => window.__app.project.audio.some((a) => a.kind === 'sfx'));
    // الوارد من برنامج الصوت (صندوق مشترك)
    await page.evaluate(async () => {
      const sr = 8000, n = sr; const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf);
      const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 3) * 8000, true);
      const blob = new Blob([buf], { type: 'audio/wav' });
      await new Promise((res, rej) => { const r = indexedDB.open('shared-media-inbox', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' }); r.onsuccess = () => { const tx = r.result.transaction('items', 'readwrite'); tx.objectStore('items').put({ id: 'x1', name: 'صوت من صدى', type: 'audio', mime: 'audio/wav', blob, duration: 1, created: Date.now(), from: 'sada' }); tx.oncomplete = res; tx.onerror = rej; }; });
    });
    await page.click('#sheet-close');
    await page.click('[data-tool="sfx"]');
    await page.locator('.sheet .list-item', { hasText: 'صوت من صدى' }).getByRole('button', { name: 'استورد' }).click();
    await waitFor(page, () => window.__app.project.audio.filter((a) => a.kind === 'sfx').length === 2);
    const left = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('shared-media-inbox', 1); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').count(); q.onsuccess = () => res(q.result); }; }));
    assert.equal(left, 0, 'حُذف من الوارد بعد الاستيراد');
    await page.click('#sheet-close');

    // التسجيل الصوتي (ميكروفون وهمي)
    await page.evaluate(() => window.__app.preview.seek(0.2));
    await page.click('[data-tool="mic"]');
    await page.getByRole('button', { name: 'ابدأ التسجيل' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'أوقف التسجيل' }).click();
    await waitFor(page, () => window.__app.project.audio.some((a) => a.kind === 'voice'));
    await page.click('#sheet-close');

    // التجميد عند 1 ث
    await page.evaluate(() => window.__app.preview.seek(1));
    await page.click('[data-tool="freeze"]');
    p = await proj(page);
    assert.equal(p.clips.length, 4);
    assert.equal(p.clips[1].type, 'freeze');
    assert.ok(Math.abs(p.clips[1].freezeAt - 1) < 0.05);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tests/out/phase4.png' });

    // التصدير
    await page.click('#btn-export');
    await page.locator('.modal .seg button', { hasText: '720p' }).click();
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 120000 });
    const file = await saveExport(page, 'phase4.mp4');
    const info = ffprobe(file);
    const D = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(Math.abs(+info.format.duration - D) < 0.3);
    assert.ok(meanVolume(file, 1.5, 1) > -35, 'صوت التصفيق مسموع');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
