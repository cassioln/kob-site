import { test, expect } from '@playwright/test';

const locales = [
  { prefix: '', lang: 'pt-BR', disabled: 'Opcional · desativada', saved: 'Preferências salvas. Apenas cookies necessários serão usados.' },
  { prefix: 'en/', lang: 'en', disabled: 'Optional · disabled', saved: 'Preferences saved. Only necessary cookies will be used.' },
  { prefix: 'es/', lang: 'es', disabled: 'Opcional · desactivada', saved: 'Preferencias guardadas. Solo se usarán cookies necesarias.' }
];
const group = 'https://chat.whatsapp.com/EiYEGnOpJrPGyhDzdz9888?mode=gi_t';
const royal = 'https://api.whatsapp.com/send?phone=5513981580498';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent_status', 'denied'));
  await page.route(/https:\/\/(www\.googletagmanager\.com|www\.google-analytics\.com)\/.*/, route => route.abort());
});

for (const locale of locales) {
  test(`Atendimento ${locale.lang}: canais reais e nenhum cadastro ativo`, { tag: '@smoke' }, async ({ page }) => {
    await page.goto(`/${locale.prefix}manual-de-bordo.html#contato`);
    const contact = page.locator('#contato');
    await expect(contact.locator('.support-channel-card')).toHaveCount(3);
    const groupLink = contact.locator('[data-support-channel="group"] a');
    await expect(groupLink).toHaveAttribute('href', group);
    await expect(groupLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(contact.locator(`a[href="${royal}"]`)).toBeVisible();
    await expect(page.locator('#supportForm, #supportModal, [data-open-support-modal], #newsletterEmailOpt, #newsletterWhatsappOpt')).toHaveCount(0);
    const policy = contact.locator(`a[href="https://kriativosonboard.com.br/${locale.prefix}politica-de-privacidade.html"]`);
    await expect(policy).toBeVisible();
    await groupLink.focus();
    await expect(groupLink).toBeFocused();

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await contact.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const boxes = await contact.locator('.support-channel-card').evaluateAll(cards => cards.map(card => {
        const { left, right } = card.getBoundingClientRect();
        return { left, right, viewport: innerWidth };
      }));
      expect(boxes.every(box => box.left >= 0 && box.right <= box.viewport)).toBe(true);
    }
  });

  test(`Privacidade ${locale.lang}: conteúdo, escolhas e metadados localizados`, async ({ page }) => {
    await page.goto(`/${locale.prefix}politica-de-privacidade.html`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale.lang);
    await expect(page.locator('main section')).toHaveCount(8);
    await expect(page.locator('#privacidade-newsletter + p')).toContainText('Sender.net');
    await expect(page.locator('main')).not.toContainText(/15.*dias úteis|100%|14 \(quatorze\) meses/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://kriativosonboard.com.br/${locale.prefix}politica-de-privacidade.html`);
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(4);
    await expect(page.locator('time')).toHaveAttribute('datetime', '2026-10-08');
    await page.locator('main [data-cookie-preferences]').click();
    await expect(page.locator('[data-cookie-panel]')).toBeVisible();
    await expect(page.locator('[data-cookie-service="google-analytics-4"]')).not.toBeChecked();
    await expect(page.locator('[data-cookie-category-status="analytics"]')).toHaveText(locale.disabled);
    await page.locator('[data-cookie-action="save"]').click();
    await expect(page.locator('#cookie-consent-status')).toHaveText(locale.saved);
    expect(await page.evaluate(() => localStorage.getItem('cookie_consent_status'))).toBe('denied');
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Guia ${locale.lang}: destinos de navegação e metadados públicos`, async ({ page }) => {
    await page.goto(`/${locale.prefix}manual-de-bordo.html`);
    const missing = await page.locator('a[href^="#"]').evaluateAll(links => links
      .map(link => link.getAttribute('href'))
      .filter(href => href.length > 1 && href !== '#checklist' && !document.getElementById(href.slice(1))));
    expect(missing).toEqual([]);
    await expect(page.locator('footer.guide-footer a[href="#duvidas"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://manualdebordo.kriativosonboard.com.br/${locale.prefix}`);
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(4);
    await expect(page.locator('#checklistContainer [data-checklist-id]')).toHaveCount(25);
    await expect(page.locator('#duvidas details.faq-item')).toHaveCount(42);
    expect(await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.every(script => {
      try { return Boolean(JSON.parse(script.textContent)); } catch { return false; }
    }))).toBe(true);
  });

  for (const storageMode of ['invalid', 'blocked']) {
    test(`Checklist ${locale.lang}: continua utilizável com storage ${storageMode}`, async ({ page }) => {
      await page.addInitScript(mode => {
        if (mode === 'invalid') localStorage.setItem('kob_embarcados_checklist_2026_v1', '{invalid');
        else Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      }, storageMode);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${locale.prefix}manual-de-bordo.html#checklist`);
      const checkbox = page.locator('[data-checklist-id="reserva-dados"] .checklist-item__checkbox');
      await expect(checkbox).toBeVisible();
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await expect(page.locator('#checklistSidebarToggleBadge')).toHaveText('1/18');
      await checkbox.uncheck();
      await expect(page.locator('#checklistSidebarToggleBadge')).toHaveText('0/18');
      await expect(page.locator('#contato [data-support-channel="group"] a')).toHaveAttribute('href', group);
    });
  }
}

test.describe('Canais essenciais sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const locale of locales) {
    test(`${locale.lang}: guia e atendimento não exigem script nem cadastro`, async ({ page }) => {
      await page.goto(`/${locale.prefix}manual-de-bordo.html#contato`);
      await expect(page.locator(`#contato a[href="${royal}"]`)).toBeVisible();
      await expect(page.locator('#contato [data-support-channel="group"] a')).toHaveAttribute('href', group);
      await expect(page.locator('#duvidas details.faq-item')).toHaveCount(42);
      await expect(page.locator('#supportForm')).toHaveCount(0);
    });
  }
});
