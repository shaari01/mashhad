// المرحلة 6: تتبع الحركة، والشاشة الخضراء، والترجمة التلقائية (بخدمة وهمية)
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, saveExport, ffprobe, waitFor , tool, setSlider } from './helpers.mjs';

test('المرحلة 6: تتبع وشاشة خضراء وترجمة', { timeout: 300000 }, async () => {
  const srv = await startServer(4180);
  const { browser, page, errors } = await openApp(srv.url);
  try {
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['moving.mp4']);
    await waitFor(page, () => window.__app.project.clips.length === 1);
    const aspect = (await proj(page)).aspect;
    assert.equal(aspect, '9:16');

    // ملصق فوق المربع المتحرك ثم تتبعه
    await page.evaluate(() => window.__app.preview.seek(0));
    await tool(page, 'sticker');
    await page.locator('.sheet .grid .cell', { hasText: '😂' }).click();
    await waitFor(page, () => window.__app.project.overlays.length === 1);
    await page.evaluate(() => { const o = window.__app.project.overlays[0]; o.start = 0; o.end = 3.6; o.x = 78 / 360; o.y = 168 / 640; o.size = 0.15; });
    await page.getByRole('button', { name: 'تتبّع الحركة' }).click();
    await waitFor(page, () => window.__app.project.overlays[0].track?.length > 20, null, 90000);
    const o = (await proj(page)).overlays[0];
    const at = (t) => { const tr = o.track; let best = tr[0]; for (const p of tr) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; return best; };
    for (const t of [1, 2, 3.4]) {
      const p = at(t);
      const ex = (78 + 50 * t) / 360, ey = (168 + 60 * t) / 640;
      assert.ok(Math.abs(p.x - ex) < 0.04 && Math.abs(p.y - ey) < 0.03, `التتبع عند ${t}: ${p.x.toFixed(3)},${p.y.toFixed(3)} المتوقع ${ex.toFixed(3)},${ey.toFixed(3)}`);
    }
    assert.ok(await page.getByRole('button', { name: 'ألغِ التتبع' }).isVisible());
    await page.click('#sheet-close');

    // فيديو بشاشة خضراء فوق الفيديو
    await page.evaluate(() => window.__app.preview.seek(1));
    await tool(page, 'pip');
    await chooseFiles(page, () => page.getByText('فيديو فوق الفيديو').click(), ['green.mp4']);
    await waitFor(page, () => window.__app.project.overlays.some((x) => x.kind === 'video'));
    await page.getByRole('button', { name: 'أزل الخلفية الخضراء' }).click();
    let p = await proj(page);
    const v = p.overlays.find((x) => x.kind === 'video');
    assert.ok(v.chroma?.color);
    await page.getByRole('button', { name: 'املأ الشاشة' }).click();
    await page.evaluate(() => window.__app.preview.seek(1.5));
    await page.waitForTimeout(900);
    // نقطة على الخلفية الخضراء يجب أن تُظهر الفيديو الأساسي لا الأخضر
    const px = await page.evaluate(() => {
      const c = document.querySelector('#preview'); const g = c.getContext('2d');
      const d = g.getImageData(Math.round(c.width * 0.5), Math.round(c.height * 0.43), 1, 1).data;
      const e = g.getImageData(Math.round(c.width * 0.5), Math.round(c.height * 0.5), 1, 1).data;
      return { edge: [...d], center: [...e] };
    });
    const isGreen = ([r, g, b]) => g > 150 && r < 80 && b < 80;
    assert.ok(!isGreen(px.edge), 'الأخضر أُزيل: ' + px.edge);
    assert.ok(px.center[0] > 150 && px.center[1] < 90, 'المربع الأحمر باقٍ: ' + px.center);
    await page.screenshot({ path: 'tests/out/phase6-chroma.png' });
    await page.click('#sheet-close');

    // الترجمة التلقائية بخدمة وهمية
    let got = null;
    await page.route('**/mock-transcribe', async (route) => {
      const req = route.request();
      got = { auth: req.headers()['authorization'], size: req.postDataBuffer()?.length || 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'x', segments: [{ start: 0.2, end: 1.4, text: 'السلام عليكم' }, { start: 1.6, end: 3, text: 'هذا اختبار للترجمة التلقائية' }] }) });
    });
    await tool(page, 'captions');
    await page.getByLabel('عنوان خدمة التفريغ').fill(srv.url + 'mock-transcribe');
    await page.getByLabel('عنوان خدمة التفريغ').dispatchEvent('change');
    await page.getByLabel('مفتاح الخدمة').fill('test-key');
    await page.getByLabel('مفتاح الخدمة').dispatchEvent('change');
    await page.getByRole('button', { name: 'حوّل الكلام إلى نص' }).click();
    await waitFor(page, () => window.__app.project.texts.filter((t) => t.caption).length === 2, null, 30000);
    assert.equal(got.auth, 'Bearer test-key');
    assert.ok(got.size > 1000, 'أُرسل الصوت');
    // تصحيح سطر
    const line = page.getByLabel('سطر ترجمة').first();
    await line.fill('السلام عليكم ورحمة الله');
    await line.dispatchEvent('change');
    p = await proj(page);
    assert.equal(p.texts.filter((t) => t.caption).sort((a, b) => a.start - b.start)[0].text, 'السلام عليكم ورحمة الله');
    const saved = await page.evaluate(() => window.__app.settings.transcribe.key);
    assert.equal(saved, 'test-key');
    await page.evaluate(() => window.__app.preview.seek(2));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/out/phase6.png' });
    await page.click('#sheet-close');

    // التصدير
    await page.click('#btn-export');
    await page.locator('.modal .seg button', { hasText: '720p' }).click();
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 150000 });
    const file = await saveExport(page, 'phase6.mp4');
    const info = ffprobe(file);
    assert.ok(Math.abs(+info.format.duration - 4) < 0.3);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
