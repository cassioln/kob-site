# Painel WhatsApp/CPF Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reservations table show WhatsApp before CPF and vertically center every generated data cell without changing panel behavior.

**Architecture:** Keep the table’s existing HTML/JavaScript rendering path. Update the static header and the dynamic cell append order together, then apply the alignment to cells selected by `data-rotulo`; add one Playwright regression test against the rendered table.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, Playwright tests, npm test scripts.

## Global Constraints

- Preserve all existing reservation, filter, WhatsApp-link, export, and fleet logic.
- Preserve the pre-existing local edit in `assets/css/painel-onibus.css`.
- Keep the mobile `data-rotulo` labels and responsive cell layout intact.

---

### Task 1: Lock the table contract with a regression test

**Files:**
- Modify: `analytics/tests/painel-empty-fleet.spec.js`

**Interfaces:**
- Consumes: the existing `page` fixture and `/api/bus-admin-data` route stubs.
- Produces: a test that asserts the rendered header/cell order and computed alignment.

- [ ] **Step 1: Add a fixture with one passenger containing both contact fields**

Use the existing panel route pattern to return one confirmed reservation whose passenger has a valid CPF and WhatsApp. Assert the header sequence around the changed columns, the first row’s `data-rotulo` sequence, and the CSS values:

```js
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

  await expect(page.locator('.tabela thead th').allTextContents())
    .resolves.toEqual(['RESERVA', 'PASSAGEIRO', 'WHATSAPP', 'CPF', 'GRUPO', 'ÔNIBUS', 'STATUS', 'PAGO EM']);

  const cells = page.locator('.tabela tbody tr').first().locator('td');
  await expect(cells.nth(2)).toHaveAttribute('data-rotulo', 'WhatsApp');
  await expect(cells.nth(3)).toHaveAttribute('data-rotulo', 'CPF');
  await expect(cells.nth(2)).toHaveCSS('align-content', 'center');
  await expect(cells.nth(2)).toHaveCSS('vertical-align', 'middle');
});
```

- [ ] **Step 2: Run the focused test and verify it fails before implementation**

Run:

```bash
npx playwright test analytics/tests/painel-empty-fleet.spec.js -g "WhatsApp antes de CPF"
```

Expected: FAIL because the current header/cell order is CPF before WhatsApp and the current cell alignment is `baseline`.

### Task 2: Implement the synchronized order and alignment

**Files:**
- Modify: `painel-onibus.html:145-155`
- Modify: `assets/js/painel-onibus.js:588-601`
- Modify: `assets/css/painel-onibus.css:557-568`

**Interfaces:**
- Consumes: the existing table header, `celula()` renderer, and responsive `data-rotulo` CSS.
- Produces: a table whose static and dynamic column order agree and whose cells are vertically centered.

- [ ] **Step 1: Swap the static header labels**

Change only the adjacent header elements so the sequence becomes:

```html
<th scope="col">WhatsApp</th>
<th scope="col" class="tabela__col-cpf">CPF</th>
```

- [ ] **Step 2: Swap the dynamic cell creation blocks**

Move the complete WhatsApp block before the CPF cell, retaining the existing link creation, fallback text, classes, and `data-rotulo` values:

```js
      if (p.whatsapp) {
        var linkWhatsapp = criarLinkWhatsapp(p.whatsapp, p.nome || r.contato);
        if (linkWhatsapp) {
          celula('WhatsApp', linkWhatsapp, 'tabela__tel');
        } else {
          celula('WhatsApp', p.whatsapp, 'tabela__tel');
        }
      } else {
        var telefoneAusente = p.crianca_colo ? 'N/A' : 'Não informado';
        celula('WhatsApp', telefoneAusente, 'tabela__tel tabela__tel--vazio');
      }

      celula('CPF', p.cpf || '—', 'tabela__cpf');
```

- [ ] **Step 3: Center cells identified by `data-rotulo`**

Add a focused rule after the base `.tabela tbody td` rule, without removing the user’s local `.tabela__tel--vazio` edit:

```css
.tabela tbody td[data-rotulo] {
  align-content: center;
  vertical-align: middle;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx playwright test analytics/tests/painel-empty-fleet.spec.js -g "WhatsApp antes de CPF"
```

Expected: PASS.

### Task 3: Verify the panel regression surface

**Files:**
- No additional files.

- [ ] **Step 1: Run all focused panel tests**

Run:

```bash
npx playwright test analytics/tests/painel-empty-fleet.spec.js
```

Expected: all tests pass, including empty-fleet access, VIP movement, WhatsApp validation, WhatsApp links, and missing-contact labels.

- [ ] **Step 2: Inspect the final diff and workspace state**

Run:

```bash
git diff --check
git diff -- painel-onibus.html assets/js/painel-onibus.js assets/css/painel-onibus.css analytics/tests/painel-empty-fleet.spec.js
git status --short
```

Expected: only the requested table/header/test changes are introduced; the pre-existing local CSS edit remains preserved.

- [ ] **Step 3: Commit the implementation**

```bash
git add painel-onibus.html assets/js/painel-onibus.js assets/css/painel-onibus.css analytics/tests/painel-empty-fleet.spec.js
git commit -m "fix: align panel contact columns"
```
