import { test, expect } from '@playwright/test';

// Reserva A: confirmada, 2 passageiros, Bruno desistiu (só Ana segue ativa).
// Reserva B: desistente inteira (status_chave 'desistente'), fora da frota.
const reservaA = {
  id: 'aaaa0001-1111-4111-8111-111111111111',
  code: 'AAAA0001',
  status: 'confirmed',
  status_chave: 'pago',
  status_rotulo: 'Pagamento aprovado',
  status_tom: 'ok',
  contato: 'Ana Souza',
  contato_cpf: '529.982.247-25',
  email: 'ana@example.com',
  contato_whatsapp: '(11) 99999-1111',
  pagantes: 1,
  criancas: 0,
  grupo: 'Grupo Alfa',
  valor: '240,00',
  valor_centavos: 24000,
  criado_em: '01/10/2026 10:00',
  pago_em: '01/10/2026 10:05',
  order_id: 'ORD-A',
  email_enviado: true,
  bus_number: 1,
  fleet_assignment_status: 'assigned',
  is_vip: false,
  desistente: false,
  updated_at: '2026-10-16 18:00:00',
  passageiros: [
    {
      id: '11', posicao: 1, nome: 'Ana Souza', cpf: '529.982.247-25', cpf_digitos: '52998224725', whatsapp: '(11) 99999-1111',
      whatsapp_digitos: '11999991111', email: 'ana@example.com', responsavel: true, menor: false, crianca_colo: false,
      nova_reserva: null, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '12', posicao: 2, nome: 'Bruno Lima', cpf: '123.456.789-09', cpf_digitos: '12345678909', whatsapp: '(11) 99999-2222',
      whatsapp_digitos: '11999992222', responsavel: false, menor: false, crianca_colo: false,
      nova_reserva: null, desistiu: true, desistiu_em: '16/10/2026 15:00', motivo_desistencia: 'Mudou de planos'
    }
  ]
};

const reservaB = {
  id: 'bbbb0002-2222-4222-8222-222222222222',
  code: 'BBBB0002',
  status: 'confirmed',
  status_chave: 'desistente',
  status_rotulo: 'Desistente',
  status_tom: 'falha',
  contato: 'Carla Dias',
  contato_cpf: '987.654.321-00',
  email: 'carla@example.com',
  contato_whatsapp: '(11) 99999-3333',
  pagantes: 0,
  criancas: 0,
  grupo: null,
  valor: '120,00',
  valor_centavos: 12000,
  criado_em: '02/10/2026 10:00',
  pago_em: '02/10/2026 10:05',
  order_id: 'ORD-B',
  email_enviado: true,
  bus_number: null,
  fleet_assignment_status: 'assigned',
  is_vip: false,
  desistente: true,
  updated_at: '2026-10-16 18:30:00',
  passageiros: [
    {
      id: '21', posicao: 1, nome: 'Carla Dias', cpf: '987.654.321-00', cpf_digitos: '98765432100', whatsapp: '(11) 99999-3333',
      whatsapp_digitos: '11999993333', responsavel: true, menor: false, crianca_colo: false,
      nova_reserva: null, desistiu: true, desistiu_em: '16/10/2026 16:00', motivo_desistencia: null
    }
  ]
};

const resposta = {
  reservas: [reservaA, reservaB],
  resumo: {
    total_a_bordo: 2,
    pagantes: 2,
    criancas_no_colo: 0,
    reservas_pagas: 2,
    reservas_pendentes: 0,
    reservas_falha: 0,
    reservas_desistentes: 1,
    receita_centavos: 36000,
    sem_telefone: 0
  },
  frota: {
    capacidade: 46,
    minimo: 40,
    sem_onibus_confirmado: [],
    onibus: [{
      numero: 1,
      ocupados: 2,
      assentos_ocupados: 2,
      vagas_livres: 44,
      pagantes: 2,
      criancas: 0,
      total: 2,
      assentos: 2,
      vip_inclusos: 1,
      reservas: [
        {
          id: reservaA.id, code: 'AAAA0001', grupo: 'Grupo Alfa', responsavel: 'Ana Souza',
          pagantes: 1, criancas: 0, total: 1, assentos: 1, is_vip: false, pago_em: '01/10/2026 10:05',
          passageiros: [{ posicao: 1, nome: 'Ana Souza', responsavel: true, menor: false, crianca_colo: false, faixa: '18 anos ou mais' }]
        },
        {
          id: 'vip_1', code: 'VIP 1', grupo: 'Lugar VIP', responsavel: 'Reserva VIP',
          pagantes: 1, criancas: 0, total: 1, assentos: 1, is_vip: true
        }
      ]
    }]
  }
};

// Reserva D: confirmada, grupo de quatro. Ana é a responsável; Bruno é adulto
// sem e-mail; Caio é menor; Duda vai no colo.
const reservaD = {
  ...reservaA,
  id: 'dddd0004-4444-4444-8444-444444444444',
  code: 'DDDD0004',
  grupo: 'Grupo Delta',
  contato: 'Ana Prado',
  email: 'ana.prado@example.com',
  contato_whatsapp: '(11) 98888-4141',
  pagantes: 3,
  criancas: 1,
  updated_at: '2026-10-16 19:00:00',
  passageiros: [
    {
      id: '41', posicao: 1, nome: 'Ana Prado', cpf: '714.602.380-01', cpf_digitos: '71460238001',
      whatsapp: '(11) 98888-4141', whatsapp_digitos: '11988884141', email: 'ana.prado@example.com',
      responsavel: true, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '42', posicao: 2, nome: 'Bruno Prado', cpf: '863.521.470-62', cpf_digitos: '86352147062',
      whatsapp: '(11) 98888-4242', whatsapp_digitos: '11988884242', email: null,
      responsavel: false, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '43', posicao: 3, nome: 'Caio Prado', cpf: '402.919.564-40', cpf_digitos: '40291956440',
      whatsapp: null, whatsapp_digitos: null, email: null,
      responsavel: false, menor: true, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '44', posicao: 4, nome: 'Duda Prado', cpf: '318.273.645-05', cpf_digitos: '31827364505',
      whatsapp: null, whatsapp_digitos: null, email: null,
      responsavel: false, menor: true, crianca_colo: true, desistiu: false, desistiu_em: null, motivo_desistencia: null
    }
  ]
};

// Reserva E: um adulto e uma criança de colo.
const reservaE = {
  ...reservaA,
  id: 'eeee0005-5555-4555-8555-555555555555',
  code: 'EEEE0005',
  grupo: 'Grupo Eco',
  contato: 'Eva Rocha',
  email: 'eva@example.com',
  pagantes: 1,
  criancas: 1,
  updated_at: '2026-10-16 20:00:00',
  passageiros: [
    {
      id: '51', posicao: 1, nome: 'Eva Rocha', cpf: '246.813.579-28', cpf_digitos: '24681357928',
      whatsapp: '(11) 97777-5151', whatsapp_digitos: '11977775151', email: 'eva@example.com',
      responsavel: true, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '52', posicao: 2, nome: 'Fábio Rocha', cpf: '135.792.468-28', cpf_digitos: '13579246828',
      whatsapp: null, whatsapp_digitos: null, email: null,
      responsavel: false, menor: true, crianca_colo: true, desistiu: false, desistiu_em: null, motivo_desistencia: null
    }
  ]
};

