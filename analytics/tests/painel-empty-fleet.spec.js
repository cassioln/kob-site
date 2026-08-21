import { test, expect } from '@playwright/test';

test('reconcilia pendências de pagamento em segundo plano ao abrir o painel', async ({ page }) => {
  let request;
  let adminRequests = 0;
  let reconciliationRequests = 0;

  await page.route('**/api/bus-admin-data*', route => {
    adminRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reservas: [],
        resumo: {
          total_a_bordo: 0,
          pagantes: 0,
          criancas_no_colo: 0,
          reservas_pagas: 0,
          reservas_pendentes: 0,
          reservas_falha: 0,
          receita_centavos: 0,
          sem_telefone: 0
        },
        frota: { capacidade: 46, minimo: 40, onibus: [] }
      })
    });
  });
  await page.route('**/api/bus-admin-reconcile*', async route => {
    request = route.request();
    reconciliationRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ checked: 1, updated: reconciliationRequests === 1 ? 1 : 0 })
    });
  });

  await page.goto('/painel-onibus.html');

  await expect.poll(() => request && ({
    method: request.method(),
    token: new URL(request.url()).searchParams.get('token')
  })).toEqual({ method: 'POST', token: 'dev-token' });
  await expect.poll(() => adminRequests).toBe(2);
});

test('mantém a frota acessível quando não há reservas', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [],
      resumo: {
        total_a_bordo: 0,
        pagantes: 0,
        criancas_no_colo: 0,
        reservas_pagas: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 0,
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');

  await expect(page.locator('#painel-dados')).toBeVisible();
  await expect(page.locator('#estado-vazio')).toBeVisible();
  await page.getByRole('button', { name: 'Planejamento de Frota' }).click();
  await expect(page.locator('#aba-frota')).toBeVisible();
  await expect(page.locator('.onibus-card--adicionar')).toBeVisible();
});

test('permite retirar um VIP real para sem ônibus confirmado', async ({ page }) => {
  const vipId = '554ea5db-d723-4299-bfe0-505165caab70';
  let assignmentBody;

  const resposta = {
    reservas: [{
      id: vipId,
      code: '554EA5DB',
      status: 'confirmed',
      status_chave: 'vip',
      status_rotulo: 'Reserva VIP',
      status_tom: 'vip',
      contato: 'Karen Regis',
      contato_cpf: '',
      email: '',
      contato_whatsapp: '',
      pagantes: 1,
      criancas: 0,
      grupo: null,
      valor_centavos: 0,
      criado_em: '20/08/2026 20:20',
      pago_em: null,
      order_id: null,
      email_enviado: false,
      bus_number: 1,
      fleet_assignment_status: 'assigned',
      is_vip: true,
      passageiros: [{ posicao: 1, responsavel: true, menor: false, crianca_colo: false }]
    }],
    resumo: {
      total_a_bordo: 2,
      pagantes: 2,
      criancas_no_colo: 0,
      reservas_pagas: 1,
      reservas_vip: 1,
      reservas_pendentes: 0,
      reservas_falha: 0,
      receita_centavos: 12000,
      sem_telefone: 0
    },
    frota: {
      capacidade: 46,
      minimo: 40,
      sem_onibus_confirmado: [],
      onibus: [{
        numero: 1,
        ocupados: 1,
        assentos_ocupados: 1,
        vagas_livres: 45,
        pagantes: 1,
        criancas: 0,
        total: 1,
        assentos: 1,
        vip_inclusos: 1,
        reservas: [{ id: vipId, code: '554EA5DB', total: 1, assentos: 1, is_vip: true }]
      }]
    }
  };

  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(resposta)
  }));
  await page.route('**/api/bus-fleet-assign*', async route => {
    assignmentBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, bus_number: null })
    });
  });

  await page.goto('/painel-onibus.html');

  await expect(page.locator('#r-total')).toHaveText('2');
  await page.getByRole('button', { name: 'Planejamento de Frota' }).click();

  const menu = page.locator('.grupo-item--vip .grupo-item__mover');
  await menu.locator('summary').click();
  const espera = menu.getByRole('option', { name: 'Sem ônibus confirmado' });
  await expect(espera).toBeVisible();
  await expect(espera.locator('small')).toHaveCount(0);

  await espera.click();
  await expect.poll(() => assignmentBody).toEqual({
    registration_id: vipId,
    bus_number: null
  });
});
