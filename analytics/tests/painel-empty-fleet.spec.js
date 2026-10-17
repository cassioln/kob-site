import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bus-boarding', route => route.fulfill({ json: { people: [], waiting: 0 } }));
});

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
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

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
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  await expect(page.locator('#painel-dados')).toBeVisible();
  await expect(page.locator('#estado-vazio')).toBeVisible();
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
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
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  await expect(page.locator('#r-total')).toHaveText('2');
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

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
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
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

  await whatsapp.fill('+55 85 9926-6494');
  await expect(whatsapp).toHaveValue('(85) 9926-6494');
  await page.getByRole('button', { name: /confirmar reservas vip/i }).click();
  await expect.poll(() => vipRequest).toEqual({
    vips: [{
      full_name: 'Samara Nascimento de Toledo',
      cpf: '529.982.247-25',
      whatsapp: '8599266494',
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
        },
        {
          id: 'legacy-mobile-id',
          code: 'L9G8C7Y6',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Paulo Henrique Estevão de Vasconcelos',
          contato_cpf: '52998224725',
          email: 'paulo@email.com',
          contato_whatsapp: '8599266494',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 11:00',
          pago_em: '21/08/2026 11:01',
          order_id: 'ORD-LEGACY',
          is_vip: false,
          bus_number: 1,
          passageiros: [{
            posicao: 1,
            nome: 'Paulo Henrique Estevão de Vasconcelos',
            cpf: '529.982.247-25',
            whatsapp: '(85) 9926-6494',
            responsavel: true,
            menor: false,
            crianca_colo: false
          }]
        }
      ],
      resumo: {
        total_a_bordo: 3,
        pagantes: 3,
        criancas_no_colo: 0,
        reservas_pagas: 3,
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 36000,
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  const links = page.locator('.tabela__whatsapp-link');
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', 'https://api.whatsapp.com/send?phone=5511999998888');
  await expect(links.nth(1)).toHaveAttribute('href', 'https://api.whatsapp.com/send?phone=558599266494');
  await expect(links.first()).toHaveAttribute('target', '_blank');
  await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer');
});

test('diferencia WhatsApp não informado de telefone não aplicável', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [
        {
          id: 'adult-without-whatsapp',
          code: 'ADULT001',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Pessoa adulta',
          contato_cpf: '52998224725',
          email: 'adulto@email.com',
          contato_whatsapp: '',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 11:00',
          pago_em: '21/08/2026 11:01',
          order_id: 'ORD-ADULT',
          is_vip: false,
          bus_number: 1,
          passageiros: [{
            posicao: 1,
            nome: 'Pessoa adulta',
            cpf: '529.982.247-25',
            whatsapp: null,
            responsavel: true,
            menor: false,
            crianca_colo: false
          }]
        },
        {
          id: 'lap-child-without-whatsapp',
          code: 'CHILD001',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Responsável da criança',
          contato_cpf: '52998224725',
          email: 'responsavel@email.com',
          contato_whatsapp: '',
          pagantes: 0,
          criancas: 1,
          grupo: null,
          valor_centavos: 0,
          criado_em: '21/08/2026 10:00',
          pago_em: '21/08/2026 10:01',
          order_id: 'ORD-CHILD',
          is_vip: false,
          bus_number: 1,
          passageiros: [{
            posicao: 1,
            nome: 'Bebê da reserva',
            cpf: '529.982.247-25',
            whatsapp: null,
            responsavel: false,
            menor: true,
            crianca_colo: true
          }]
        }
      ],
      resumo: {
        total_a_bordo: 1,
        pagantes: 1,
        criancas_no_colo: 1,
        reservas_pagas: 2,
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 12000,
        sem_telefone: 2
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  await expect(page.locator('.tabela__tel--vazio').filter({ hasText: 'Não informado' })).toHaveCount(1);
  await expect(page.locator('.tabela__tel--vazio').filter({ hasText: 'N/A' })).toHaveCount(1);
});

test('mantém WhatsApp antes de CPF e centraliza as células da tabela', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [{
        id: 'order-layout',
        code: 'LAYOUT01',
        status: 'confirmed',
        status_chave: 'pago',
        status_rotulo: 'Pagamento aprovado',
        status_tom: 'ok',
        contato: 'Pessoa Layout',
        contato_cpf: '52998224725',
        email: 'layout@email.com',
        contato_whatsapp: '11999998888',
        pagantes: 1,
        criancas: 0,
        grupo: null,
        valor_centavos: 12000,
        criado_em: '21/08/2026 11:00',
        pago_em: '21/08/2026 11:01',
        order_id: 'ORD-LAYOUT',
        is_vip: false,
        bus_number: 1,
        passageiros: [{
          posicao: 1,
          nome: 'Pessoa Layout',
          cpf: '529.982.247-25',
          whatsapp: '11999998888',
          responsavel: true,
          menor: false,
          crianca_colo: false
        }]
      }],
      resumo: {
        total_a_bordo: 1,
        pagantes: 1,
        criancas_no_colo: 0,
        reservas_pagas: 1,
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 12000,
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  expect(await page.locator('.tabela thead th').allTextContents()).toEqual([
    'Reserva', 'Passageiro', 'WhatsApp', 'CPF', 'Grupo', 'Ônibus', 'Status', 'Pago em'
  ]);

  const cells = page.locator('.tabela tbody tr').first().locator('td');
  await expect(cells.nth(2)).toHaveAttribute('data-rotulo', 'WhatsApp');
  await expect(cells.nth(3)).toHaveAttribute('data-rotulo', 'CPF');
  await expect(cells.nth(2)).toHaveCSS('align-content', 'center');
  await expect(cells.nth(2)).toHaveCSS('vertical-align', 'middle');
});

test('mostra a emissão do QR Code abaixo da aprovação ou pendência do pagamento', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [
        {
          id: 'paid-qr-date',
          code: 'PAIDQR01',
          status: 'confirmed',
          status_chave: 'pago',
          status_rotulo: 'Pagamento aprovado',
          status_tom: 'ok',
          contato: 'Pagamento aprovado',
          contato_cpf: '52998224725',
          email: 'pago@email.com',
          contato_whatsapp: '11999998888',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 14:20',
          pago_em: '21/08/2026 14:23',
          order_id: 'ORD-PAID-QR',
          is_vip: false,
          bus_number: 1,
          passageiros: [{
            posicao: 1,
            nome: 'Pagamento aprovado',
            cpf: '529.982.247-25',
            whatsapp: '11999998888',
            responsavel: true,
            menor: false,
            crianca_colo: false
          }]
        },
        {
          id: 'pending-qr-date',
          code: 'PENDING1',
          status: 'pending',
          status_chave: 'pendente',
          status_rotulo: 'Aguardando pagamento',
          status_tom: 'espera',
          contato: 'Pagamento pendente',
          contato_cpf: '52998224725',
          email: 'pendente@email.com',
          contato_whatsapp: '11999998888',
          pagantes: 1,
          criancas: 0,
          grupo: null,
          valor_centavos: 12000,
          criado_em: '21/08/2026 14:30',
          pago_em: null,
          order_id: 'ORD-PENDING-QR',
          is_vip: false,
          bus_number: null,
          passageiros: [{
            posicao: 1,
            nome: 'Pagamento pendente',
            cpf: '529.982.247-25',
            whatsapp: '11999998888',
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
        reservas_pagas: 1,
        reservas_vip: 0,
        reservas_pendentes: 1,
        reservas_falha: 0,
        receita_centavos: 12000,
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  const datas = page.locator('.tabela tbody td[data-rotulo="Pago em"]');
  await expect(datas.nth(0)).toContainText('21/08/2026 14:23');
  await expect(datas.nth(0)).toContainText('Criado em: 21/08/2026 14:20');
  await expect(datas.nth(1)).toContainText('—');
  await expect(datas.nth(1)).toContainText('Criado em: 21/08/2026 14:30');
  await expect(datas.nth(0).locator('.tabela__pagamento-criado')).toHaveCSS('font-size', '12px');
});

test('mostra o total líquido com a taxa calculada por pagamento', async ({ page }) => {
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [],
      resumo: {
        total_a_bordo: 0,
        pagantes: 0,
        criancas_no_colo: 0,
        reservas_pagas: 2,
        reservas_vip: 0,
        reservas_pendentes: 0,
        reservas_falha: 0,
        receita_centavos: 48000,
        receita_liquida_centavos: 47524,
        receita_liquida: '475,24',
        sem_telefone: 0
      },
      frota: { capacidade: 46, minimo: 40, onibus: [] }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();

  await expect(page.getByText('Total líquido', { exact: true })).toBeVisible();
  await expect(page.locator('#r-receita-liquida')).toHaveText('R$ 475,24');
  await expect(page.getByText('Taxa Mercado Pago 0,99%', { exact: true })).toBeVisible();
});

test('abre o tooltip do card da frota ao passar o mouse no título do grupo', async ({ page }) => {
  const id = '00000001-1111-4111-8111-000000000001';
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reservas: [],
      resumo: {
        total_a_bordo: 2, pagantes: 2, criancas_no_colo: 0, reservas_pagas: 1,
        reservas_pendentes: 0, reservas_falha: 0, receita_centavos: 24000, sem_telefone: 0
      },
      frota: {
        capacidade: 46,
        minimo: 40,
        sem_onibus_confirmado: [],
        onibus: [{
          numero: 1, ocupados: 2, assentos_ocupados: 2, vagas_livres: 44,
          pagantes: 2, criancas: 0, total: 2, assentos: 2,
          reservas: [{
            id, code: '00000001', grupo: 'Terraforming Mars', responsavel: 'Ana Souza',
            pagantes: 2, criancas: 0, total: 2, assentos: 2, is_vip: false,
            pago_em: '10/10/2026 10:00',
            passageiros: [
              { posicao: 1, nome: 'Ana Souza', responsavel: true, menor: false, crianca_colo: false },
              { posicao: 2, nome: 'Bruno Souza', responsavel: false, menor: false, crianca_colo: false }
            ]
          }]
        }]
      }
    })
  }));

  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();

  const tooltip = page.locator('#grupo-info-' + id);
  await expect(tooltip).toBeHidden();
  await expect(page.locator('.grupo-item__titulo')).not.toHaveAttribute('title', /.*/);
  await page.locator('.grupo-item__titulo').hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Grupo: Terraforming Mars');
  await expect(tooltip).toContainText('Contato principal: Ana Souza');
});

