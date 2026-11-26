// المرحلة 1: البطاقات، والإضافة، والقص والتقسيم، والموسيقى، وتصدير MP4، والحفظ، والعمل بلا إنترنت
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, canvasStats, saveExport, ffprobe, waitFor, meanVolume , tool, setSlider } from './helpers.mjs';

test('المرحلة 1 كاملة في متصفح جوال', { timeout: 240000 }, async () => {
  const srv = await startServer(4173);
  const { browser, ctx, page, errors } = await openApp(srv.url);
  try {
    // الواجهة عربية من اليمين لليسار
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    const toolSize = await page.$eval('.tool', (e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(toolSize[0] >= 44 && toolSize[0] <= 80 && toolSize[1] >= 44 && toolSize[1] <= 56, 'أيقونات صغيرة بأسلوب فيفافيديو مع مساحة لمس كافية: ' + toolSize);
    assert.equal(await page.locator('#tabs .tab').count(), 4, 'أربع مجموعات');

    // إضافة فيديو وصورة وفيديو
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['clipA.webm', 'photo.jpg', 'clipB.mp4']);
    await waitFor(page, () => window.__app.project.clips.length === 3);
    assert.equal(await page.locator('#storyboard .card:not(.add)').count(), 3);
    let p = await proj(page);
    assert.deepEqual(p.clips.map((c) => c.type), ['video', 'image', 'video']);
    await page.waitForTimeout(800);
    const st = await canvasStats(page);
    assert.ok(st.std > 5, 'المعاينة تعرض صورة');

    // التقسيم عند المؤشر
    await page.evaluate(() => window.__app.preview.seek(2));
    await tool(page, 'split');
    await waitFor(page, () => window.__app.project.clips.length === 4);
    p = await proj(page);
    assert.ok(Math.abs(p.clips[0].out - 2) < 0.05);

    // القص بالمقابض (السحب)
    await page.locator('#storyboard .card').nth(0).click();
    await tool(page, 'trim');
    await page.waitForSelector('.trimmer .h');
    const tr = await page.$eval('.trimmer', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const hA = page.locator('.trimmer .h').first();
    const hb = await hA.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tr.x + tr.w * 0.9, hb.y + hb.height / 2, { steps: 5 }); // البداية عند 10٪ (من اليمين)
    await page.mouse.up();
    p = await proj(page);
    assert.ok(p.clips[0].in > 0.2 && p.clips[0].in < 0.6, 'قُصّت البداية: ' + p.clips[0].in);
    await page.click('#sheet-close');

    // التراجع والإعادة
    const before = p.clips[0].in;
    await page.click('#btn-undo');
    p = await proj(page);
    assert.equal(p.clips[0].in, 0);
    await page.click('#btn-redo');
    p = await proj(page);
    assert.equal(p.clips[0].in, before);

    // إعادة الترتيب بالسحب (فأرة)
    const ids = p.clips.map((c) => c.id);
    const c0 = await page.locator('#storyboard .card').nth(0).boundingBox();
    const c2 = await page.locator('#storyboard .card').nth(2).boundingBox();
    await page.mouse.move(c0.x + c0.width / 2, c0.y + c0.height / 2);
    await page.mouse.down();
    await page.mouse.move(c2.x + 10, c2.y + c2.height / 2, { steps: 8 });
    await page.mouse.up();
    p = await proj(page);
    assert.notEqual(p.clips[0].id, ids[0], 'تغيّر الترتيب');
    assert.equal(p.clips.length, 4);

    // الموسيقى
    await tool(page, 'music');
    await chooseFiles(page, () => page.getByText('أضف موسيقى من ملفاتك').click(), ['music.mp3']);
    await waitFor(page, () => window.__app.project.audio.length === 1);
    p = await proj(page);
    const total = await page.evaluate(() => window.__app.preview.duration);
    assert.ok(Math.abs(p.audio[0].out - Math.min(10, total)) < 0.05, 'قُصت الموسيقى على طول الفيديو');
    await page.click('#sheet-close');

    // تشغيل المعاينة
    await page.evaluate(() => window.__app.preview.seek(0));
    await page.click('#btn-play');
    await page.waitForTimeout(1200);
    const t = await page.evaluate(() => window.__app.preview.time);
    assert.ok(t > 0.5, 'التشغيل يتقدم: ' + t);
    await page.click('#btn-play');

    // التصدير MP4
    await page.click('#btn-export');
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 120000 });
    const stats = await page.evaluate(() => window.__lastExport.stats);
    const file = await saveExport(page, 'phase1.mp4');
    const info = ffprobe(file);
    const v = info.streams.find((s) => s.codec_type === 'video');
    const a = info.streams.find((s) => s.codec_type === 'audio');
    assert.ok(v && a, 'فيديو وصوت');
    assert.equal(v.width, 1080); assert.equal(v.height, 1920);
    assert.ok(Math.abs(+info.format.duration - total) < 0.3, `المدة ${info.format.duration} ≈ ${total}`);
    assert.ok(meanVolume(file, 1, 2) > -40, 'في الملف صوت مسموع');
    console.log('export stats', JSON.stringify(stats));
    await page.click('#modal-close');

    // الحفظ التلقائي والاستعادة بعد إعادة التحميل
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]');
    p = await proj(page);
    assert.equal(p.clips.length, 4);
    assert.equal(p.audio.length, 1);
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.card.missing').count(), 0, 'الملفات متاحة بعد إعادة الفتح');

    // العمل بلا إنترنت (عامل الخدمة)
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]');
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    assert.equal(await page.locator('#storyboard .card:not(.add)').count(), 4, 'يعمل بلا إنترنت');
    await ctx.setOffline(false);

    await page.screenshot({ path: 'tests/out/phase1.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
