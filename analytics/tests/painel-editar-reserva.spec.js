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
  contato_cpf: '111.111.111-11',
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
      id: '11', posicao: 1, nome: 'Ana Souza', cpf: '111.111.111-11', whatsapp: '(11) 99999-1111',
      whatsapp_digitos: '11999991111', responsavel: true, menor: false, crianca_colo: false,
      nova_reserva: null, desistiu: false, desistiu_em: null, motivo_desistencia: null
    },
    {
      id: '12', posicao: 2, nome: 'Bruno Lima', cpf: '222.222.222-22', whatsapp: '(11) 99999-2222',
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
  contato_cpf: '333.333.333-33',
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
      id: '21', posicao: 1, nome: 'Carla Dias', cpf: '333.333.333-33', whatsapp: '(11) 99999-3333',
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

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bus-boarding', route => route.fulfill({ json: { people: [], waiting: 0 } }));
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
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  await expect(card.getByRole('button', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(page.locator('.grupo-item').filter({ hasText: 'VIP 1' }).locator('.grupo-item__editar')).toHaveCount(0);

  await card.locator('.grupo-item__editar').click();
  await expect(card).not.toHaveClass(/dragging/);
});

// Depende do modal do Task 7 (window.KobEditarReserva).
test.fixme('lápis do card da frota abre o modal de edição', async ({ page }) => {
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  await card.locator('.grupo-item__editar').click();
  await expect(card).not.toHaveClass(/dragging/);
  await expect(page.locator('#painel-editar-dialog')).toBeVisible();
});