function respostaFrotaComDesistencia(extra = {}) {
  const resumo = {
    total_a_bordo: 5, pagantes: 4, criancas_no_colo: 1, reservas_pagas: 3,
    reservas_pendentes: 0, reservas_falha: 0, receita_centavos: 24000, sem_telefone: 0
  };
  const grupo = {
    id: '00000001-1111-4111-8111-000000000001', code: '00000001', grupo: 'Terraforming Mars',
    responsavel: 'Ana Souza', pagantes: 2, criancas: 1, total: 3, assentos: 2, desistentes: 1,
    is_vip: false, pago_em: '10/10/2026 10:00',
    passageiros: [
      { posicao: 1, nome: 'Ana Souza', responsavel: true, menor: false, crianca_colo: false, faixa: '18 anos ou mais', desistiu: false },
      { posicao: 2, nome: 'Bruno Desistente', responsavel: false, menor: false, crianca_colo: false, faixa: '18 anos ou mais', desistiu: true },
      { posicao: 3, nome: 'Clara Souza', responsavel: false, menor: true, crianca_colo: false, faixa: '6 a 17 anos', desistiu: false },
      { posicao: 4, nome: 'Duda Colo', responsavel: false, menor: true, crianca_colo: true, faixa: '0 a 5 anos', desistiu: false }
    ]
  };
  const comum = (id, code, nome, isVip) => ({
    id, code, grupo: null, responsavel: nome, pagantes: 1, criancas: 0, total: 1, assentos: 1, desistentes: 0,
    is_vip: isVip, pago_em: '10/10/2026 10:00',
    passageiros: [{ posicao: 1, nome, responsavel: true, menor: false, crianca_colo: false, faixa: '18 anos ou mais', desistiu: false }]
  });
  return {
    reservas: [],
    resumo,
    frota: {
      capacidade: 46,
      minimo: 40,
      sem_onibus_confirmado: [{
        id: '00000009-9999-4999-8999-000000000009', code: '00000009', contato: 'Fabio Espera', grupo: null,
        pagantes: 1, criancas: 0, total: 1, desistentes: 1, is_vip: false, pago_em: '10/10/2026 10:00',
        passageiros: [
          { posicao: 1, nome: 'Fabio Espera', responsavel: true, menor: false, crianca_colo: false, faixa: '18 anos ou mais', desistiu: false },
          { posicao: 2, nome: 'Gil Desistente', responsavel: false, menor: false, crianca_colo: false, faixa: '18 anos ou mais', desistiu: true }
        ]
      }],
      onibus: [{
        numero: 1, ocupados: 5, assentos_ocupados: 5, vagas_livres: 41,
        pagantes: 5, criancas: 1, total: 6, assentos: 5,
        reservas: [
          grupo,
          comum('00000002-2222-4222-8222-000000000002', '00000002', 'Hugo Comum', false),
          comum('00000003-3333-4333-8333-000000000003', '00000003', 'Iris Vip', true),
          comum('00000004-4444-4444-8444-000000000004', '00000004', 'Joao Comum', false),
          comum('00000005-5555-4555-8555-000000000005', '00000005', 'Kate Vip', true)
        ]
      }],
      ...extra
    }
  };
}

