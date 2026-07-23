import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function expectAutoplayCycle(page, { moveMouseAway = true } = {}) {
  const target = process.env.SHIP_BASE_URL || '/';
  await page.goto(target, { waitUntil: 'domcontentloaded' });

  // Mantém o ponteiro fora do carrossel: hover deve pausar por design.
  if (moveMouseAway) await page.mouse.move(0, 0);

  const show = page.locator('#shipShow');
  await expect(show).toHaveAttribute('data-ready', 'true');
  await show.scrollIntoViewIfNeeded();
  await expect(show).toHaveAttribute('data-paused', 'false', { timeout: 2_000 });

  const before = Number(await show.getAttribute('data-current'));
  const total = Number(await show.getAttribute('data-total'));
  const expectedNext = before === total ? 1 : before + 1;

  const progress = show.locator('.ship-show__dots button[aria-current="true"]');
  const progressState = await progress.evaluate((element) => {
    const style = getComputedStyle(element, '::after');
    return {
      name: style.animationName,
      duration: style.animationDuration,
      playState: style.animationPlayState
    };
  });
  expect(progressState).toEqual({
    name: 'ship-thumb-progress',
    duration: '5s',
    playState: 'running'
  });

  // O intervalo editorial é 5s: não deve trocar cedo.
  await page.waitForTimeout(4_000);
  await expect(show).toHaveAttribute('data-current', String(before).padStart(2, '0'));

  // Após completar o ciclo, deve avançar exatamente uma foto.
  await expect.poll(
    async () => Number(await show.getAttribute('data-current')),
    { timeout: 2_000, intervals: [100] }
  ).toBe(expectedNext);
  await page.waitForTimeout(250);
  await expect(show).toHaveAttribute('data-current', String(expectedNext).padStart(2, '0'));

  return show;
}

test('carrossel do navio retoma autoplay e pausa somente durante hover', async ({ page }) => {
  const show = await expectAutoplayCycle(page);
  const box = await show.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(show).toHaveAttribute('data-paused', 'true');

  const pausedState = await show.locator('.ship-show__dots button[aria-current="true"]').evaluate((element) =>
    getComputedStyle(element, '::after').animationPlayState
  );
  expect(pausedState).toBe('paused');

  await page.mouse.move(0, 0);
  await expect(show).toHaveAttribute('data-paused', 'false');
});

test.describe('viewport touch/mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mantém a barra e a transição automática sem hover', async ({ page }) => {
    const show = await expectAutoplayCycle(page, { moveMouseAway: false });
    const metrics = await show.evaluate((element) => ({
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    expect(metrics.coarsePointer).toBe(true);
    expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
  });
});
