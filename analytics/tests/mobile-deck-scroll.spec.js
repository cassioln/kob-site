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
  const last = await fan.evaluate(el => el.scrollWidth - el.clientWidth);
  await expect.poll(() => fan.evaluate(el => el.scrollLeft)).toBe(last);
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

async function bonusState(card) {
  return card.evaluate(el => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const reflection = getComputedStyle(el, '::after');
    return {
      scale: Math.hypot(matrix.a, matrix.b),
      angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
      reflectionX: new DOMMatrixReadOnly(reflection.transform).m41,
      reflectionOpacity: Number(reflection.opacity)
    };
  });
}

for (const prefix of ['', 'en/', 'es/']) {
  test(`${prefix || 'pt'}: zoom, giro e reflexo da carta bônus revertem com o scroll`, { tag: prefix ? [] : '@smoke' }, async ({ page }) => {
    await visitDeck(page, prefix);
    const card = page.locator('.deck__bonus-card');
    await card.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(1000);
    await page.evaluate(() => scrollBy({ top: -160, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const initialY = await page.evaluate(() => scrollY);
    const before = await bonusState(card);
    const beforeBox = await card.boundingBox();
    await page.evaluate(() => scrollBy({ top: 160, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const middle = await bonusState(card);
    expect(middle.scale).toBeGreaterThan(before.scale + 0.005);
    expect(middle.scale).toBeLessThan(1.06);
    expect(middle.angle).toBeGreaterThan(before.angle + 0.5);
    expect(middle.reflectionX).toBeGreaterThan(before.reflectionX + 20);
    expect(middle.reflectionOpacity).toBeGreaterThan(0.5);
    expect((await card.boundingBox()).y).toBeLessThan(beforeBox.y - 100);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), initialY);
    await page.waitForTimeout(100);
    const reversed = await bonusState(card);
    expect(reversed.scale).toBeCloseTo(before.scale, 3);
    expect(reversed.angle).toBeCloseTo(before.angle, 2);
    expect(reversed.reflectionX).toBeCloseTo(before.reflectionX, 1);
    expect(await card.getAttribute('href')).toBe('#navio');
  });
}

test('carta bônus também acompanha o scroll no desktop e respeita movimento reduzido', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visitDeck(page);
  const card = page.locator('.deck__bonus-card');
  await card.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(1000);
  const before = await bonusState(card);
  await page.evaluate(() => scrollBy({ top: 120, behavior: 'instant' }));
  await page.waitForTimeout(100);
  expect((await bonusState(card)).scale).toBeGreaterThan(before.scale + 0.005);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const reduced = await bonusState(card);
  await page.evaluate(() => scrollBy({ top: -120, behavior: 'instant' }));
  await page.waitForTimeout(100);
  expect(await bonusState(card)).toEqual(reduced);
});

async function fanPositions(fan) {
  return fan.locator('.deck__card').evaluateAll(cards => cards.map(el => {
    const box = el.getBoundingClientRect();
    return { x: box.x + box.width / 2, transform: getComputedStyle(el).transform };
  }));
}

test.describe('leque sincronizado nas telas maiores', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  for (const prefix of ['', 'en/', 'es/']) {
    test(`${prefix || 'pt'}: abre atrás da carta central até o meio da tela e mantém o hover`, { tag: prefix ? [] : '@smoke' }, async ({ page }) => {
      const fan = await visitDeck(page, prefix);
      const start = await fan.evaluate(el => el.parentElement.getBoundingClientRect().top + scrollY + el.parentElement.offsetHeight / 2 - innerHeight);
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), start);
      await page.waitForTimeout(1000);
      const closed = await fanPositions(fan);
      for (const card of closed) expect(Math.abs(card.x - closed[2].x)).toBeLessThan(2);
      await page.evaluate(() => scrollBy({ top: innerHeight / 4, behavior: 'instant' }));
      await page.waitForTimeout(100);
      const middle = await fanPositions(fan);
      expect(middle[0].x).toBeLessThan(closed[0].x - 50);
      expect(middle[4].x).toBeGreaterThan(closed[4].x + 50);
      await page.evaluate(() => scrollBy({ top: innerHeight / 4, behavior: 'instant' }));
      await page.waitForTimeout(200);
      const open = await fanPositions(fan);
      expect(open[0].x).toBeLessThan(middle[0].x - 50);
      expect(open[4].x).toBeGreaterThan(middle[4].x + 50);
      const frame = await fan.locator('..').boundingBox();
      expect(frame.y + frame.height / 2).toBeCloseTo(450, 0);
      const first = fan.locator('.deck__card').first();
      const beforeHover = await first.boundingBox();
      await first.hover();
      await page.waitForTimeout(900);
      expect((await first.boundingBox()).y).toBeLessThan(beforeHover.y - 30);
      await page.mouse.move(0, 0);
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), start);
      await page.waitForTimeout(150);
      const reversed = await fanPositions(fan);
      for (let i = 0; i < reversed.length; i++) expect(reversed[i].x).toBeCloseTo(closed[i].x, 0);
    });
  }

  test('tablet abre o leque sem fixar a página e movimento reduzido mantém as cartas abertas', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const fan = await visitDeck(page);
    const top = (await fan.boundingBox()).y;
    await page.evaluate(() => scrollBy({ top: -150, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const before = await fanPositions(fan);
    await page.evaluate(() => scrollBy({ top: 150, behavior: 'instant' }));
    await page.waitForTimeout(150);
    expect((await fanPositions(fan))[0].x).toBeLessThan(before[0].x - 30);
    expect((await fan.boundingBox()).y).toBeCloseTo(top, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await fanPositions(fan);
    await page.evaluate(() => scrollBy({ top: -150, behavior: 'instant' }));
    await page.waitForTimeout(100);
    expect((await fanPositions(fan)).map(el => el.transform)).toEqual(reduced.map(el => el.transform));
    expect((await fan.boundingBox()).y).toBeGreaterThan(top + 100);
  });
});
