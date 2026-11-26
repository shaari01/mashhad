// المرحلة 2: النص العربي، والانتقالات، والسرعة، والمقاسات
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, saveExport, ffprobe, waitFor, frameColor } from './helpers.mjs';

test('المرحلة 2: نص عربي وانتقالات وسرعة ومقاسات', { timeout: 240000 }, async () => {
  const srv = await startServer(4175);
  const { browser, page, errors } = await openApp(srv.url);
  try {
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['clipA.webm', 'photo.jpg']);
    await waitFor(page, () => window.__app.project.clips.length === 2);

    // السرعة 2×
    await page.locator('#storyboard .card').nth(0).click();
    await page.click('[data-tool="speed"]');
    await page.locator('.sheet .chip', { hasText: '2×' }).first().click();
    let p = await proj(page);
    assert.equal(p.clips[0].speed, 2);
    let D = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(Math.abs(D - (2 + 3)) < 0.05, 'المدة بعد 2×: ' + D);
    // منحنى السرعة
    await page.locator('.sheet .chip', { hasText: 'بطيء ثم سريع' }).click();
    p = await proj(page);
    assert.equal(p.clips[0].curve, 'slowfast');
    await page.locator('.sheet .chip', { hasText: 'بلا منحنى' }).click();
    await page.click('#sheet-close');

    // الانتقال بين البطاقتين
    await page.click('#storyboard .tbtn');
    await page.locator('.sheet .chip', { hasText: 'عبر الأسود' }).click();
    p = await proj(page);
    assert.equal(p.clips[0].transition.type, 'black');
    D = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(Math.abs(D - (5 - 0.6)) < 0.05, 'الانتقال يداخل المقطعين: ' + D);
    await page.click('#sheet-close');

    // نص عربي
    await page.evaluate(() => window.__app.preview.seek(0.5));
    await page.click('[data-tool="text"]');
    await page.getByText('نص جديد').click();
    await page.fill('#sheet textarea', 'مرحبًا بالعالم\nلا إله إلا الله');
    await page.locator('#sheet textarea').dispatchEvent('change');
    await page.locator('.sheet .chip', { hasText: 'الأميري' }).click();
    p = await proj(page);
    assert.equal(p.texts.length, 1);
    assert.equal(p.texts[0].font, 'Amiri');
    // التشكيل العربي صحيح: «لا» تُرسم ككتلة واحدة (لام ألف) أعرض من الحرفين منفصلين؟
    const shaping = await page.evaluate(async () => {
      await document.fonts.load('40px "Amiri"', 'لا');
      const c = document.createElement('canvas').getContext('2d');
      c.font = '40px "Amiri"'; c.direction = 'rtl';
      const joined = c.measureText('سلام').width;
      const parts = ['س', 'ل', 'ا', 'م'].reduce((a, ch) => a + c.measureText(ch).width, 0);
      return { joined, parts };
    });
    assert.ok(Math.abs(shaping.joined - shaping.parts) > 2, 'الحروف متصلة (عرض مختلف عن الحروف المنفصلة)');
    // سحب النص على المعاينة
    await page.waitForTimeout(400);
    const box = await page.locator('#preview').boundingBox();
    const tx = p.texts[0];
    await page.mouse.move(box.x + box.width * tx.x, box.y + box.height * tx.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * tx.x, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();
    p = await proj(page);
    assert.ok(p.texts[0].y < 0.5, 'تحرك النص للأعلى: ' + p.texts[0].y);
    await page.click('#sheet-close');

    // المقاس 16:9
    await page.click('[data-tool="aspect"]');
    await page.locator('.sheet .chip', { hasText: '١٦:٩' }).click();
    p = await proj(page);
    assert.equal(p.aspect, '16:9');
    const cv = await page.$eval('#preview', (c) => [c.width, c.height]);
    assert.ok(cv[0] > cv[1], 'المعاينة عرضية');
    await page.locator('.sheet .seg button', { hasText: 'لون' }).click();
    p = await proj(page);
    assert.equal(p.background.type, 'color');
    await page.click('#sheet-close');
    await page.screenshot({ path: 'tests/out/phase2-ui.png' });

    // التصدير 720p
    await page.click('#btn-export');
    await page.locator('.modal .seg button', { hasText: '720p' }).click();
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 120000 });
    const file = await saveExport(page, 'phase2.mp4');
    const info = ffprobe(file);
    const v = info.streams.find((s) => s.codec_type === 'video');
    assert.equal(v.width, 1280); assert.equal(v.height, 720);
    assert.ok(Math.abs(+info.format.duration - 4.4) < 0.3, 'مدة ' + info.format.duration);
    // منتصف الانتقال عبر الأسود قرب 2.0 ث يكون داكنًا
    const mid = frameColor(file, 1.7);
    assert.ok(mid[0] + mid[1] + mid[2] < 120, 'الانتقال عبر الأسود: ' + mid);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