const ERRO_CAPACIDADE = 'O Ônibus 1 não tem vagas suficientes (0 livres; são necessárias 1).';

// Responde bus-admin-data com estas reservas e conta as chamadas. Registrada
// depois do beforeEach, tem prioridade sobre a rota padrão.
async function servirReservas(page, reservas) {
  const chamadas = { dados: 0 };
  await page.route('**/api/bus-admin-data*', route => {
    chamadas.dados += 1;
    return route.fulfill({ json: { ...resposta, reservas } });
  });
  return chamadas;
}

// Guarda cada POST de edição; `responder` decide a resposta.
async function capturarSalvamento(page, responder) {
  const pedidos = [];
  await page.route('**/api/bus-registration-update', route => {
    const pedido = route.request();
    pedidos.push({ corpo: pedido.postDataJSON(), token: pedido.headers()['x-admin-token'] });
    const resposta = responder
      ? responder(pedidos.length)
      : { status: 200, json: { success: true, registration_id: pedido.postDataJSON().registration_id, updated_at: '2026-10-16 21:00:00' } };
    return route.fulfill(resposta);
  });
  return pedidos;
}

async function abrirEdicao(page, codigo) {
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await page.getByRole('button', { name: 'Editar reserva #' + codigo }).click();
  const dialog = page.locator('#painel-editar-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

function item(dialog, nome) {
  return dialog.locator('.editar-passageiro').filter({ hasText: nome });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bus-boarding', route => route.fulfill({ json: { people: [], waiting: 0 } }));
  await page.route('**/api/bus-group-names', route => route.fulfill({
    json: { livres: ['Grupo Beta', 'Grupo Gama'], em_uso: ['Grupo Alfa', 'Grupo Delta', 'Grupo Eco'] }
  }));
  await page.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: { checked: 0, updated: 0 } }));
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(resposta)
  }));
});

test('lista mostra lápis por reserva, marca desistente e filtra Desistentes @smoke', async ({ page }) => {
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Editar reserva/ })).toHaveCount(2);

  const bruno = page.locator('tr', { hasText: 'Bruno' });
  await expect(bruno).toHaveClass(/tabela__linha--desistente/);
  await expect(bruno).toContainText('Desistiu');
  await expect(bruno).toContainText('16/10/2026 15:00');
  await expect(bruno.locator('.etiqueta--falha')).toHaveText('Desistiu');
  await expect(page.locator('tr', { hasText: 'Ana Souza' })).not.toHaveClass(/tabela__linha--desistente/);

  await page.getByRole('button', { name: 'Desistentes', exact: true }).click();
  await expect(page.locator('#tabela-corpo tr')).toHaveCount(1); // só a reserva B (1 passageiro)
  await expect(page.locator('#tabela-corpo tr')).toContainText('Carla Dias');
});

test('filtro sem ônibus confirmado não lista reserva desistente inteira', async ({ page }) => {
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await expect(page.locator('#tabela-corpo tr')).toHaveCount(3);

  await page.locator('#filtro-onibus').selectOption('sem-onibus');
  await expect(page.locator('#tabela-corpo tr')).toHaveCount(0);
});

test('card da frota tem lápis que não inicia arraste e VIP legado não tem @smoke', async ({ page }) => {
  const erros = [];
  page.on('pageerror', erro => erros.push(erro.message));
  page.on('console', mensagem => { if (mensagem.type() === 'error') erros.push(mensagem.text()); });

  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  const lapis = card.getByRole('button', { name: 'Editar reserva #AAAA0001' });
  await expect(lapis).toHaveCount(1);
  await expect(page.locator('.grupo-item').filter({ hasText: 'VIP 1' }).locator('.grupo-item__editar')).toHaveCount(0);
  // Só aparece com o card em foco (mouse sobre o card).
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect(lapis).toHaveCSS('opacity', '1');

  // O mousedown do lápis não pode chegar ao card (é o card que arrasta).
  await card.evaluate(elemento => {
    window.__cardMousedown = 0;
    elemento.addEventListener('mousedown', () => { window.__cardMousedown += 1; });
  });
  await lapis.scrollIntoViewIfNeeded();
  const caixa = await lapis.boundingBox();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await expect(card).not.toHaveClass(/dragging/);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__cardMousedown)).toBe(0);
  await expect(card).not.toHaveClass(/dragging/);

  // O clique real abre o modal da reserva, sem erro no console.
  const dialog = page.locator('#painel-editar-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  expect(erros).toEqual([]);
});

test('lápis do card flutua no canto e só aparece no card em foco', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  const lapis = card.locator('.grupo-item__editar');
  await card.scrollIntoViewIfNeeded();

  // (a) Em repouso (mouse longe do card) o lápis fica invisível, mas segue no DOM.
  await page.mouse.move(2, 2);
  await expect(lapis).toHaveCSS('opacity', '0');
  await expect(lapis).toHaveCSS('pointer-events', 'none');

  // (e) O lápis não ocupa o topo: ali ficam só o título e o código.
  const filhosDoTopo = await card.locator('.grupo-item__top').evaluate(
    topo => Array.from(topo.children).map(filho => filho.className)
  );
  expect(filhosDoTopo).toEqual(['grupo-item__titulo-wrap', expect.stringContaining('grupo-item__code')]);
  expect(await lapis.evaluate(el => el.parentElement.classList.contains('grupo-item'))).toBe(true);

  // (b) Com o mouse no card, o lápis aparece no quadrante superior direito.
  await card.hover();
  await expect(lapis).toHaveCSS('opacity', '1');
  await expect(lapis).toBeVisible();
  const cardBox = await card.boundingBox();
  const box = await lapis.boundingBox();
  expect(box.x + box.width).toBeGreaterThan(cardBox.x + cardBox.width * 0.75);
  expect(box.y).toBeLessThan(cardBox.y + 20);
  // Não encosta no código nem no botão Mover.
  const codigoBox = await card.locator('.grupo-item__code').boundingBox();
  // O lápis é redondo: o encontro dos retângulos nos cantos (até 4 px) não toca o código.
  const sobrepoe = (a, b, folga = 0) => a.x + folga < b.x + b.width && a.x + a.width - folga > b.x && a.y + folga < b.y + b.height && a.y + a.height - folga > b.y;
  expect(sobrepoe(box, codigoBox, 4)).toBe(false);
  const mover = card.locator('.grupo-item__mover-trigger');
  if (await mover.count()) expect(sobrepoe(box, await mover.boundingBox())).toBe(false);

  // Mover o mouse do card para o lápis mantém o lápis visível.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(lapis).toHaveCSS('opacity', '1');

  // (c) Teclado: o Tab alcança o lápis (continua na ordem de tabulação) e o revela.
  await page.mouse.move(2, 2);
  await expect(lapis).toHaveCSS('opacity', '0');
  await card.locator('.grupo-item__code').focus();
  await page.keyboard.press('Tab');
  await expect(lapis).toBeFocused();
  await expect(lapis).toHaveCSS('opacity', '1');

  // O card com lápis não perde largura no título em relação ao layout sem ele.
  const larguraTitulo = await card.locator('.grupo-item__titulo-wrap').evaluate(el => el.getBoundingClientRect().width);
  const semLapis = await page.evaluate(() => {
    const original = document.querySelector('.grupo-item__editar');
    const item = original.closest('.grupo-item');
    original.remove();
    return item.querySelector('.grupo-item__titulo-wrap').getBoundingClientRect().width;
  });
  expect(larguraTitulo).toBeCloseTo(semLapis, 1);
});

