// المرحلة 5: الفلاتر وتوحيد الألوان، والمؤثرات المرئية، والإطارات، والخط الزمني المتقدم
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, saveExport, ffprobe, waitFor , tool, setSlider } from './helpers.mjs';

test('المرحلة 5: فلاتر ومؤثرات وخط زمني', { timeout: 300000 }, async () => {
  const srv = await startServer(4179);
  const { browser, page, errors } = await openApp(srv.url);
  try {
    // أربعة عناصر من الشاشة الفارغة (القوالب أُزيلت بطلب علي)
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['photo.jpg', 'clipA.webm', 'photo.jpg', 'clipB.mp4']);
    await waitFor(page, () => window.__app.project.clips.length === 4, null, 60000);
    let p;
    assert.equal(await page.locator('#btn-empty-template').count(), 0, 'لا قوالب');

    // فلتر لمقطع واحد ثم توحيد الكل
    await page.locator('#storyboard .card').first().click();
    await tool(page, 'filter');
    await page.locator('.sheet .chip', { hasText: 'أبيض وأسود' }).click();
    p = await proj(page);
    assert.equal(p.clips[0].filter, 'bw');
    assert.equal(p.clips[1].filter || 'none', 'none');
    await page.locator('.sheet .seg button', { hasText: 'تعديل' }).click();
    await setSlider(page, 'السطوع', 0.3);
    p = await proj(page);
    assert.ok(Math.abs(p.clips[0].adjust.brightness - 0.3) < 0.03);
    await page.locator('.sheet .seg button', { hasText: 'توحيد الألوان' }).click();
    await page.getByRole('button', { name: /انسخ فلتر وألوان/ }).click();
    p = await proj(page);
    assert.ok(p.clips.every((c) => c.filter === 'bw' && Math.abs(c.adjust.brightness - 0.3) < 0.03));
    await page.getByRole('button', { name: /موازنة تلقائية/ }).click();
    await waitFor(page, () => window.__app.history.canUndo);
    await page.click('#sheet-close');

    // مؤثر مرئي وإطار
    await tool(page, 'effects');
    await page.locator('.sheet .seg button', { hasText: 'كامل المقطع' }).click();
    await page.locator('.sheet .chip').first().click();
    p = await proj(page);
    assert.ok(p.clips[0].effects.some((e) => e.end > 1e8), 'مؤثر على كامل المقطع');
    await page.click('#sheet-close');

    // نص للسحب في الخط الزمني
    await page.evaluate(() => window.__app.preview.seek(0));
    await tool(page, 'text');
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.click('#sheet-close');

    // الخط الزمني المتقدم: سحب النص
    await page.click('#btn-mode');
    assert.ok(await page.locator('#timeline').isVisible());
    assert.ok(await page.locator('#storyboard').isHidden());
    const t0 = (await proj(page)).texts[0].start;
    const it = page.locator('#timeline .tl-item.text').first();
    const b = await it.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 - 70, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    p = await proj(page);
    assert.ok(p.texts[0].start > t0 + 0.3, `تحرك النص إلى الأمام زمنيًا (${p.texts[0].start})`);
    // قص نهاية مقطع الفيديو بسحب طرفه الأيسر
    const D0 = await page.evaluate(() => window.__app.preview.duration);
    const vid = page.locator('#timeline .tl-item:not(.text):not(.ov):not(.aud)').nth(1);
    await vid.click(); // التحديد يرفعه فوق المقطع المتداخل معه في الانتقال
    await page.waitForTimeout(200);
    const vb = await page.locator('#timeline .tl-item.sel').boundingBox();
    await page.mouse.move(vb.x + 4, vb.y + vb.height / 2);
    await page.mouse.down();
    await page.mouse.move(vb.x + 40, vb.y + vb.height / 2, { steps: 6 });
    await page.mouse.up();
    const D1 = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(D1 < D0 - 0.2, `قُصّ المقطع (${D0} → ${D1})`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tests/out/phase5.png' });
    await page.click('#btn-mode');
    assert.ok(await page.locator('#storyboard').isVisible());

    // التصدير
    await page.click('#btn-export');
    await page.locator('.modal .seg button', { hasText: '720p' }).click();
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 150000 });
    const file = await saveExport(page, 'phase5.mp4');
    const info = ffprobe(file);
    const D = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(Math.abs(+info.format.duration - D) < 0.3);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
