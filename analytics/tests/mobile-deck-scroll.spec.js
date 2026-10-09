import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });

async function visitDeck(page, prefix = '') {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.goto(`/${prefix}?lang=${prefix.slice(0, 2) || 'pt'}`);
  const fan = page.locator('#embarque .deck__fan');
  await fan.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(fan).toBeVisible();
  await page.waitForTimeout(300);
  return fan;
}

async function drag(page, dx, dy) {
  const session = await page.context().newCDPSession(page);
  const box = await page.locator('#embarque .deck__fan').boundingBox();
  const x = Math.min(340, Math.max(50, box.x + box.width / 2));
  const y = Math.min(550, Math.max(270, box.y + box.height / 2));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 10, y: y + dy * step / 10 }] });
    await page.waitForTimeout(step === 5 ? 250 : 30);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  await session.detach();
}

async function pinRange(fan) {
  return fan.evaluate(el => {
    const frame = el.parentElement;
    const track = frame.parentElement;
    const start = track.getBoundingClientRect().top + scrollY - parseFloat(frame.style.top);
    return { start, end: start + el.scrollWidth - el.clientWidth };
  });
}

for (const prefix of ['', 'en/', 'es/']) {
  test(`${prefix || 'pt'}: cartas fixas, sequência reversível e saída pelos dois limites`, { tag: prefix ? [] : '@smoke' }, async ({ page }) => {
    const fan = await visitDeck(page, prefix);
    const range = await pinRange(fan);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), range.start + 200);
    await page.waitForTimeout(100);
    const top = (await fan.boundingBox()).y;
    const before = await fan.evaluate(el => el.scrollLeft);
    await drag(page, 0, -120);
    const afterDown = await fan.evaluate(el => el.scrollLeft);
    expect(afterDown).toBeGreaterThan(before + 30);
    expect(Math.abs((await fan.boundingBox()).y - top)).toBeLessThanOrEqual(2);
    await drag(page, 0, 120);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeLessThan(afterDown - 30);
    expect(Math.abs((await fan.boundingBox()).y - top)).toBeLessThanOrEqual(2);

    const beforeHorizontal = await fan.evaluate(el => el.scrollLeft);
    await drag(page, -150, 80);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeGreaterThan(beforeHorizontal + 30);
    expect(Math.abs((await fan.boundingBox()).y - top)).toBeLessThanOrEqual(2);
    const beforeReverse = await fan.evaluate(el => el.scrollLeft);
    await drag(page, 150, -80);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeLessThan(beforeReverse - 30);
    expect(Math.abs((await fan.boundingBox()).y - top)).toBeLessThanOrEqual(2);

    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), range.end);
    await page.waitForTimeout(100);
    const last = await fan.evaluate(el => el.scrollLeft);
    await drag(page, 0, -120);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeCloseTo(last, 0);
    expect((await fan.boundingBox()).y).toBeLessThan(top - 30);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), range.end + 40);
    await drag(page, 0, 120);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeLessThan(last - 20);
    expect(Math.abs((await fan.boundingBox()).y - top)).toBeLessThanOrEqual(2);

    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), range.start);
    await page.waitForTimeout(100);
    await drag(page, 0, 120);
    expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
    expect((await fan.boundingBox()).y).toBeGreaterThan(top + 30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('fora da seção e no desktop a página mantém a rolagem habitual', async ({ page }) => {
  const fan = await visitDeck(page);
  await page.locator('#navio').scrollIntoViewIfNeeded();
  const before = await fan.evaluate(el => el.scrollLeft);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.synthesizeScrollGesture', { x: 160, y: 450, yDistance: -100, gestureSourceType: 'touch' });
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(before);
  await session.detach();
  await page.setViewportSize({ width: 1024, height: 900 });
  await fan.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const top = (await fan.boundingBox()).y;
  await drag(page, 0, -120);
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
  expect((await fan.boundingBox()).y).toBeLessThan(top - 30);
});

test('movimento reduzido mantém cartas manuais e o arrasto lateral não rola a página', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fan = await visitDeck(page);
  const before = await page.evaluate(() => scrollY);
  await drag(page, 0, -120);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 30);
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
  const beforeHorizontal = await page.evaluate(() => scrollY);
  await drag(page, -150, 80);
  expect(await fan.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  expect(Math.abs(await page.evaluate(() => scrollY) - beforeHorizontal)).toBeLessThanOrEqual(2);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 560, height: 320 }]) {
  test(`cartas completas em ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fan = await visitDeck(page);
    const range = await pinRange(fan);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), range.start + 100);
    await page.waitForTimeout(150);
    const box = await fan.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(15);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 15);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeGreaterThan(90);
  });
}