test('em tela de toque o lápis do card fica sempre visível', async ({ browser }) => {
  const contexto = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR'
  });
  const page = await contexto.newPage();
  await page.route('**/api/bus-boarding', route => route.fulfill({ json: { people: [], waiting: 0 } }));
  await page.route('**/api/bus-group-names', route => route.fulfill({ json: { livres: [], em_uso: [] } }));
  await page.route('**/api/bus-admin-reconcile*', route => route.fulfill({ json: { checked: 0, updated: 0 } }));
  await page.route('**/api/bus-admin-data*', route => route.fulfill({ json: resposta }));
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  const lapis = card.locator('.grupo-item__editar');
  await card.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches)).toBe(true);
  await expect(lapis).toHaveCSS('opacity', '1');
  await expect(lapis).toBeVisible();

  const cardBox = await card.boundingBox();
  const box = await lapis.boundingBox();
  expect(box.x + box.width).toBeGreaterThan(cardBox.x + cardBox.width * 0.75);
  expect(box.y).toBeLessThan(cardBox.y + 20);

  // Área de toque de 44 px, sem pegar o código ao lado.
  const alvo = await lapis.evaluate(el => {
    const antes = getComputedStyle(el, '::before');
    return { largura: parseFloat(antes.width), altura: parseFloat(antes.height), embaixo: parseFloat(antes.bottom) };
  });
  expect(alvo.embaixo).toBeGreaterThanOrEqual(0);
  expect(alvo.largura).toBeGreaterThanOrEqual(44);
  expect(alvo.altura).toBeGreaterThanOrEqual(44);
  await contexto.close();
});

test('arrastar a partir do lápis do card não move o card', async ({ page }) => {
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  const lapis = card.locator('.grupo-item__editar');
  await expect(lapis).toHaveAttribute('draggable', 'false');

  // Registra todo dragstart que chega ao card (inclusive com o card como alvo)
  // e se ele ganhou .dragging em algum momento.
  await card.evaluate(elemento => {
    window.__arraste = { dragstart: 0, cancelados: 0, dragging: false };
    elemento.addEventListener('dragstart', ev => {
      window.__arraste.dragstart += 1;
      // Depois dos outros handlers: o card só pode ver um arraste já cancelado.
      setTimeout(() => { if (ev.defaultPrevented) window.__arraste.cancelados += 1; }, 0);
    });
    new MutationObserver(() => {
      if (elemento.classList.contains('dragging')) window.__arraste.dragging = true;
    }).observe(elemento, { attributes: true, attributeFilter: ['class'] });
  });

  await lapis.scrollIntoViewIfNeeded();
  const caixa = await lapis.boundingBox();
  const x = caixa.x + caixa.width / 2;
  const y = caixa.y + caixa.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y + 4);
  await page.mouse.move(x + 8, y + 8);
  await page.mouse.up();

  const arraste = await page.evaluate(() => window.__arraste);
  expect(arraste.dragging).toBe(false);
  // Nenhum arraste vivo chega ao card: ou o navegador nem começa, ou ele já
  // chega cancelado.
  expect(arraste.dragstart).toBe(arraste.cancelados);
  await expect(card).not.toHaveClass(/dragging/);
});

test('grupo: remover o nome e depois escolher um nome livre', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const pedidos = await capturarSalvamento(page);

  let dialog = await abrirEdicao(page, 'AAAA0001');
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await dialog.locator('#editar-grupo').selectOption({ label: 'Sem nome de grupo' });
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].corpo).toHaveProperty('group_name', null);

  await page.getByRole('button', { name: 'Editar reserva #AAAA0001' }).click();
  dialog = page.locator('#painel-editar-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await expect(dialog.locator('#editar-grupo option')).toHaveCount(4);
  await dialog.locator('#editar-grupo').selectOption('Grupo Gama');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  expect(pedidos).toHaveLength(2);
  expect(pedidos[1].corpo.group_name).toBe('Grupo Gama');
});

test('grupo: falha ao carregar nomes livres mantém só o atual e avisa', async ({ page }) => {
  await page.route('**/api/bus-group-names', route => route.fulfill({ status: 500, json: { error: 'Falhou.' } }));
  await servirReservas(page, [reservaA, reservaB]);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  const aviso = dialog.locator('#editar-grupo-aviso');
  await expect(aviso).toBeHidden();
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Não foi possível carregar os nomes livres');
  await expect(dialog.locator('#editar-grupo')).toHaveAttribute('aria-describedby', 'editar-grupo-aviso');
  await expect(dialog.locator('#editar-grupo option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa (atual)']);
});

test('Esc duplo durante o salvamento não esconde o erro do servidor', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  let liberar;
  const segurado = new Promise(resolve => { liberar = resolve; });
  await page.route('**/api/bus-registration-update', async route => {
    await segurado;
    await route.fulfill({ status: 409, json: { error: ERRO_CAPACIDADE, code: 'capacity' } });
  });
  const dialog = await abrirEdicao(page, 'AAAA0001');
  await item(dialog, 'Ana Souza').locator('.editar-passageiro__resumo').click();
  await item(dialog, 'Ana Souza').getByLabel('Nome *').fill('Ana Souza Lima');
  const salvar = dialog.getByRole('button', { name: /Salvar alterações|Salvando/ });
  await salvar.click();
  await expect(salvar).toHaveAttribute('aria-busy', 'true');

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  liberar();

  await expect(dialog.locator('#editar-erro')).toHaveText(ERRO_CAPACIDADE);
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(d => d.open)).toBe(true);
  await expect(salvar).toHaveText('Salvar alterações');
});

test('campos e switch de cada passageiro são descritos pelo nome dele', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  for (const [id, nome] of [['11', 'Ana Souza'], ['12', 'Bruno Lima']]) {
    const nomeResumo = dialog.locator('#editar-p-' + id + '-resumo-nome');
    await expect(nomeResumo).toHaveText(nome);
    const painel = dialog.locator('#editar-p-' + id);
    const controles = painel.locator('input, select, textarea, [role="switch"]');
    await expect(controles).toHaveCount(7);
    for (const controle of await controles.all()) {
      await expect(controle).toHaveAttribute('aria-describedby', 'editar-p-' + id + '-resumo-nome');
    }
  }
  await item(dialog, 'Bruno Lima').locator('.editar-passageiro__resumo').click();
  await expect(item(dialog, 'Bruno Lima').getByRole('switch', { name: 'Desistiu' }))
    .toHaveAccessibleDescription('Bruno Lima');
});