async function abrirFrotaComDesistencia(page, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(respostaFrotaComDesistencia())
  }));
  await page.goto('/painel-onibus.html');
  await expect(page.locator('#embarque-sidebar')).not.toBeVisible();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
}

test('pinta de vermelho um meeple por pagante desistente, depois dos roxos e antes do colo', async ({ page }) => {
  await abrirFrotaComDesistencia(page);
  const card = page.locator('.grupo-item[data-reserva="00000001-1111-4111-8111-000000000001"]');
  const individual = card.locator('.grupo-item__meeples-individual');
  await expect(individual.locator('.meeple-svg--adult:not(.meeple-svg--desistente)')).toHaveCount(2);
  await expect(individual.locator('.meeple-svg--desistente')).toHaveCount(1);
  await expect(individual.locator('.meeple-svg--child')).toHaveCount(1);
  const classes = await individual.locator('svg').evaluateAll(svgs => svgs.map(s =>
    s.classList.contains('meeple-svg--desistente') ? 'red' : s.classList.contains('meeple-svg--child') ? 'colo' : 'roxo'));
  expect(classes).toEqual(['roxo', 'roxo', 'red', 'colo']);
  const cor = await individual.locator('.meeple-svg--desistente').evaluate(el => getComputedStyle(el).color);
  expect(cor).toBe('rgb(163, 35, 43)');
  const roxo = await individual.locator('.meeple-svg--adult:not(.meeple-svg--desistente)').first().evaluate(el => getComputedStyle(el).color);
  expect(roxo).toBe('rgb(123, 31, 162)');
  // A descrição continua contando só os ativos.
  await expect(card.locator('.grupo-item__meeples')).toHaveAttribute('title', '2 pagantes + 1 criança de colo');
});

