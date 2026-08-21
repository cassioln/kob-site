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

test('normaliza dados do VIP e bloqueia WhatsApp inválido', async ({ page }) => {
  let vipRequest;
  let vipRequestCount = 0;

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
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 0,
        sem_telefone: 0
      },
      frota: {
        capacidade: 46,
        minimo: 40,
        sem_onibus_confirmado: [],
        onibus: [{ numero: 1, ocupados: 0, vagas_livres: 46, assentos: 0, reservas: [] }]
      }
    })
  }));
  await page.route('**/api/bus-vip-create*', async route => {
    vipRequestCount += 1;
    vipRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vips: [] })
    });
  });

  await page.goto('/painel-onibus.html');
  await page.getByRole('button', { name: 'Planejamento de Frota' }).click();
  await page.getByRole('button', { name: 'Adicionar VIP' }).click();

  const name = page.locator('#vip-0-full_name');
  const cpf = page.locator('#vip-0-cpf');
  const email = page.locator('#vip-0-email');
  const whatsapp = page.locator('#vip-0-whatsapp');
  await name.fill('SAMARA NASCIMENTO DE TOLEDO');
  await cpf.fill('52998224725');
  await email.fill('USUARIO@EMAIL.COM');
  await expect(email).toHaveValue('usuario@email.com');
  await whatsapp.fill('55119958957');
  await expect(name).toHaveCSS('text-transform', 'uppercase');
  await expect(email).toHaveCSS('text-transform', 'lowercase');

  await page.getByRole('button', { name: /confirmar reservas vip/i }).click();
  await expect(page.locator('#vip-form-erro')).toContainText(/WhatsApp.*DDD|WhatsApp.*válido/i);
  await expect(whatsapp).toHaveAttribute('aria-invalid', 'true');
  expect(vipRequestCount).toBe(0);

  await whatsapp.fill('5511999998888');
  await page.getByRole('button', { name: /confirmar reservas vip/i }).click();
  await expect.poll(() => vipRequest).toEqual({
    vips: [{
      full_name: 'Samara Nascimento de Toledo',
      cpf: '529.982.247-25',
      whatsapp: '11999998888',
      email: 'usuario@email.com',
      bus_number: null
    }]
  });
});

test('cria atalho seguro de WhatsApp apenas para número válido', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [
        {
          id: 'valid-whatsapp-id',
          code: 'A1B2C3D4',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Samara Nascimento de Toledo',
          contato_cpf: '52998224725',
          email: 'usuario@email.com',
          contato_whatsapp: '11999998888',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 13:00',
          pago_em: '21/08/2026 13:01',
          order_id: 'ORD-VALID',
          is_vip: false,
          bus_number: 1,
          passageiros: [{
            posicao: 1,
            nome: 'Samara Nascimento de Toledo',
            cpf: '529.982.247-25',
            whatsapp: '(11) 99999-8888',
            responsavel: true,
            menor: false,
            crianca_colo: false
          }]
        },
        {
          id: 'invalid-whatsapp-id',
          code: 'E5F6G7H8',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Contato legado',
          contato_cpf: '52998224725',
          email: 'legado@email.com',
          contato_whatsapp: '55119958957',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 12:00',
          pago_em: '21/08/2026 12:01',
          order_id: 'ORD-INVALID',
          is_vip: false,
          bus_number: null,
          passageiros: [{
            posicao: 1,
            nome: 'Contato legado',
            cpf: '529.982.247-25',
            whatsapp: '55119958957',
            responsavel: true,
            menor: false,
            crianca_colo: false
          }]
        }
      ],
      resumo: {
        total_a_bordo: 2,
        pagantes: 2,
        criancas_no_colo: 0,
        reservas_pagas: 2,
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 24000,
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');

  const links = page.locator('.tabela__whatsapp-link');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', 'https://api.whatsapp.com/send?phone=5511999998888');
  await expect(links.first()).toHaveAttribute('target', '_blank');
  await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer');
});