test('abre, expande um passageiro por vez e edita dados @smoke', async ({ page }) => {
  const chamadas = await servirReservas(page, [reservaA, reservaB]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');

  await expect(dialog.getByRole('heading', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(dialog.locator('#painel-editar-subtitulo')).toHaveText('Grupo Alfa · Pagamento aprovado');
  await expect(dialog.locator('#editar-grupo')).toHaveValue('Grupo Alfa');
  await expect(dialog.locator('#editar-grupo')).toBeDisabled();
  await expect(dialog.locator('#editar-grupo option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa']);
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await expect(dialog.locator('#editar-grupo option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa (atual)', 'Grupo Beta', 'Grupo Gama']);
  await dialog.getByRole('button', { name: 'Manter grupo' }).click();

  const ana = item(dialog, 'Ana Souza');
  const bruno = item(dialog, 'Bruno Lima');
  const resumoAna = ana.locator('.editar-passageiro__resumo');
  const resumoBruno = bruno.locator('.editar-passageiro__resumo');
  await expect(resumoAna).toHaveAttribute('aria-expanded', 'false');
  await expect(resumoAna).toContainText('529.982.247-25');
  await expect(bruno).toHaveClass(/editar-passageiro--desistente/);
  await expect(bruno.locator('.editar-passageiro__etiqueta')).toBeVisible();
  await expect(ana.locator('.editar-passageiro__etiqueta')).toBeHidden();
  await expect(dialog.locator('.editar-passageiro__painel:visible')).toHaveCount(0);

  await resumoAna.click();
  await expect(resumoAna).toHaveAttribute('aria-expanded', 'true');
  await resumoBruno.click();
  await expect(resumoAna).toHaveAttribute('aria-expanded', 'false');
  await expect(resumoBruno).toHaveAttribute('aria-expanded', 'true');
  await expect(bruno.getByLabel('Motivo (opcional)')).toHaveValue('Mudou de planos');
  await resumoAna.click();
  await expect(resumoBruno).toHaveAttribute('aria-expanded', 'false');

  await ana.getByLabel('Nome *').fill('Ana Souza Lima');
  await ana.getByLabel('CPF *').fill('71460238001');
  await expect(ana.getByLabel('CPF *')).toHaveValue('714.602.380-01');
  await ana.getByLabel('WhatsApp').fill('21988887777');
  await expect(ana.getByLabel('WhatsApp')).toHaveValue('(21) 98888-7777');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(dialog).toBeHidden();
  expect(pedidos).toHaveLength(1);
  const corpo = pedidos[0].corpo;
  expect(pedidos[0].token).toBeTruthy();
  expect(corpo.registration_id).toBe(reservaA.id);
  expect(corpo.expected_updated_at).toBe('2026-10-16 18:00:00');
  expect(corpo.primary_passenger_id).toBe('11');
  expect('group_name' in corpo).toBe(false);
  expect(corpo.passengers).toEqual([
    {
      id: '11', full_name: 'Ana Souza Lima', cpf: '71460238001', whatsapp: '21988887777',
      email: 'ana@example.com', age_group: 'adult', withdrawn: false, withdrawal_reason: null
    },
    {
      id: '12', full_name: 'Bruno Lima', cpf: '12345678909', whatsapp: '11999992222',
      email: null, age_group: 'adult', withdrawn: true, withdrawal_reason: 'Mudou de planos'
    }
  ]);
  await expect.poll(() => chamadas.dados).toBe(2);
});

test('desistência do responsável exige novo responsável adulto @smoke', async ({ page }) => {
  await servirReservas(page, [reservaD]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'DDDD0004');
  const responsavel = dialog.getByRole('group', { name: 'Novo responsável' });
  const erro = dialog.locator('#editar-erro');
  await expect(responsavel).toBeHidden();

  const ana = item(dialog, 'Ana Prado');
  await ana.locator('.editar-passageiro__resumo').click();
  await expect(ana.getByLabel('Motivo (opcional)')).toBeHidden();
  const desistiu = ana.getByRole('switch', { name: 'Desistiu' });
  await expect(desistiu).toHaveAttribute('aria-checked', 'false');
  await desistiu.click();
  await expect(desistiu).toHaveAttribute('aria-checked', 'true');
  await ana.getByLabel('Motivo (opcional)').fill('Viagem a trabalho');

  await expect(responsavel).toBeVisible();
  const opcoes = responsavel.getByRole('radio');
  await expect(opcoes).toHaveCount(1);
  await expect(responsavel.getByRole('radio', { name: /Bruno Prado/ })).toBeVisible();

  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(erro).toHaveText('Escolha o novo responsável da reserva.');
  await expect(responsavel.getByRole('radio', { name: /Bruno Prado/ })).toBeFocused();
  expect(pedidos).toHaveLength(0);

  await responsavel.getByRole('radio', { name: /Bruno Prado/ }).check();
  const bruno = item(dialog, 'Bruno Prado');
  await expect(bruno.locator('.editar-passageiro__resumo')).toHaveAttribute('aria-expanded', 'true');
  const emailBruno = bruno.getByLabel('E-mail *');
  await expect(emailBruno).toHaveAttribute('required', '');
  await expect(bruno.getByLabel('WhatsApp *')).toHaveAttribute('required', '');

  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(erro).toHaveText('Informe WhatsApp e e-mail do responsável.');
  await expect(emailBruno).toBeFocused();
  await expect(emailBruno).toHaveAttribute('aria-invalid', 'true');
  expect(pedidos).toHaveLength(0);

  await emailBruno.fill('Bruno@Example.com');
  await expect(erro).toBeHidden();
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();

  expect(pedidos).toHaveLength(1);
  const corpo = pedidos[0].corpo;
  expect(corpo.primary_passenger_id).toBe('42');
  expect(corpo.expected_updated_at).toBe('2026-10-16 19:00:00');
  expect(corpo.passengers.map(p => [p.id, p.age_group, p.withdrawn])).toEqual([
    ['41', 'adult', true], ['42', 'adult', false], ['43', 'minor', false], ['44', 'lap', false]
  ]);
  expect(corpo.passengers[0].withdrawal_reason).toBe('Viagem a trabalho');
  expect(corpo.passengers[1].email).toBe('bruno@example.com');
});

test('colo sem adulto bloqueia e colo→pagante avisa', async ({ page }) => {
  await servirReservas(page, [reservaE]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'EEEE0005');
  const aviso = dialog.locator('#editar-aviso');

  const eva = item(dialog, 'Eva Rocha');
  await eva.locator('.editar-passageiro__resumo').click();
  await eva.getByRole('switch', { name: 'Desistiu' }).click();
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog.locator('#editar-erro')).toHaveText(
    'Há mais crianças de colo do que adultos (18+) na viagem. Marque também a desistência da criança ou mantenha um adulto.'
  );
  expect(pedidos).toHaveLength(0);

  // A mensagem leva até a criança, onde está a saída sugerida.
  const fabio = item(dialog, 'Fábio Rocha');
  await expect(fabio.locator('.editar-passageiro__resumo')).toHaveAttribute('aria-expanded', 'true');
  await expect(fabio.getByRole('switch', { name: 'Desistiu' })).toBeFocused();

  await expect(aviso).toBeHidden();
  await fabio.getByLabel('Faixa etária').selectOption({ label: '6 a 17 anos' });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Fábio Rocha passa a ocupar um assento sem pagamento correspondente');
  await fabio.getByLabel('Faixa etária').selectOption({ label: '0 a 5 anos (colo)' });
  await expect(aviso).toBeHidden();
});

test('menor de 6 a 17 não acompanha criança de colo', async ({ page }) => {
  await servirReservas(page, [reservaD]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'DDDD0004');
  // Saem os dois adultos: ficam Caio (6 a 17) e Duda (colo).
  for (const nome of ['Ana Prado', 'Bruno Prado']) {
    await item(dialog, nome).locator('.editar-passageiro__resumo').click();
    await item(dialog, nome).getByRole('switch', { name: 'Desistiu' }).click();
  }
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog.locator('#editar-erro')).toHaveText(
    'Há mais crianças de colo do que adultos (18+) na viagem. Marque também a desistência da criança ou mantenha um adulto.'
  );
  expect(pedidos).toHaveLength(0);
});

test('VIP sem contato edita o nome sem precisar de WhatsApp e e-mail', async ({ page }) => {
  const vip = {
    ...reservaA,
    id: 'ffff0006-6666-4666-8666-666666666666',
    code: 'FFFF0006',
    is_vip: true,
    grupo: null,
    contato: 'Gil Vieira',
    email: '',
    contato_whatsapp: '',
    pagantes: 1,
    updated_at: '2026-10-16 17:00:00',
    passageiros: [{
      id: '61', posicao: 1, nome: 'Gil Vieira', cpf: '714.602.380-01', cpf_digitos: '71460238001',
      whatsapp: null, whatsapp_digitos: null, email: null,
      responsavel: true, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
    }]
  };
  await servirReservas(page, [vip]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  const gil = item(dialog, 'Gil Vieira');
  await expect(gil.getByLabel('WhatsApp', { exact: true })).not.toHaveAttribute('required', '');
  await expect(gil.getByLabel('E-mail', { exact: true })).not.toHaveAttribute('required', '');
  await gil.getByLabel('Nome *').fill('Gil Vieira Souza');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(dialog).toBeHidden();
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].corpo.primary_passenger_id).toBe('61');
  expect(pedidos[0].corpo.passengers).toEqual([{
    id: '61', full_name: 'Gil Vieira Souza', cpf: '71460238001', whatsapp: null,
    email: null, age_group: 'adult', withdrawn: false, withdrawal_reason: null
  }]);
});

