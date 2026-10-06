import { test, expect } from '@playwright/test';

test('Timeline scroll animation works across PT, EN and ES', async ({ page }) => {
  const urls = [
    { url: 'http://localhost:8085/manual-de-bordo.html', lang: 'pt' },
    { url: 'http://localhost:8085/en/manual-de-bordo.html', lang: 'en' },
    { url: 'http://localhost:8085/es/manual-de-bordo.html', lang: 'es' }
  ];

  for (const item of urls) {
    await page.goto(item.url);

    // Deve ter 4 abas e 4 grupos
    const tabs = page.locator('#cronograma .timeline-tab');
    await expect(tabs).toHaveCount(4);

    const groups = page.locator('#cronograma .timeline-group');
    await expect(groups).toHaveCount(4);

    const steps = page.locator('#cronograma .timeline-step');
    await expect(steps).toHaveCount(15);

    // Rola para a timeline
    await page.locator('#cronograma').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Primeiro step deve ter is-reached
    await expect(steps.first()).toHaveClass(/is-reached/);

    // Rola para o step 6 (embarque)
    await steps.nth(5).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const reachedCount = await page.locator('#cronograma .timeline-step.is-reached').count();
    const currentCount = await page.locator('#cronograma .timeline-step.is-current').count();

    expect(reachedCount).toBeGreaterThanOrEqual(5);
    expect(currentCount).toBe(1);

    // Testa toggle de colapsar da 2ª fase
    const toggle2 = page.locator('#cronograma .timeline-group__toggle').nth(1);
    await toggle2.click();
    await page.waitForTimeout(200);

    const group2 = groups.nth(1);
    await expect(group2).toHaveClass(/is-collapsed/);

    // Reabre
    await toggle2.click();
    await page.waitForTimeout(200);
    await expect(group2).not.toHaveClass(/is-collapsed/);
  }
});
