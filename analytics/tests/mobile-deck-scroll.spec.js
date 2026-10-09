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

for (const prefix of ['', 'en/', 'es/']) {
  test(`${prefix || 'pt'}: arrasto vertical nos dois sentidos avança as cartas`, { tag: prefix ? [] : '@smoke' }, async ({ page }) => {
    const fan = await visitDeck(page, prefix);
    const before = await fan.evaluate(el => el.scrollLeft);
    const pageBefore = await page.evaluate(() => scrollY);
    await drag(page, 0, -120);
    const afterDown = await fan.evaluate(el => el.scrollLeft);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(pageBefore + 30);
    expect(afterDown).toBeGreaterThan(before + 30);
    const pageAfterDown = await page.evaluate(() => scrollY);
    await drag(page, 0, 120);
    expect(await page.evaluate(() => scrollY)).toBeLessThan(pageAfterDown - 30);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeGreaterThan(afterDown + 30);
    const beforeHorizontal = await fan.evaluate(el => el.scrollLeft);
    await drag(page, -150, 0);
    expect(await fan.evaluate(el => el.scrollLeft)).toBeGreaterThan(beforeHorizontal + 30);
  });
}

test('não move as cartas com navegação programática, fora da seção ou no desktop', async ({ page }) => {
  const fan = await visitDeck(page);
  await page.evaluate(() => scrollBy(0, 80));
  await page.waitForTimeout(250);
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
  await page.locator('#navio').scrollIntoViewIfNeeded();
  const before = await fan.evaluate(el => el.scrollLeft);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.synthesizeScrollGesture', { x: 160, y: 450, yDistance: -100, gestureSourceType: 'touch' });
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(before);
  await session.detach();
  await page.setViewportSize({ width: 1024, height: 900 });
  await fan.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await drag(page, 0, -120);
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
});

test('movimento reduzido preserva a rolagem vertical sem avanço automático', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fan = await visitDeck(page);
  const before = await page.evaluate(() => scrollY);
  await drag(page, 0, -120);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 30);
  expect(await fan.evaluate(el => el.scrollLeft)).toBe(0);
});