test('erro do servidor mantém o modal', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const pedidos = await capturarSalvamento(page, () => ({
    status: 409, json: { error: ERRO_CAPACIDADE, code: 'capacity' }
  }));
  const dialog = await abrirEdicao(page, 'AAAA0001');

  const bruno = item(dialog, 'Bruno Lima');
  await bruno.locator('.editar-passageiro__resumo').click();
  await bruno.getByRole('switch', { name: 'Desistiu' }).click(); // reativa Bruno
  const salvar = dialog.getByRole('button', { name: 'Salvar alterações' });
  await salvar.click();

  await expect(dialog.locator('#editar-erro')).toHaveText(ERRO_CAPACIDADE);
  await expect(dialog).toBeVisible();
  await expect(salvar).toBeEnabled();
  await expect(salvar).not.toHaveAttribute('aria-busy', 'true');
  await expect(salvar).toHaveText('Salvar alterações');
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].corpo.passengers[1]).toMatchObject({ id: '12', withdrawn: false, withdrawal_reason: null });
});

test('reserva salva por outra pessoa: recarrega e reabre com o updated_at novo', async ({ page }) => {
  // Outro admin salvou a reserva A depois que esta aba carregou a lista.
  const atualizada = {
    ...reservaA,
    updated_at: '2026-10-16 20:00:00',
    passageiros: [{ ...reservaA.passageiros[0], nome: 'Ana Souza Prado' }, reservaA.passageiros[1]]
  };
  let carregamentos = 0;
  await page.route('**/api/bus-admin-data*', route => {
    carregamentos += 1;
    return route.fulfill({ json: { ...resposta, reservas: [carregamentos === 1 ? reservaA : atualizada, reservaB] } });
  });
  const pedidos = await capturarSalvamento(page, n => (n === 1
    ? { status: 409, json: { error: 'A reserva mudou desde que você abriu. Feche e abra de novo para ver os dados atuais.', code: 'stale' } }
    : { status: 200, json: { success: true, registration_id: reservaA.id, updated_at: '2026-10-16 21:00:00' } }));
  const dialog = await abrirEdicao(page, 'AAAA0001');

  const ana = item(dialog, 'Ana Souza');
  await ana.locator('.editar-passageiro__resumo').click();
  await ana.getByLabel('WhatsApp').fill('21988887777');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect.poll(() => carregamentos).toBe(2);
  const aviso = dialog.locator('#editar-aviso');
  await expect(dialog).toBeVisible();
  await expect(aviso).toHaveText('A reserva foi atualizada por outra pessoa. Confira e salve de novo.');
  await expect(dialog.locator('#editar-erro')).toBeHidden();
  // Reaberto com os dados novos: o nome que o outro admin salvou, sem a edição perdida.
  await expect(dialog.locator('#editar-p-11-resumo-nome')).toHaveText('Ana Souza Prado');
  expect(pedidos[0].corpo.expected_updated_at).toBe('2026-10-16 18:00:00');

  const anaNova = item(dialog, 'Ana Souza Prado');
  await anaNova.locator('.editar-passageiro__resumo').click();
  await expect(anaNova.getByLabel('WhatsApp')).toHaveValue('(11) 99999-1111');
  await anaNova.getByLabel('WhatsApp').fill('21988887777');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(dialog).toBeHidden();
  expect(pedidos).toHaveLength(2);
  expect(pedidos[1].corpo.expected_updated_at).toBe('2026-10-16 20:00:00');
  expect(pedidos[1].corpo.passengers[0]).toMatchObject({ id: '11', full_name: 'Ana Souza Prado', whatsapp: '21988887777' });
  await expect.poll(() => carregamentos).toBe(3);
});

test('fechar com alterações pede confirmação', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  const alerta = page.locator('#painel-alerta-dialog');

  await item(dialog, 'Ana Souza').locator('.editar-passageiro__resumo').click();
  await item(dialog, 'Ana Souza').getByLabel('Nome *').fill('Ana Souza Lima');
  await page.keyboard.press('Escape');
  await expect(alerta).toBeVisible();
  await expect(alerta.locator('#painel-dialog-titulo')).toHaveText('Descartar alterações?');
  await alerta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alerta).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(item(dialog, 'Ana Souza').getByLabel('Nome *')).toHaveValue('Ana Souza Lima');

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await alerta.getByRole('button', { name: 'Descartar e fechar' }).click();
  await expect(dialog).toBeHidden();
});

