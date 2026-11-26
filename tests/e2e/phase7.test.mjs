// ملاحظات علي بعد التجربة: أيقونات صغيرة بمجموعات، و✓/✕ مع المعاينة، ومنزلقات آمنة، وأدوات الفيديو والصوت والنص، والمكتبة
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, waitFor, tool, setSlider } from './helpers.mjs';

test('ملاحظات علي: الواجهة والأدوات الجديدة', { timeout: 240000 }, async () => {
  const srv = await startServer(4181);
  const { browser, page, errors } = await openApp(srv.url);
  try {
    // المجموعات الأربع وأدواتها
    for (const [tab, toolId] of [['video', 'reverse'], ['image', 'pip'], ['audio', 'narrator'], ['text', 'lyrics']]) {
      await page.click(`[data-tab="${tab}"]`);
      assert.ok(await page.locator(`[data-tool="${toolId}"]`).isVisible(), `${toolId} في ${tab}`);
    }
    assert.equal(await page.locator('[data-tool="template"]').count(), 0, 'لا قوالب');
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['clipA.webm', 'photo.jpg']);
    await waitFor(page, () => window.__app.project.clips.length === 2);
    await page.locator('#storyboard .card').first().click();

    // ✕ يلغي و✓ يعتمد، مع المعاينة الحية
    await tool(page, 'filter');
    assert.ok(await page.locator('#toolbar').isHidden(), 'اللوحة تحل محل الأدوات على الجوال');
    await page.locator('.sheet .chip', { hasText: 'تصوير ليلي' }).click();
    assert.equal((await proj(page)).clips[0].filter, 'nightshot', 'يظهر الأثر فورًا');
    await page.click('#sheet-cancel');
    assert.equal((await proj(page)).clips[0].filter || 'none', 'none', '✕ ألغى الفلتر');
    await tool(page, 'filter');
    await page.locator('.sheet .chip', { hasText: 'تصوير نهاري' }).click();
    await page.click('#sheet-close');
    assert.equal((await proj(page)).clips[0].filter, 'dayshot', '✓ اعتمد الفلتر');

    // المنزلق لا يتغير بلمس المسار أو تمرير الإصبع عليه، ويتغير بسحب المقبض
    await tool(page, 'filter');
    await page.locator('.sheet .seg button', { hasText: 'تعديل' }).click();
    const tr = page.locator('.sheet .srange[aria-label="السطوع"]');
    const b = await tr.boundingBox();
    await tr.evaluate((el, b) => {
      const ev = (t, x) => el.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', pointerId: 7, bubbles: true, clientX: x, clientY: b.y + b.height / 2 }));
      ev('pointerdown', b.x + 8); ev('pointermove', b.x + 60); ev('pointerup', b.x + 60);
    }, b);
    assert.equal((await proj(page)).clips[0].adjust?.brightness || 0, 0, 'لم يتغير بالتمرير');
    const th = await page.locator('.sheet .srange[aria-label="السطوع"] .thumb').boundingBox();
    await page.mouse.move(th.x + th.width / 2, th.y + th.height / 2);
    await page.mouse.down();
    await page.mouse.move(th.x + th.width / 2 - 40, th.y + th.height / 2, { steps: 5 });
    await page.mouse.up();
    assert.ok((await proj(page)).clips[0].adjust.brightness > 0.1, 'سحب المقبض لليسار يزيد');
    await page.locator('.sheet button[aria-label="زد التباين"]').click();
    assert.ok((await proj(page)).clips[0].adjust.contrast > 0, 'زر + يزيد');
    await page.click('#sheet-close');

    // عكس وكتم
    await tool(page, 'reverse');
    await tool(page, 'mute');
    let p = await proj(page);
    assert.equal(p.clips[0].reverse, true);
    assert.equal(p.clips[0].muted, true);

    // موسيقى وراوٍ معًا، مع التسريع والتلاشي
    await tool(page, 'music');
    await chooseFiles(page, () => page.getByRole('button', { name: 'أضف موسيقى من ملفاتك' }).click(), ['music.mp3']);
    await waitFor(page, () => window.__app.project.audio.length === 1);
    await page.click('#sheet-close');
    await tool(page, 'narrator');
    await chooseFiles(page, () => page.getByRole('button', { name: 'أضف صوت الراوي من ملفاتك' }).click(), ['beats.mp3']);
    await waitFor(page, () => window.__app.project.audio.some((a) => a.kind === 'voice'));
    await setSlider(page, 'السرعة', 1.5);
    await setSlider(page, 'تلاشٍ في النهاية', 1);
    await page.click('#sheet-close');
    p = await proj(page);
    const v = p.audio.find((a) => a.kind === 'voice');
    assert.equal(p.audio.length, 2);
    assert.equal(v.speed, 1.5);
    assert.equal(v.fadeOut, 1);

    // نص بتوقيت دقيق للأغاني وحركات ظهور
    await page.evaluate(() => window.__app.preview.seek(0.3));
    await tool(page, 'text');
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.locator('.sheet .seg button', { hasText: 'التوقيت' }).click();
    await page.getByLabel('يظهر عند (ثانية)').fill('1.25');
    await page.getByLabel('يظهر عند (ثانية)').dispatchEvent('change');
    let t = (await proj(page)).texts[0];
    assert.equal(t.start, 1.25);
    await page.locator('.sheet .trow').nth(1).getByRole('button', { name: '+0.05' }).click();
    t = (await proj(page)).texts[0];
    assert.ok(Math.abs(t.end - 3.35) < 1e-6, 'النهاية زادت 0.05: ' + t.end);
    await page.evaluate(() => window.__app.preview.seek(2.5));
    await page.locator('.sheet .trow').nth(1).getByRole('button', { name: 'من المؤشر' }).click();
    assert.ok(Math.abs((await proj(page)).texts[0].end - 2.5) < 0.02);
    await page.locator('.sheet .seg button', { hasText: 'الحركة' }).click();
    await page.locator('.sheet .chip', { hasText: 'آلة كاتبة' }).first().click();
    assert.equal((await proj(page)).texts[0].animIn, 'type');
    assert.equal(await page.locator('.sheet .chip', { hasText: 'دوران' }).count(), 0, 'الحركات الإضافية للابتوب فقط');
    await page.click('#sheet-close');

    // المكتبة: إخفاء فلتر، وإضافة خط ثم حذفه
    await page.click('#btn-menu');
    await page.getByRole('button', { name: 'المكتبة' }).click();
    await page.locator('.modal .seg button', { hasText: 'التأثيرات' }).click();
    await page.locator('.modal .chip', { hasText: 'تصوير ليلي' }).click();
    await page.locator('.modal .seg button', { hasText: 'الخطوط' }).click();
    await chooseFiles(page, () => page.getByRole('button', { name: 'أضف خطًا' }).click(), ['myfont.woff2']);
    await waitFor(page, () => document.querySelectorAll('.modal .list-item').length >= 9);
    await page.click('#modal-close');
    await tool(page, 'filter');
    assert.equal(await page.locator('.sheet .chip', { hasText: 'تصوير ليلي' }).count(), 0, 'الفلتر المخفي لا يظهر');
    await page.click('#sheet-close');
    await page.locator('#storyboard .card').first().click();
    await tool(page, 'text');
    await page.locator('.sheet .chip', { hasText: 'اكتب هنا' }).first().click();
    await page.locator('.sheet .seg button', { hasText: 'الخط واللون' }).click();
    assert.ok(await page.locator('.sheet .chip', { hasText: 'myfont' }).count() === 1, 'الخط المضاف يظهر');
    await page.click('#sheet-close');
    await page.click('#btn-menu');
    await page.getByRole('button', { name: 'المكتبة' }).click();
    await page.locator('.modal .seg button', { hasText: 'الخطوط' }).click();
    await page.locator('.modal .list-item', { hasText: 'myfont' }).getByRole('button').last().click();
    await page.getByRole('button', { name: 'احذف' }).click();
    await waitFor(page, () => !document.querySelector('.modal')?.textContent.includes('myfont') || document.querySelector('.modal').classList.contains('hidden'));
    await page.screenshot({ path: 'tests/out/phase7.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});

test('على اللابتوب: حركات نص إضافية وصف الأدوات', { timeout: 120000 }, async () => {
  const srv = await startServer(4182);
  const { browser, page, errors } = await openApp(srv.url, { mobile: false });
  try {
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['photo.jpg']);
    await waitFor(page, () => window.__app.project.clips.length === 1);
    await tool(page, 'text');
    await page.getByRole('button', { name: 'نص جديد' }).click();
    await page.locator('.sheet .seg button', { hasText: 'الحركة' }).click();
    for (const k of ['دوران', 'ارتداد', 'سقوط الكلمات', 'توهج']) assert.ok(await page.locator('.sheet .chip', { hasText: k }).count() >= 1, k);
    await page.locator('.sheet .chip', { hasText: 'سقوط الكلمات' }).first().click();
    await page.evaluate(() => window.__app.preview.seek(0.15));
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tests/out/phase7-desktop.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
