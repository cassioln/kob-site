import { test, expect } from '@playwright/test';

test.describe('Internacionalização e Validação de Páginas /en/ e /es/', () => {

  test('Página /en/ carrega com idioma, seletor e seção FAQ íntegra', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en/');
    await expect(page).toHaveTitle(/Kriativos On Board/i);
    
    // Valida atributo lang
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');

    // Valida seletor de idioma desktop
    const langSwitch = page.locator('.nav__right .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__btn.is-active')).toHaveText('EN');

    // Valida seção do FAQ
    const faq = page.locator('#faq');
    await expect(faq).toBeVisible();

    // Valida as 4 categorias de FAQ
    const navLinks = faq.locator('[data-faq-nav]');
    await expect(navLinks).toHaveCount(4);

    // Valida total de 28 perguntas no FAQ
    const details = faq.locator('.faq__list details');
    await expect(details).toHaveCount(28);

    // Valida busca no FAQ em inglês
    const searchInput = page.locator('#faq-search');
    await searchInput.fill('luggage');
    const status = page.locator('#faq-search-status');
    await expect(status).toHaveText(/1 answer found/i);

    // Limpa busca
    await searchInput.fill('');
    await expect(status).toHaveText(/28 answers organized by topic/i);

    // Valida modal de cabines em inglês
    await page.getByRole('tab', { name: /Cabins/i }).click();
    await page.getByRole('button', { name: /View Details/i }).first().click();
    const cabinModal = page.locator('#cabinModal');
    await expect(cabinModal).toBeVisible();
    await expect(page.locator('#cabinModalTitle')).toHaveText(/The comfort and elegance you need/i);
    // Valida imagens das cartas no deck em inglês
    await expect(page.locator('.deck__card--jogos img')).toHaveAttribute('src', '/assets/images/story/cards/carta-jogos-en.webp');
    await expect(page.locator('.deck__card--monitoria img')).toHaveAttribute('src', '/assets/images/story/cards/carta-monitoria-en.webp');
    // Valida imagem da carta bônus em inglês
    const bonusCardImg = page.locator('.deck__bonus-card img');
    await expect(bonusCardImg).toHaveAttribute('src', '/assets/images/story/cards/carta-bonus-en.webp');
  });

  test('Página /es/ carrega com idioma, seletor e seção FAQ íntegra', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/es/');
    await expect(page).toHaveTitle(/Kriativos On Board/i);
    
    // Valida atributo lang
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('es');

    // Valida seletor de idioma desktop
    const langSwitch = page.locator('.nav__right .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__btn.is-active')).toHaveText('ES');

    // Valida seção do FAQ
    const faq = page.locator('#faq');
    await expect(faq).toBeVisible();

    // Valida as 4 categorias de FAQ
    const navLinks = faq.locator('[data-faq-nav]');
    await expect(navLinks).toHaveCount(4);

    // Valida total de 28 perguntas no FAQ
    const details = faq.locator('.faq__list details');
    await expect(details).toHaveCount(28);

    // Valida busca no FAQ em espanhol
    const searchInput = page.locator('#faq-search');
    await searchInput.fill('equipaje');
    const status = page.locator('#faq-search-status');
    await expect(status).toHaveText(/1 respuesta encontrada/i);

    // Limpa busca
    await searchInput.fill('');
    await expect(status).toHaveText(/28 respuestas organizadas por tema/i);

    // Valida modal de cabines em espanhol
    await page.getByRole('tab', { name: /Cabinas/i }).click();
    await page.getByRole('button', { name: /Ver Detalles/i }).first().click();
    const cabinModal = page.locator('#cabinModal');
    await expect(cabinModal).toBeVisible();
    await expect(page.locator('#cabinModalTitle')).toHaveText(/El confort y la elegancia que necesita/i);
    // Valida imagens das cartas no deck em espanhol
    await expect(page.locator('.deck__card--hero img')).toHaveAttribute('src', '/assets/images/story/cards/carta-diversao-garantida-es.webp');
    await expect(page.locator('.deck__card--jogos img')).toHaveAttribute('src', '/assets/images/story/cards/carta-jogos-es.webp');
    await expect(page.locator('.deck__card--monitoria img')).toHaveAttribute('src', '/assets/images/story/cards/carta-monitoria-es.webp');
    // Valida imagem da carta bônus em espanhol
    const bonusCardImg = page.locator('.deck__bonus-card img');
    await expect(bonusCardImg).toHaveAttribute('src', '/assets/images/story/cards/carta-bonus-es.webp');
  });

  test('Página de ônibus /onibus.html carrega em PT com seletor de idiomas e validações ativas', async ({ page }) => {
    await page.goto('/onibus.html');
    await expect(page).toHaveTitle(/Busão Kriativo 2026/i);

    // Valida atributo lang
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('pt-BR');

    // Valida seletor de idioma no header
    const langSwitch = page.locator('.bus-header .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__item.is-active')).toHaveText('PT');

    // Preenche contato principal
    await page.locator('#primary-name').fill('Maria da Silva');
    await page.locator('#primary-cpf').fill('52998224725');
    await page.locator('#primary-birth').fill('15/05/1990');
    await page.locator('#primary-whatsapp').fill('11987654321');
    await page.locator('#primary-email').fill('maria.silva@exemplo.com');

    // Avança para etapa 2
    await page.locator('#bus-form [data-wizard-step="1"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="2"]')).toBeVisible();

    // Marca vou sozinho
    await page.locator('#solo-traveler').check();

    // Avança para etapa 3
    await page.locator('#bus-form [data-wizard-step="2"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="3"]')).toBeVisible();
    await expect(page.locator('#review-passengers-list')).toContainText('MARIA DA SILVA');
  });

  test('Página de ônibus /en/onibus.html carrega em EN com seletor de idiomas e fluxo do wizard', async ({ page }) => {
    await page.goto('/en/onibus.html');
    await expect(page).toHaveTitle(/Kriativo Shuttle 2026/i);

    // Valida atributo lang
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');

    // Valida seletor de idioma no header
    const langSwitch = page.locator('.bus-header .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__item.is-active')).toHaveText('EN');

    // Preenche contato principal
    await page.locator('#primary-name').fill('John Doe');
    await page.locator('#primary-cpf').fill('52998224725');
    await page.locator('#primary-birth').fill('20/10/1988');
    await page.locator('#primary-whatsapp').fill('11999998888');
    await page.locator('#primary-email').fill('john.doe@example.com');

    // Avança para etapa 2
    await page.locator('#bus-form [data-wizard-step="1"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="2"]')).toBeVisible();

    // Marca vou sozinho
    await page.locator('#solo-traveler').check();

    // Avança para etapa 3
    await page.locator('#bus-form [data-wizard-step="2"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="3"]')).toBeVisible();
    await expect(page.locator('#review-passengers-list')).toContainText('JOHN DOE');
    await expect(page.locator('#review-passengers-list')).toContainText('Primary Contact');
  });

  test('Página de ônibus /es/onibus.html carrega em ES com seletor de idiomas e fluxo do wizard', async ({ page }) => {
    await page.goto('/es/onibus.html');
    await expect(page).toHaveTitle(/Bus Kriativo 2026/i);

    // Valida atributo lang
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('es');

    // Valida seletor de idioma no header
    const langSwitch = page.locator('.bus-header .lang-switch');
    await expect(langSwitch).toBeVisible();
    await expect(langSwitch.locator('.lang-switch__item.is-active')).toHaveText('ES');

    // Preenche contato principal
    await page.locator('#primary-name').fill('Carlos Santana');
    await page.locator('#primary-cpf').fill('52998224725');
    await page.locator('#primary-birth').fill('05/03/1992');
    await page.locator('#primary-whatsapp').fill('11977776666');
    await page.locator('#primary-email').fill('carlos.santana@ejemplo.com');

    // Avança para etapa 2
    await page.locator('#bus-form [data-wizard-step="1"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="2"]')).toBeVisible();

    // Marca vou sozinho
    await page.locator('#solo-traveler').check();

    // Avança para etapa 3
    await page.locator('#bus-form [data-wizard-step="2"] [data-action="next-step"]').click();
    await expect(page.locator('#bus-form [data-wizard-step="3"]')).toBeVisible();
    await expect(page.locator('#review-passengers-list')).toContainText('CARLOS SANTANA');
    await expect(page.locator('#review-passengers-list')).toContainText('Contacto Principal');
  });

  test('Tradução interativa de depoimentos respeita o idioma da página e toggle de texto', async ({ page }) => {
    // 1. Página em Português
    await page.goto('/');
    const davidQuotePT = page.locator('.quote[data-voice-id="david"]');
    const vitalQuotePT = page.locator('.quote[data-voice-id="vital"]');

    // Em PT, Vital (original PT) não deve ter botão de tradução
    await expect(vitalQuotePT.locator('.quote__trans-btn')).toHaveCount(0);

    // Em PT, David (original EN) deve ter botão "Traduzir"
    const davidBtnPT = davidQuotePT.locator('.quote__trans-btn');
    await expect(davidBtnPT).toBeVisible();
    await expect(davidBtnPT).toContainText(/Traduzir/i);
    await expect(davidQuotePT.locator('p')).toContainText(/Epitome of friendliness and fun/i);

    // Clica para traduzir para PT
    await davidBtnPT.click();
    await expect(davidQuotePT.locator('p')).toContainText(/O epítome da simpatia e da diversão/i);
    await expect(davidBtnPT).toContainText(/Original/i);

    // Clica para voltar ao original
    await davidBtnPT.click();
    await expect(davidQuotePT.locator('p')).toContainText(/Epitome of friendliness and fun/i);
    await expect(davidBtnPT).toContainText(/Traduzir/i);

    // 2. Página em Inglês (/en/)
    await page.goto('/en/');
    const davidQuoteEN = page.locator('.quote[data-voice-id="david"]');
    const vitalQuoteEN = page.locator('.quote[data-voice-id="vital"]');

    // Em EN, David (original EN) não deve ter botão de tradução
    await expect(davidQuoteEN.locator('.quote__trans-btn')).toHaveCount(0);

    // Em EN, Vital (original PT) deve ter botão "Translate"
    const vitalBtnEN = vitalQuoteEN.locator('.quote__trans-btn');
    await expect(vitalBtnEN).toBeVisible();
    await expect(vitalBtnEN).toContainText(/Translate/i);
    await expect(vitalQuoteEN.locator('p')).toContainText(/Foi uma experiência única/i);

    // Clica para traduzir para EN
    await vitalBtnEN.click();
    await expect(vitalQuoteEN.locator('p')).toContainText(/It was a unique experience/i);
    await expect(vitalBtnEN).toContainText(/Original/i);

    // 3. Página em Espanhol (/es/)
    await page.goto('/es/');
    const davidQuoteES = page.locator('.quote[data-voice-id="david"]');
    const vitalQuoteES = page.locator('.quote[data-voice-id="vital"]');

    // Em ES, ambos são diferentes de ES, então ambos devem ter botão "Traducir"
    const davidBtnES = davidQuoteES.locator('.quote__trans-btn');
    const vitalBtnES = vitalQuoteES.locator('.quote__trans-btn');
    await expect(davidBtnES).toBeVisible();
    await expect(davidBtnES).toContainText(/Traducir/i);
    await expect(vitalBtnES).toBeVisible();
    await expect(vitalBtnES).toContainText(/Traducir/i);

    // Clica para traduzir David para ES
    await davidBtnES.click();
    await expect(davidQuoteES.locator('p')).toContainText(/El epítome de la amabilidad/i);
    await expect(davidBtnES).toContainText(/Original/i);

    // Clica para traduzir Vital para ES
    await vitalBtnES.click();
    await expect(vitalQuoteES.locator('p')).toContainText(/Fue una experiencia única/i);
    await expect(vitalBtnES).toContainText(/Original/i);
  });

  test('Seletor de idiomas no header mantém posição fixa e estável independente do idioma', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Posição no PT
    await page.goto('/');
    const switchPT = page.locator('.nav__right .lang-switch');
    await expect(switchPT).toBeVisible();
    const boxPT = await switchPT.boundingBox();

    // 2. Posição no EN
    await page.goto('/en/');
    const switchEN = page.locator('.nav__right .lang-switch');
    await expect(switchEN).toBeVisible();
    const boxEN = await switchEN.boundingBox();

    // 3. Posição no ES
    await page.goto('/es/');
    const switchES = page.locator('.nav__right .lang-switch');
    await expect(switchES).toBeVisible();
    const boxES = await switchES.boundingBox();

    // A borda direita (x + width) deve ser exatamente igual em todas as versões
    expect(boxPT.x + boxPT.width).toBeCloseTo(boxEN.x + boxEN.width, 1);
    expect(boxPT.x + boxPT.width).toBeCloseTo(boxES.x + boxES.width, 1);
    expect(boxPT.y).toBeCloseTo(boxEN.y, 1);
    expect(boxPT.y).toBeCloseTo(boxES.y, 1);

    // Valida que ao rolar a página (scrolled=true), o seletor some do header
    await page.locator('#navio').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await expect(page.locator('header.nav')).toHaveAttribute('data-scrolled', 'true');
    await expect(page.locator('.nav__right .lang-switch')).toBeHidden();

    // Valida que ao retornar ao topo (hero), o seletor reaparece
    await page.locator('#top, .hero').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await expect(page.locator('header.nav')).toHaveAttribute('data-scrolled', 'false');
    await expect(page.locator('.nav__right .lang-switch')).toBeVisible();
  });

  test('Aviso de moeda em BRL e cotação USD/EUR presente somente nas páginas EN e ES', async ({ page }) => {
    // 1. Página PT (não deve conter o aviso de moeda na home nem no modal nem no ônibus)
    await page.goto('/');
    await expect(page.locator('#valores .currency-notice')).toHaveCount(0);
    await expect(page.locator('#insuranceModal .cabin-modal__currency-hint')).toHaveCount(0);

    await page.goto('/onibus.html');
    await expect(page.locator('.bus-hero__currency-hint')).toHaveCount(0);

    // 2. Página EN (home, modal de seguro e página de ônibus)
    await page.goto('/en/');
    const noticeEN = page.locator('#valores .currency-notice');
    await expect(noticeEN).toBeVisible();
    await expect(noticeEN).toContainText(/Brazilian Reais/i);
    await expect(noticeEN.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);
    await expect(noticeEN.locator('[data-currency-rate="EUR"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);

    const modalHintEN = page.locator('#insuranceModal .cabin-modal__currency-hint');
    await expect(modalHintEN).toContainText(/Brazilian Reais/i);
    await expect(modalHintEN.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);

    await page.goto('/en/onibus.html');
    const busHintEN = page.locator('.bus-hero__currency-hint');
    await expect(busHintEN).toBeVisible();
    await expect(busHintEN.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);

    // 3. Página ES (home, modal de seguro e página de ônibus)
    await page.goto('/es/');
    const noticeES = page.locator('#valores .currency-notice');
    await expect(noticeES).toBeVisible();
    await expect(noticeES).toContainText(/Reales Brasileños/i);
    await expect(noticeES.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);
    await expect(noticeES.locator('[data-currency-rate="EUR"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);

    const modalHintES = page.locator('#insuranceModal .cabin-modal__currency-hint');
    await expect(modalHintES).toContainText(/Reales Brasileños/i);
    await expect(modalHintES.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);

    await page.goto('/es/onibus.html');
    const busHintES = page.locator('.bus-hero__currency-hint');
    await expect(busHintES).toBeVisible();
    await expect(busHintES.locator('[data-currency-rate="USD"]')).toContainText(/R\$\s*\d+[,.]\d{2}/);
  });

  test('Redirecionamento automático baseado no idioma do navegador e persistência de preferência', async ({ browser }) => {
    // 1. Visitante com navegador em inglês acessando a raiz (deve redirecionar para /en/)
    const contextEN = await browser.newContext({ locale: 'en-US' });
    const pageEN = await contextEN.newPage();
    await pageEN.goto('/');
    await expect(pageEN).toHaveURL(/\/en\//);
    await contextEN.close();

    // 2. Visitante com navegador em espanhol acessando a raiz (deve redirecionar para /es/)
    const contextES = await browser.newContext({ locale: 'es-ES' });
    const pageES = await contextES.newPage();
    await pageES.goto('/');
    await expect(pageES).toHaveURL(/\/es\//);
    await contextES.close();

    // 3. Visitante com navegador em português acessando a raiz (deve permanecer na raiz /)
    const contextPT = await browser.newContext({ locale: 'pt-BR' });
    const pagePT = await contextPT.newPage();
    await pagePT.goto('/');
    await expect(pagePT).toHaveURL(/\/$/);

    // 4. Se o usuário estiver em /en/ e clicar manualmente em "PT", salva preferência e não redireciona mais
    await pagePT.goto('/en/');
    await pagePT.locator('.nav__right .lang-switch__btn[hreflang="pt-BR"]').click();
    await expect(pagePT).toHaveURL(/\/$/);

    // Valida que ao recarregar a raiz '/', permanece em '/'
    await pagePT.goto('/');
    await expect(pagePT).toHaveURL(/\/$/);
    await contextPT.close();

    // 5. Parâmetro de override ?noredirect=1 ou ?lang=pt
    const contextOverride = await browser.newContext({ locale: 'en-US' });
    const pageOverride = await contextOverride.newPage();
    await pageOverride.goto('/?lang=pt');
    await expect(pageOverride).toHaveURL(/\/\?lang=pt$/);
    await contextOverride.close();
  });

});