test('reserva pendente não oferece desistência', async ({ page }) => {
  const pendente = {
    ...reservaA,
    status: 'payment_pending',
    status_chave: 'pendente',
    status_rotulo: 'Aguardando pagamento',
    passageiros: reservaA.passageiros.map(p => ({ ...p, desistiu: false, desistiu_em: null, motivo_desistencia: null }))
  };
  await servirReservas(page, [pendente]);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  await item(dialog, 'Ana Souza').locator('.editar-passageiro__resumo').click();
  await expect(item(dialog, 'Ana Souza').getByLabel('Nome *')).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(0);
});

test('teclado: Tab chega ao primeiro passageiro, Enter expande e o foco volta ao lápis', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  const lapis = page.getByRole('button', { name: 'Editar reserva #AAAA0001' });
  await lapis.focus();
  await page.keyboard.press('Enter');

  const dialog = page.locator('#painel-editar-dialog');
  await expect(dialog).toBeVisible();
  const primeiro = dialog.locator('.editar-passageiro__resumo').first();
  // O primeiro foco do modal é o link "Alterar grupo" (o seletor nasce travado);
  // um Tab leva ao primeiro passageiro.
  await expect(dialog.getByRole('button', { name: 'Alterar grupo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(primeiro).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(primeiro).toHaveAttribute('aria-expanded', 'true');
  await expect(item(dialog, 'Ana Souza').getByLabel('Nome *')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(lapis).toBeFocused();
});

// ---- VIP sem desistência, remoção pelo modal e reserva de uma pessoa só ----

const reservaVip = {
  ...reservaA,
  id: 'ffff0006-6666-4666-8666-666666666666',
  code: 'FFFF0006',
  is_vip: true,
  grupo: null,
  contato: 'Gil Vieira',
  email: '',
  contato_whatsapp: '',
  pagantes: 1,
  bus_number: 1,
  updated_at: '2026-10-16 17:00:00',
  passageiros: [{
    id: '61', posicao: 1, nome: 'Gil Vieira', cpf: '714.602.380-01', cpf_digitos: '71460238001',
    whatsapp: null, whatsapp_digitos: null, email: null,
    responsavel: true, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
  }]
};

// Reserva solo comum (confirmada, uma pessoa): mantém o switch Desistiu.
const reservaSolo = {
  ...reservaA,
  id: 'abab0007-7777-4777-8777-777777777777',
  code: 'ABAB0007',
  grupo: null,
  contato: 'Hugo Alves',
  email: 'hugo@example.com',
  contato_whatsapp: '(11) 97777-7777',
  pagantes: 1,
  updated_at: '2026-10-16 17:30:00',
  passageiros: [{
    id: '71', posicao: 1, nome: 'Hugo Alves', cpf: '529.982.247-25', cpf_digitos: '52998224725',
    whatsapp: '(11) 97777-7777', whatsapp_digitos: '11977777777', email: 'hugo@example.com',
    responsavel: true, menor: false, crianca_colo: false, desistiu: false, desistiu_em: null, motivo_desistencia: null
  }]
};

async function capturarRemocaoVip(page, responder) {
  const pedidos = [];
  await page.route('**/api/bus-vip-delete*', route => {
    pedidos.push(route.request().postDataJSON());
    return route.fulfill(responder ? responder() : { json: { success: true } });
  });
  return pedidos;
}

test('VIP: modal sem switch, motivo nem novo responsável; payload segue withdrawn:false', async ({ page }) => {
  await servirReservas(page, [reservaVip, reservaA]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  await expect(dialog.getByRole('switch')).toHaveCount(0);
  await expect(dialog.getByText('Desistiu', { exact: true })).toBeHidden();
  await expect(dialog.getByLabel('Motivo (opcional)')).toHaveCount(0);
  await expect(dialog.getByRole('group', { name: 'Novo responsável' })).toBeHidden();

  await dialog.getByLabel('Nome *').fill('Gil Vieira Souza');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  expect(pedidos[0].corpo.passengers).toEqual([{
    id: '61', full_name: 'Gil Vieira Souza', cpf: '71460238001', whatsapp: null,
    email: null, age_group: 'adult', withdrawn: false, withdrawal_reason: null
  }]);
});

test('Remover reserva VIP fica à esquerda de Salvar e só existe para VIP real', async ({ page }) => {
  await servirReservas(page, [reservaVip, reservaA, reservaB]);
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    let dialog = await abrirEdicao(page, 'FFFF0006');
    const remover = dialog.getByRole('button', { name: 'Remover reserva VIP' });
    const salvar = dialog.getByRole('button', { name: 'Salvar alterações' });
    const cancelar = dialog.getByRole('button', { name: 'Cancelar' });
    await expect(remover).toBeVisible();
    await expect(remover).toHaveClass(/botao--perigo/);
    const [r, sv, c] = await Promise.all([remover.boundingBox(), salvar.boundingBox(), cancelar.boundingBox()]);
    if (viewport.width > 560) {
      // Cancelar, Remover reserva VIP e Salvar, nessa ordem, na mesma linha.
      expect(c.x + c.width).toBeLessThanOrEqual(r.x + 1);
      expect(r.x + r.width).toBeLessThanOrEqual(sv.x + 1);
      expect(Math.abs(r.y - sv.y)).toBeLessThan(4);
    } else {
      // Empilhados no celular: todos visíveis e inteiros na tela, na mesma ordem.
      for (const caixa of [c, r, sv]) {
        expect(caixa.x).toBeGreaterThanOrEqual(0);
        expect(caixa.x + caixa.width).toBeLessThanOrEqual(viewport.width);
      }
      expect(c.y).toBeLessThan(r.y);
      expect(r.y).toBeLessThan(sv.y);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  // Não-VIP (multi e solo desistente) e VIP provisório não oferecem o botão.
  for (const codigo of ['AAAA0001', 'BBBB0002']) {
    const dialog = await abrirEdicao(page, codigo);
    await expect(dialog.locator('#editar-remover-vip')).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Remover reserva VIP' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('Remover reserva VIP: fecha o modal sem pedir descarte, confirma em vermelho e remove', async ({ page }) => {
  const chamadas = await servirReservas(page, [reservaVip, reservaA]);
  const pedidos = await capturarRemocaoVip(page);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  const alerta = page.locator('#painel-alerta-dialog');

  // Alteração pendente: a remoção não pergunta sobre descartar.
  await dialog.getByLabel('Nome *').fill('Gil Vieira Souza');
  await dialog.getByRole('button', { name: 'Remover reserva VIP' }).click();
  await expect(dialog).toBeHidden();
  await expect(alerta).toBeVisible();
  await expect(alerta.locator('#painel-dialog-titulo')).toHaveText('Remover reserva VIP?');
  await expect(alerta.locator('#painel-dialog-mensagem')).toContainText('Gil Vieira');
  const confirmar = alerta.locator('#painel-dialog-confirmar');
  await expect(confirmar).toHaveText('Remover VIP');
  await expect(confirmar).toHaveClass(/botao--perigo/);
  const fundo = await confirmar.evaluate(el => getComputedStyle(el).backgroundColor);
  const [vermelho, verde, azul] = fundo.match(/\d+/g).map(Number);
  expect(vermelho).toBeGreaterThan(130);
  expect(verde).toBeLessThan(60);
  expect(azul).toBeLessThan(60);
  await expect(confirmar).toHaveCSS('color', 'rgb(255, 255, 255)');

  const antes = chamadas.dados;
  await confirmar.click();
  await expect(alerta).toBeHidden();
  await expect.poll(() => pedidos.length).toBe(1);
  expect(pedidos[0]).toEqual({ registration_id: reservaVip.id });
  await expect.poll(() => chamadas.dados).toBeGreaterThan(antes);
});

test('Remover reserva VIP: cancelar a confirmação não faz mais nada', async ({ page }) => {
  const chamadas = await servirReservas(page, [reservaVip, reservaA]);
  const pedidos = await capturarRemocaoVip(page);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  const alerta = page.locator('#painel-alerta-dialog');
  await dialog.getByRole('button', { name: 'Remover reserva VIP' }).click();
  await expect(alerta).toBeVisible();
  const antes = chamadas.dados;
  await alerta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alerta).toBeHidden();
  await expect(dialog).toBeHidden(); // não reabre
  expect(pedidos).toHaveLength(0);
  expect(chamadas.dados).toBe(antes);
});

test('Remover reserva VIP em ônibus bloqueado avisa antes de confirmar e não chama a API', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    json: { ...resposta, reservas: [reservaVip, reservaA], frota: { ...resposta.frota, onibus: resposta.frota.onibus.map(o => ({ ...o, bloqueado: true })) } }
  }));
  const pedidos = await capturarRemocaoVip(page);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  const alerta = page.locator('#painel-alerta-dialog');
  await dialog.getByRole('button', { name: 'Remover reserva VIP' }).click();
  await expect(alerta).toBeVisible();
  await expect(alerta.locator('#painel-dialog-titulo')).toHaveText('Ônibus Bloqueado');
  await expect(alerta.locator('#painel-dialog-confirmar')).toHaveAttribute('hidden', '');
  expect(pedidos).toHaveLength(0);
});

test('confirmação sem perigo (descartar alterações) segue com o botão primário', async ({ page }) => {
  await servirReservas(page, [reservaVip, reservaA]);
  const dialog = await abrirEdicao(page, 'FFFF0006');
  const alerta = page.locator('#painel-alerta-dialog');
  // Antes: uma confirmação de perigo, depois cancelada, não pode deixar a classe vermelha.
  await dialog.getByRole('button', { name: 'Remover reserva VIP' }).click();
  await expect(alerta.locator('#painel-dialog-confirmar')).toHaveClass(/botao--perigo/);
  await alerta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alerta).toBeHidden();
  await expect(alerta.locator('#painel-dialog-confirmar')).toHaveClass('botao botao--primario');

  await page.getByRole('button', { name: 'Editar reserva #FFFF0006' }).click();
  await dialog.getByLabel('Nome *').fill('Gil Vieira Souza');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alerta.locator('#painel-dialog-titulo')).toHaveText('Descartar alterações?');
  const confirmar = alerta.locator('#painel-dialog-confirmar');
  await expect(confirmar).toHaveText('Descartar e fechar');
  await expect(confirmar).toHaveClass('botao botao--primario');
  await expect(confirmar).not.toHaveClass(/botao--perigo/);
});