test('mostra a contagem vermelha no layout compacto dos meeples', async ({ page }) => {
  await abrirFrotaComDesistencia(page);
  const dados = respostaFrotaComDesistencia();
  dados.frota.onibus[0].reservas[0].pagantes = 6;
  dados.frota.onibus[0].reservas[0].desistentes = 3;
  await page.unroute('**/api/bus-admin-data*');
  await page.route('**/api/bus-admin-data*', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(dados)
  }));
  await page.reload();
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
  const meeples = page.locator('.grupo-item[data-reserva="00000001-1111-4111-8111-000000000001"] .grupo-item__meeples');
  await expect(meeples).toHaveClass(/grupo-item__meeples--compacta/);
  const compacto = meeples.locator('.grupo-item__meeples-compacto');
  await expect(compacto).toBeVisible();
  await expect(compacto.locator('.grupo-item__meeples-contagem')).toHaveText(['6', '3', '1']);
  await expect(compacto.locator('.meeple-svg--desistente')).toHaveCount(1);
  const cor = await compacto.locator('.grupo-item__meeples-contagem--desistentes').evaluate(el => getComputedStyle(el).color);
  expect(cor).toBe('rgb(163, 35, 43)');
});

test('tooltip mostra o desistente em vermelho e riscado com "Desistência" no lugar da faixa', async ({ page }) => {
  await abrirFrotaComDesistencia(page);
  const id = '00000001-1111-4111-8111-000000000001';
  await page.locator('.grupo-item[data-reserva="' + id + '"] .grupo-item__titulo').hover();
  const tooltip = page.locator('#grupo-info-' + id);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Contato principal: Ana Souza');
  const itens = tooltip.locator('.grupo-item__tooltip-item');
  await expect(itens).toHaveCount(3);
  const desistente = itens.filter({ hasText: 'Bruno Desistente' });
  await expect(desistente).toContainText('2 - Bruno Desistente | Desistência');
  await expect(desistente).not.toContainText('18 anos ou mais');
  const nome = desistente.locator('.grupo-item__tooltip-nome-desistiu');
  expect(await nome.evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('line-through');
  const corNome = await nome.evaluate(el => getComputedStyle(el).color);
  expect(corNome).toBe('rgb(248, 113, 113)');
  const faixa = desistente.locator('.grupo-item__tooltip-faixa--desistiu');
  await expect(faixa).toHaveText('Desistência');
  expect(await faixa.evaluate(el => getComputedStyle(el).color)).toBe(corNome);
  // Ativos mantêm a faixa; o nome ativo não é riscado.
  await expect(itens.filter({ hasText: 'Clara Souza' })).toContainText('6 a 17 anos');
  await expect(itens.filter({ hasText: 'Duda Colo' })).toContainText('0 a 5 anos');
  expect(await itens.filter({ hasText: 'Clara Souza' }).evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
});

test('reservas VIP vêm primeiro no card do ônibus e o espaço livre fica por último', async ({ page }) => {
  await abrirFrotaComDesistencia(page);
  const ordem = await page.locator('.onibus-planta__assentos-grid > *').evaluateAll(nos => nos.map(n =>
    n.dataset.reserva ? (n.dataset.reserva.slice(0, 8) + (n.classList.contains('grupo-item--vip') ? ':vip' : '')) : n.className));
  expect(ordem).toEqual([
    '00000003:vip', '00000005:vip', '00000001', '00000002', '00000004', 'onibus-vagas-livres-slot'
  ]);
});

test('lista "Sem ônibus confirmado" não mostra o passageiro desistente', async ({ page }) => {
  await abrirFrotaComDesistencia(page);
  const lista = page.locator('#frota-sem-onibus .frota-sem-onibus__passageiros');
  await expect(lista).toHaveCount(1);
  await expect(lista).toContainText('Fabio Espera');
  await expect(lista).not.toContainText('Gil Desistente');
});
