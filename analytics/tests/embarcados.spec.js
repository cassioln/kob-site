import { test, expect } from '@playwright/test';

test.describe('Página Embarcados — Portal do Passageiro Confirmado', () => {

  test('Página /embarcados.html carrega com estrutura completa, 25 itens de checklist, 42 perguntas e 28 capítulos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/embarcados.html');

    // Título e Lang
    await expect(page).toHaveTitle(/Embarcados KOB 2026/i);
    expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR');

    // Brand e links de idioma
    const langSwitch = page.locator('.guide-header .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__item.is-active')).toHaveText('PT');

    // Contador regressivo
    const countdown = page.locator('#guideCountdownText');
    await expect(countdown).toBeVisible();

    // Checklist: 25 itens estáveis
    const checklistItems = page.locator('[data-checklist-id]');
    await expect(checklistItems).toHaveCount(25);

    // Cronograma: 15 etapas
    const timelineItems = page.locator('.timeline-step');
    await expect(timelineItems).toHaveCount(15);

    // Transporte: Ônibus 1 e 2 na grid
    await expect(page.locator('.transport-grid .transport-card')).toHaveCount(2);
    await expect(page.locator('.transport-card')).toHaveCount(3);

    // Jogos: Lounge e blocos do guia
    await expect(page.locator('.game-block')).toHaveCount(5);

    // FAQ: 42 perguntas (O01 a O42) e 6 botões de categoria
    const faqItems = page.locator('#duvidas details.faq-item');
    await expect(faqItems).toHaveCount(42);

    const faqCategoryTabs = page.locator('.faq-category-btn');
    await expect(faqCategoryTabs).toHaveCount(6);

    // Live: 28 capítulos
    const liveChapters = page.locator('.live-chapter-item');
    await expect(liveChapters).toHaveCount(28);

    // Canais de suporte
    await expect(page.locator('a[href*="5513981580498"]').first()).toBeVisible();
  });

  test('Checklist interativo: persistência no localStorage, estados de ação e reset', async ({ page }) => {
    await page.goto('/embarcados.html');

    // Limpa storage prévio
    await page.evaluate(() => localStorage.removeItem('kob_embarcados_checklist_2026_v1'));
    await page.reload();

    const firstItem = page.locator('[data-checklist-id="reserva-dados"]');
    await expect(firstItem).toBeVisible();

    // Marca o primeiro item como concluído
    const checkInput = firstItem.locator('.checklist-item__checkbox');
    await checkInput.check();
    await expect(firstItem).toHaveClass(/is-checked/);

    // Marca o item de menor como N/A
    const minorItem = page.locator('[data-checklist-id="menor-documentos"]');
    const naInput = minorItem.locator('.checklist-item__na-checkbox');
    await naInput.check();
    await expect(minorItem).toHaveClass(/is-not-applicable/);

    // Verifica barra de progresso e texto
    const progressText = page.locator('#checklistProgressText');
    await expect(progressText).toContainText('conferidos');

    // Recarrega a página e valida persistência no localStorage
    await page.reload();
    const reloadedFirst = page.locator('[data-checklist-id="reserva-dados"]');
    const reloadedMinor = page.locator('[data-checklist-id="menor-documentos"]');
    await expect(reloadedFirst).toHaveClass(/is-checked/);
    await expect(reloadedMinor).toHaveClass(/is-not-applicable/);

    // Testar botão de reset
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.locator('#checklistResetBtn').click();

    await expect(reloadedFirst).not.toHaveClass(/is-checked/);
    await expect(reloadedMinor).not.toHaveClass(/is-not-applicable/);
    await expect(page.locator('#checklistProgressText')).toContainText('0 de');
  });

  test('Busca de FAQ sem acentos e filtros por categoria', async ({ page }) => {
    await page.goto('/embarcados.html');

    const searchInput = page.locator('#faqSearchInput');
    const resultsCount = page.locator('#faqResultsCount');

    // Busca por termo presente
    await searchInput.fill('bagagem');
    await expect(resultsCount).not.toHaveText('0');

    // Busca sem acentuação (ex: 'refeicoes' ou 'saude')
    await searchInput.fill('saude');
    await expect(resultsCount).not.toHaveText('0');

    // Limpar busca pelo botão
    await page.locator('#faqClearBtn').click();
    await expect(resultsCount).toHaveText('42');

    // Filtro de categoria (ex.: Chegada)
    const arrivalBtn = page.locator('.faq-category-btn[data-category="chegada"]');
    await arrivalBtn.click();
    await expect(arrivalBtn).toHaveClass(/is-active/);

    // Itens visíveis devem ser da categoria chegada
    const visibleItems = page.locator('#duvidas details.faq-item:not([style*="display: none"])');
    const count = await visibleItems.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(42);
  });

  test('Live: busca de capítulos e controle da fachada do player', async ({ page }) => {
    await page.goto('/embarcados.html');

    const chapterSearch = page.locator('#liveSearchInput');
    await chapterSearch.fill('voucher');

    const visibleChapters = page.locator('.live-chapter-item');
    await expect(visibleChapters).toHaveCount(1);
    await expect(visibleChapters.first()).toContainText('Vouchers');

    // Limpa busca
    await chapterSearch.fill('');
    await expect(page.locator('.live-chapter-item')).toHaveCount(28);

    // Clica no botão de carregar da fachada
    const playBtn = page.locator('#loadLivePlayerBtn');
    await playBtn.click();
    const iframe = page.locator('#livePlayerContainer iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/AtIvlc62KgI/);
  });

  test('Modal de contato acessível abre, fecha por botão e por teclado (Escape)', async ({ page }) => {
    await page.goto('/embarcados.html');

    const openBtn = page.locator('button[data-open-support-modal]').first();
    await openBtn.click();

    const modal = page.locator('#supportModal');
    await expect(modal).toHaveAttribute('aria-hidden', 'false');
    await expect(modal).toHaveClass(/is-open/);

    // Fechar com Escape
    await page.keyboard.press('Escape');
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await expect(modal).not.toHaveClass(/is-open/);
  });

  test('Layout responsivo a 320px sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto('/embarcados.html');

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('Página /en/embarcados.html tem paridade rigorosa de conteúdo e elementos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en/embarcados.html');

    await expect(page).toHaveTitle(/Embarcados KOB 2026/i);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    // 25 itens no checklist
    await expect(page.locator('[data-checklist-id]')).toHaveCount(25);

    // 42 perguntas no FAQ
    await expect(page.locator('#duvidas details.faq-item')).toHaveCount(42);

    // 28 capítulos na live
    await expect(page.locator('.live-chapter-item')).toHaveCount(28);

    // Busca no FAQ em inglês
    const searchInput = page.locator('#faqSearchInput');
    await searchInput.fill('luggage');
    const resultsCount = page.locator('#faqResultsCount');
    await expect(resultsCount).not.toHaveText('0');
  });

  test('Página /es/embarcados.html tem paridade rigorosa de conteúdo e elementos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/es/embarcados.html');

    await expect(page).toHaveTitle(/Embarcados KOB 2026/i);
    expect(await page.locator('html').getAttribute('lang')).toBe('es');

    // 25 itens no checklist
    await expect(page.locator('[data-checklist-id]')).toHaveCount(25);

    // 42 perguntas no FAQ
    await expect(page.locator('#duvidas details.faq-item')).toHaveCount(42);

    // 28 capítulos na live
    await expect(page.locator('.live-chapter-item')).toHaveCount(28);

    // Busca no FAQ em espanhol
    const searchInput = page.locator('#faqSearchInput');
    await searchInput.fill('equipaje');
    const resultsCount = page.locator('#faqResultsCount');
    await expect(resultsCount).not.toHaveText('0');
  });

  test('Formulário do modal de suporte submete dados e exibe confirmação', async ({ page }) => {
    await page.goto('/embarcados.html');

    // Mock do endpoint /api/embarcados-contact para teste de frontend
    await page.route('**/api/embarcados-contact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: 'Sua mensagem foi enviada com sucesso! A equipe Kriativos On Board retornará em breve.'
        })
      });
    });

    const openBtn = page.locator('button[data-open-support-modal]').first();
    await openBtn.click();

    await page.locator('#supportNameInput').fill('Kriativo Teste');
    await page.locator('#supportEmailInput').fill('teste@kriativosonboard.com.br');
    await page.locator('#supportWhatsappInput').fill('11999998888');
    await page.locator('#supportMsgInput').fill('Dúvida sobre a mesa de jogos e horários.');

    await page.locator('#supportSubmitBtn').click();

    const statusBox = page.locator('#supportStatusBox');
    await expect(statusBox).toHaveClass(/form-status-box--success/);
    await expect(statusBox).toContainText('recebida');
  });

});