test('o botão "−" de remover VIP não existe mais na frota nem em "Sem ônibus confirmado"', async ({ page }) => {
  const reservaVipSem = {
    ...reservaVip, id: 'cdcd0008-8888-4888-8888-888888888888', code: 'CDCD0008',
    contato: 'Iara Neves', bus_number: null, fleet_assignment_status: 'unassigned'
  };
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    json: {
      ...resposta,
      reservas: [reservaA, reservaVip, reservaVipSem],
      frota: {
        ...resposta.frota,
        sem_onibus_confirmado: [{
          id: reservaVipSem.id, code: 'CDCD0008', contato: 'Iara Neves', is_vip: true, pagantes: 1, criancas: 0,
          total: 1, assentos: 1, grupo: null, passageiros: [{ nome: 'Iara Neves' }]
        }],
        onibus: [{
          ...resposta.frota.onibus[0],
          reservas: [
            ...resposta.frota.onibus[0].reservas,
            { id: reservaVip.id, code: 'FFFF0006', grupo: null, responsavel: 'Gil Vieira', pagantes: 1, criancas: 0, total: 1, assentos: 1, is_vip: true }
          ]
        }]
      }
    }
  }));
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
  await expect(page.locator('.grupo-item').filter({ hasText: 'FFFF0006' })).toHaveCount(1);
  await expect(page.locator('#frota-sem-onibus .frota-sem-onibus__item')).toHaveCount(1);
  await expect(page.locator('.grupo-item__vip-remover')).toHaveCount(0);
  await expect(page.locator('.frota-sem-onibus__remover-vip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Remover reserva VIP de/ })).toHaveCount(0);
});

test('reserva de uma pessoa só (VIP e solo) abre expandida, sem controle de recolher e com foco no Nome', async ({ page }) => {
  await servirReservas(page, [reservaVip, reservaSolo, reservaA]);
  for (const [codigo, nome] of [['FFFF0006', 'Gil Vieira'], ['ABAB0007', 'Hugo Alves']]) {
    const dialog = await abrirEdicao(page, codigo);
    const pessoa = item(dialog, nome);
    const resumo = pessoa.locator('.editar-passageiro__resumo');
    await expect(pessoa).toHaveClass(/editar-passageiro--aberto/);
    await expect(resumo).toHaveClass(/editar-passageiro--fixo/);
    expect(await resumo.evaluate(el => el.tagName)).toBe('DIV');
    await expect(resumo).not.toHaveAttribute('aria-expanded', /.*/);
    await expect(resumo).not.toHaveAttribute('aria-controls', /.*/);
    await expect(pessoa.locator('.editar-passageiro__seta')).toHaveCount(0);
    await expect(dialog.locator('.editar-passageiro [aria-expanded]')).toHaveCount(0);
    await expect(pessoa.getByLabel('Nome *')).toBeVisible();
    await expect(pessoa.getByLabel('Nome *')).toBeFocused();
    // Clicar no cabeçalho não recolhe.
    await resumo.click();
    await expect(pessoa.getByLabel('Nome *')).toBeVisible();
    // O painel segue ligado ao nome do passageiro.
    await expect(pessoa.getByLabel('Nome *')).toHaveAccessibleDescription(nome);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  // Solo comum e confirmada mantém a desistência.
  const dialog = await abrirEdicao(page, 'ABAB0007');
  await expect(dialog.getByRole('switch', { name: 'Desistiu' })).toBeVisible();
});

test('reserva solo: a validação que aponta o campo funciona com o painel fixo', async ({ page }) => {
  await servirReservas(page, [reservaSolo, reservaA]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'ABAB0007');
  const nome = dialog.getByLabel('Nome *');
  await nome.fill('Hugo');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog.locator('#editar-erro')).toHaveText('Informe o nome completo do passageiro 1.');
  await expect(nome).toBeFocused();
  await expect(nome).toBeVisible();
  expect(pedidos).toHaveLength(0);
});

