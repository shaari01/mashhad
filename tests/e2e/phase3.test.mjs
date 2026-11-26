// المرحلة 3: كلمات الأغاني بالنقر، والكاراوكي، وعلامات الإيقاع
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, chooseFiles, proj, saveExport, ffprobe, waitFor, canvasStats , tool, setSlider } from './helpers.mjs';

test('المرحلة 3: كلمات بالنقر وكاراوكي وإيقاع', { timeout: 240000 }, async () => {
  const srv = await startServer(4176);
  const { browser, page, errors } = await openApp(srv.url);
  try {
    await chooseFiles(page, () => page.click('#btn-empty-add'), ['photo.jpg', 'photo.jpg', 'clipA.webm']);
    await waitFor(page, () => window.__app.project.clips.length === 3);
    await tool(page, 'music');
    await chooseFiles(page, () => page.getByText('أضف موسيقى من ملفاتك').click(), ['beats.mp3']);
    await waitFor(page, () => window.__app.project.audio.length === 1);
    await page.click('#sheet-close');

    // الكلمات
    await tool(page, 'lyrics');
    await page.fill('#sheet textarea', 'يا ليل يا عين\nالسطر الثاني من الأغنية\nوالثالث');
    await page.getByText('التالي: التوقيت').click();
    await page.getByText('ابدأ التشغيل').click();
    await page.waitForTimeout(500);
    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'انقر عند بداية السطر' }).click(); await page.waitForTimeout(900); }
    await page.getByRole('button', { name: 'انتهى' }).click();
    let p = await proj(page);
    const lyr = p.texts.filter((t) => t.lyric);
    assert.equal(lyr.length, 3, 'ثلاثة أسطر على الفيديو');
    assert.ok(lyr[0].start < lyr[1].start && lyr[1].start < lyr[2].start, 'الأسطر مرتبة زمنيًا');
    assert.ok(Math.abs(lyr[1].start - lyr[0].start - 0.9) < 0.5, 'الفارق يقارب زمن النقر: ' + (lyr[1].start - lyr[0].start));
    assert.ok(lyr.every((t) => t.karaoke), 'الكاراوكي مفعّل');
    assert.equal(lyr[0].end, lyr[1].start);
    // تعديل دقيق
    const s0 = lyr[0].start;
    await page.locator('.sheet .list-item').first().locator('button').nth(1).click();
    p = await proj(page);
    assert.ok(Math.abs(p.texts.find((t) => t.lyric).start - (s0 + 0.1)) < 0.001);
    // الكاراوكي يلوّن: لقطة منتصف السطر الأول تحوي لون الكاراوكي الأصفر
    const tmid = (p.lyrics.lines[0].start + p.lyrics.lines[0].end) / 2;
    await page.evaluate((t) => window.__app.preview.seek(t), tmid);
    await page.waitForTimeout(400);
    const yellow = await page.evaluate(() => {
      const c = document.querySelector('#preview'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 190 && d[i + 2] < 60) n++; return n;
    });
    assert.ok(yellow > 30, 'بكسلات الكاراوكي الصفراء: ' + yellow);
    await page.click('#sheet-close');

    // الإيقاع: كشف تلقائي ثم توزيع المقاطع
    await tool(page, 'beats');
    await page.getByText('اكشف الإيقاع تلقائيًا').click();
    await waitFor(page, () => window.__app.project.beats.length > 5);
    p = await proj(page);
    const gaps = p.beats.slice(1).map((b, i) => b - p.beats[i]);
    const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    assert.ok(Math.abs(med - 0.5) < 0.05, 'الفاصل بين العلامات ≈ 0.5 ث: ' + med);
    await page.getByText('وزّع المقاطع على العلامات').click();
    p = await proj(page);
    // كل نهاية مقطع (عدا الأخير) تقع على علامة
    const durs = p.clips.map((c) => (c.type === 'image' ? c.duration : (c.out - c.in) / c.speed));
    let t = 0;
    for (let i = 0; i < durs.length - 1; i++) { t += durs[i]; assert.ok(p.beats.some((b) => Math.abs(b - t) < 0.02), `القطع ${i + 1} على علامة (${t})`); }
    // النقر اليدوي
    const n0 = p.beats.length;
    await page.getByText('مسح الكل').click();
    await page.getByText('ابدأ التشغيل والنقر').click();
    await page.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'انقر مع الإيقاع' }).click(); await page.waitForTimeout(300); }
    await page.getByText('توقف واحفظ').click();
    p = await proj(page);
    assert.equal(p.beats.length, 3);
    assert.ok(n0 > 3);
    await page.click('#sheet-close');
    await page.waitForTimeout(500);
    const cs = await canvasStats(page);
    console.log('DBG', JSON.stringify(cs), JSON.stringify(await page.evaluate(() => { const pv = window.__app.preview; return { t: pv.time, playing: pv.playing, dirty: pv.dirty, els: [...pv.els.entries()].map(([k, e]) => [k, e.el.readyState, e.el.seeking, e.el.currentTime]) }; })));
    await page.screenshot({ path: 'tests/out/phase3.png' });

    // التصدير
    await page.click('#btn-export');
    await page.locator('.modal .seg button', { hasText: '720p' }).click();
    await page.getByText('صدّر الفيديو MP4').click();
    await page.waitForSelector('.verdict', { timeout: 120000 });
    const file = await saveExport(page, 'phase3.mp4');
    assert.ok(ffprobe(file).streams.length === 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.stop();
  }
});
