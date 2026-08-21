# Resumo a bordo e saída manual de VIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o total de passageiros a bordo no resumo do painel e permitir que VIPs reais sejam movidos manualmente para “Sem ônibus confirmado”.

**Architecture:** O total será calculado no backend, junto da mesma passagem que já contabiliza reservas confirmadas, evitando uma segunda fonte de verdade no frontend. O menu visual existente continuará usando o endpoint de alocação atual; apenas deixará de esconder a opção de destino nulo para VIPs reais e omitirá o subtítulo específico da fila nesse caso.

**Tech Stack:** PHP/MySQL em `php/mysql`, JavaScript vanilla em `assets/js/painel-onibus.js`, Playwright e testes PHP existentes.

## Global Constraints

- Alterar apenas reservas com status confirmado no cálculo de `total_a_bordo`.
- Crianças de colo entram no total de pessoas, mas não no total de assentos físicos da Frota.
- A ação de retirar VIP será sempre manual; nenhuma alocação automática será alterada.
- VIPs legados virtuais (`vip_1`, `vip_2`, etc.) continuarão protegidos pelo backend.
- Para VIP real, mostrar `Sem ônibus confirmado` sem o subtítulo `Enviar para a fila de espera`.
- Não alterar pagamento, webhook, e-mails, autenticação ou validação de capacidade.

---

## Task 1: Criar o teste de regressão do resumo e do menu VIP

**Files:**
- Modify: `analytics/tests/painel-empty-fleet.spec.js`

- [x] Adicionar uma resposta mockada com uma reserva VIP real e uma reserva comum no BUS 1, além de `resumo.total_a_bordo: 2`.
- [x] Verificar que o resumo renderiza `2` em `#r-total`.
- [x] Abrir o menu `Mover` do card VIP e verificar a opção `Sem ônibus confirmado`.
- [x] Verificar que essa opção não possui elemento `<small>` com texto de fila de espera.
- [x] Interceptar `api/bus-fleet-assign*`, clicar na opção e verificar o corpo `{ registration_id: <id-vip>, bus_number: null }`.
- [x] Executar o teste antes da implementação e registrar a falha porque VIPs não exibem a opção.

Payload mínimo do teste:

```js
const vipId = '554ea5db-d723-4299-bfe0-505165caab70';

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
```

## Task 2: Corrigir o total confirmado no backend

**Files:**
- Modify: `php/mysql/bus-admin-data.php:338-350`

- [x] Dentro do ramo `if ($st['chave'] === 'pago')`, depois de atualizar pagantes e crianças, somar o total de pessoas confirmadas:

```php
$resumo['pagantes'] += (int) $r['passenger_count'];
$resumo['criancas_no_colo'] += (int) $r['children_count'];
$resumo['total_a_bordo'] += (int) $r['passenger_count'] + (int) $r['children_count'];
```

- [x] Não incrementar `total_a_bordo` nos ramos pendente ou falha.
- [x] Não usar `assentos` nessa métrica, preservando a distinção entre pessoas e lugares físicos.

## Task 3: Liberar saída manual do VIP para a fila

**Files:**
- Modify: `assets/js/painel-onibus.js:1066-1116`

- [x] Tornar a renderização do subtítulo da opção condicional, para que a opção VIP possa existir sem texto secundário:

```js
var detalheHtml = detalhe
  ? '<small>' + detalhe + '</small>'
  : '';
opcao.innerHTML = (tipo === 'espera' ? iconeEspera : iconeOnibus)
  + '<span class="grupo-item__mover-opcao-copy"><strong>' + titulo + '</strong>'
  + detalheHtml + '</span>';
```

- [x] Substituir o bloco condicional atual por uma chamada para todos os cards:

```js
adicionarOpcaoMover(
  null,
  'Sem ônibus confirmado',
  r.is_vip ? '' : 'Enviar para a fila de espera',
  'espera'
);
```

- [x] Manter o callback atual chamando `moverParaOnibus(r.id, null)` e fechando o menu antes da requisição.
- [x] Preservar a validação e o tratamento de erro existentes.

## Task 4: Verificar o fluxo completo

**Files:**
- Verify: `php/mysql/bus-admin-data.php`
- Verify: `assets/js/painel-onibus.js`
- Verify: `analytics/tests/painel-empty-fleet.spec.js`

- [x] Executar `node --check assets/js/painel-onibus.js`.
- [x] Executar `php -l php/mysql/bus-admin-data.php`.
- [x] Executar `php -l php/mysql/bus-fleet-assign.php`.
- [x] Executar `npx playwright test analytics/tests/painel-empty-fleet.spec.js --reporter=line`.
- [x] Executar `npm run test:analytics -- --reporter=line`.
- [x] Executar os testes PHP de frota: `php php/tests/bus-fleet-balance.test.php` e `php php/tests/vip-reservations.test.php`.
- [x] Executar o detector do Impeccable nos alvos alterados:
  `node /Users/cassio/GitHubPessoal/kob-site/.agents/skills/impeccable/scripts/detect.mjs --json painel-onibus.html assets/js/painel-onibus.js`.
- [x] Conferir `git diff --check` e revisar o diff para confirmar que a alteração não toca pagamentos, webhook ou autenticação.

## Self-review

- O cálculo é corrigido na fonte do dado e só inclui reservas confirmadas.
- O menu mantém a mesma ação, endpoint, ícone e acessibilidade; apenas amplia o destino para VIP real.
- O subtítulo vazio é omitido sem deixar uma linha visual em branco.
- A compatibilidade com VIP legado continua no backend e não depende do frontend.
- O teste cobre o número exibido, a opção visual e o payload manual enviado ao backend.