test('reserva com vários passageiros continua em sanfona, um aberto por vez', async ({ page }) => {
  await servirReservas(page, [reservaD, reservaA]);
  const dialog = await abrirEdicao(page, 'DDDD0004');
  const resumos = dialog.locator('.editar-passageiro__resumo');
  await expect(resumos).toHaveCount(4);
  await expect(dialog.locator('.editar-passageiro--fixo')).toHaveCount(0);
  await expect(dialog.locator('.editar-passageiro__seta')).toHaveCount(4);
  await expect(dialog.locator('.editar-passageiro__resumo[aria-expanded="true"]')).toHaveCount(0);
  await resumos.nth(0).click();
  await expect(resumos.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await resumos.nth(1).click();
  await expect(resumos.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(resumos.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await resumos.nth(1).click();
  await expect(resumos.nth(1)).toHaveAttribute('aria-expanded', 'false');
});

// ---- nome do grupo no cabeçalho, travado até pedir para alterar ----------

async function contarBuscaGrupos(page, responder) {
  const chamadas = { n: 0 };
  await page.route('**/api/bus-group-names', route => {
    chamadas.n += 1;
    return route.fulfill(responder ? responder() : {
      json: { livres: ['Grupo Beta', 'Grupo Gama'], em_uso: ['Grupo Alfa'] }
    });
  });
  return chamadas;
}

test('grupo: seletor no cabeçalho, à direita do título no desktop e sob ele no celular, travado e sem busca ao abrir', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const buscas = await contarBuscaGrupos(page);
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const dialog = await abrirEdicao(page, 'AAAA0001');
    const select = dialog.locator('.bus-dialog__header #editar-grupo');
    await expect(select).toHaveCount(1);
    await expect(dialog.locator('.editar-corpo #editar-grupo')).toHaveCount(0);
    await expect(select).toBeDisabled();
    await expect(select).toHaveValue('Grupo Alfa');
    await expect(dialog.getByRole('button', { name: 'Alterar grupo' })).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.getByRole('button', { name: 'Alterar grupo' })).toHaveAttribute('aria-controls', 'editar-grupo');
    expect(buscas.n).toBe(0);

    const titulo = await dialog.locator('#painel-editar-titulo').boundingBox();
    const caixa = await select.boundingBox();
    const caixaDialog = await dialog.boundingBox();
    if (viewport.width > 560) {
      expect(caixa.x).toBeGreaterThan(titulo.x + titulo.width);
      expect(caixa.width).toBeLessThanOrEqual(220);
    } else {
      expect(caixa.y).toBeGreaterThan(titulo.y + titulo.height);
    }
    expect(caixa.x).toBeGreaterThanOrEqual(caixaDialog.x);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(caixaDialog.x + caixaDialog.width);
    expect(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('grupo: "Alterar grupo" destrava, foca, busca uma vez; escolher um nome livre envia group_name', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const buscas = await contarBuscaGrupos(page);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  const select = dialog.locator('#editar-grupo');

  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await expect(select).toBeEnabled();
  await expect(select).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Manter grupo' })).toHaveAttribute('aria-expanded', 'true');
  await expect(select.locator('option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa (atual)', 'Grupo Beta', 'Grupo Gama']);
  expect(buscas.n).toBe(1);

  // Travar e destravar de novo não repete a busca nem duplica as opções.
  await dialog.getByRole('button', { name: 'Manter grupo' }).click();
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await expect(select.locator('option')).toHaveCount(4);
  expect(buscas.n).toBe(1);

  await select.selectOption('Grupo Beta');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  expect(pedidos[0].corpo.group_name).toBe('Grupo Beta');
});

test('grupo: "Manter grupo" restaura o valor, trava e o salvamento omite group_name', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  await contarBuscaGrupos(page);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  const select = dialog.locator('#editar-grupo');
  const alterar = dialog.getByRole('button', { name: 'Alterar grupo' });

  await alterar.click();
  await expect(select.locator('option')).toHaveCount(4);
  await select.selectOption('Grupo Gama');
  await dialog.getByRole('button', { name: 'Manter grupo' }).click();
  await expect(select).toBeDisabled();
  await expect(select).toHaveValue('Grupo Alfa');
  await expect(dialog.getByRole('button', { name: 'Alterar grupo' })).toBeFocused();

  // Sem alteração pendente: fechar não pede descarte, e salvar não manda o grupo.
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await dialog.getByRole('button', { name: 'Manter grupo' }).click();
  await item(dialog, 'Ana Souza').locator('.editar-passageiro__resumo').click();
  await item(dialog, 'Ana Souza').getByLabel('Nome *').fill('Ana Souza Lima');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  expect('group_name' in pedidos[0].corpo).toBe(false);
});

test('grupo: mudar o grupo e fechar pede confirmação; manter o grupo desfaz o pendente', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  await contarBuscaGrupos(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  const alerta = page.locator('#painel-alerta-dialog');
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  await dialog.locator('#editar-grupo').selectOption('Sem nome de grupo');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(alerta.locator('#painel-dialog-titulo')).toHaveText('Descartar alterações?');
  await alerta.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Manter grupo' }).click();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(alerta).toBeHidden();
});

test('grupo: busca com erro 500 avisa e oferece só o atual e "Sem nome de grupo"', async ({ page }) => {
  await servirReservas(page, [reservaA, reservaB]);
  const buscas = await contarBuscaGrupos(page, () => ({ status: 500, json: { error: 'Falhou.' } }));
  const dialog = await abrirEdicao(page, 'AAAA0001');
  await dialog.getByRole('button', { name: 'Alterar grupo' }).click();
  const aviso = dialog.locator('#editar-grupo-aviso');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Não foi possível carregar os nomes livres');
  await expect(dialog.locator('#editar-grupo')).toBeEnabled();
  await expect(dialog.locator('#editar-grupo')).toHaveAttribute('aria-describedby', 'editar-grupo-aviso');
  await expect(dialog.locator('#editar-grupo option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa (atual)']);
  expect(buscas.n).toBe(1);
});

test('grupo: reserva solo sem nome de grupo mantém o campo escondido', async ({ page }) => {
  await servirReservas(page, [{ ...reservaA, grupo: null, passageiros: [reservaA.passageiros[0]] }, reservaB]);
  const buscas = await contarBuscaGrupos(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');
  await expect(dialog.locator('#editar-grupo-campo')).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Alterar grupo' })).toHaveCount(0);
  expect(buscas.n).toBe(0);
});
