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
  await expect(lapis).toBeVisible();
  await expect(page.locator('.grupo-item').filter({ hasText: 'VIP 1' }).locator('.grupo-item__editar')).toHaveCount(0);

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

test('abre, expande um passageiro por vez e edita dados @smoke', async ({ page }) => {
  const chamadas = await servirReservas(page, [reservaA, reservaB]);
  const pedidos = await capturarSalvamento(page);
  const dialog = await abrirEdicao(page, 'AAAA0001');

  await expect(dialog.getByRole('heading', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(dialog.locator('#painel-editar-subtitulo')).toHaveText('Grupo Alfa · Pagamento aprovado');
  await expect(dialog.locator('#editar-grupo')).toHaveValue('Grupo Alfa');
  await expect(dialog.locator('#editar-grupo option')).toHaveText(['Sem nome de grupo', 'Grupo Alfa (atual)', 'Grupo Beta', 'Grupo Gama']);

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
    'Há mais crianças de colo do que adultos pagantes na viagem. Marque também a desistência da criança ou mantenha um adulto.'
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
  // O primeiro foco do modal é o seletor de grupo; um Tab leva ao primeiro passageiro.
  await expect(dialog.locator('#editar-grupo')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(primeiro).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(primeiro).toHaveAttribute('aria-expanded', 'true');
  await expect(item(dialog, 'Ana Souza').getByLabel('Nome *')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(lapis).toBeFocused();
});
