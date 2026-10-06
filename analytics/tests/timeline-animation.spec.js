import { test, expect } from '@playwright/test';

test('Timeline animated track and gold marker works across PT, EN and ES', async ({ page }) => {
  const routes = [
    { url: 'http://localhost:8085/manual-de-bordo.html', lang: 'pt' },
    { url: 'http://localhost:8085/en/manual-de-bordo.html', lang: 'en' },
    { url: 'http://localhost:8085/es/manual-de-bordo.html', lang: 'es' }
  ];

  for (const item of routes) {
    await page.goto(item.url);

    // Trilha animada deve existir e estar visível
    const track = page.locator('#cronograma .timeline__track');
    await expect(track).toBeVisible();

    // Rola para a timeline
    await page.locator('#cronograma').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const steps = page.locator('#cronograma .timeline-step');
    await expect(steps).toHaveCount(15);

    // Primeiro step deve ter is-reached e is-current inicialmente
    await expect(steps.first()).toHaveClass(/is-reached/);

    // Rola para o 5º step
    await steps.nth(4).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const currentStep = page.locator('#cronograma .timeline-step.is-current');
    await expect(currentStep).toHaveCount(1);

    // Verifica que --timeline-progress foi calculado
    const timelineEl = page.locator('#cronograma .timeline');
    const styleAttr = await timelineEl.getAttribute('style');
    expect(styleAttr).toContain('--timeline-progress:');
    const match = styleAttr.match(/--timeline-progress:\s*([0-9.]+)%/);
    expect(match).not.toBeNull();
    const progressVal = parseFloat(match[1]);
    expect(progressVal).toBeGreaterThan(0);
  }
});
