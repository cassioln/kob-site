# Panel Net Revenue Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the “Sem telefone” summary card with the net revenue credited after the 0.99% Mercado Pago fee.

**Architecture:** The authenticated API calculates a rounded fee for each confirmed non-VIP payment before it adds the result to `receita_liquida_centavos`. The panel renders that API value in the existing fourth summary card and labels the fee as a secondary note.

**Tech Stack:** PHP 8, Vanilla JavaScript, HTML, Playwright.

## Global Constraints

- Rate: exactly 0.99%.
- Calculate the fee and rounding per approved non-VIP reservation, never on the aggregate.
- Pending, failed, cancelled, refunded and VIP reservations contribute zero.
- Main label: `Total líquido`; secondary copy: `Taxa Mercado Pago 0,99%`.
- Keep `Total recebido` as the gross amount.

---

### Task 1: Add a net revenue API summary field

**Files:**
- Modify: `php/mysql/bus-admin-data.php:120-360`

**Interfaces:**
- Consumes: confirmed registration `amount_cents` and `is_vip`.
- Produces: `resumo.receita_liquida_centavos` (integer) and `resumo.receita_liquida` (Brazilian-formatted string).

- [ ] **Step 1: Add the UI regression fixture with a per-payment rounding case**

```js
resumo: {
  receita_centavos: 48000,
  receita_liquida_centavos: 47524,
  receita_liquida: '475,24'
}
```

- [ ] **Step 2: Run the focused test to verify it fails against the current card**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js -g "total líquido"`

Expected: FAIL because the fourth card still has `r-sem-telefone` and no liquid value.

- [ ] **Step 3: Calculate liquid revenue when a non-VIP payment is counted**

```php
$valorCentavos = (int) $r['amount_cents'];
$taxaCentavos = (int) round($valorCentavos * 0.0099, 0, PHP_ROUND_HALF_UP);
$resumo['receita_centavos'] += $valorCentavos;
if (empty($r['is_vip'])) {
    $resumo['receita_liquida_centavos'] += $valorCentavos - $taxaCentavos;
}
```

After the loop, format both cent-based values with `number_format(... / 100, 2, ',', '.')`.

- [ ] **Step 4: Keep the response backward-compatible**

Initialize `receita_liquida_centavos` to `0`; the frontend fallback must calculate `receita_centavos * 0.9901` only when the new field is absent.

### Task 2: Replace the fourth summary card and render the liquid total

**Files:**
- Modify: `painel-onibus.html:96-100`
- Modify: `assets/js/painel-onibus.js:48-52, 664-670`
- Modify: `analytics/tests/painel-empty-fleet.spec.js`

**Interfaces:**
- Consumes: `resumo.receita_liquida` or `resumo.receita_liquida_centavos`.
- Produces: `#r-receita-liquida` showing `R$ 475,24`.

- [ ] **Step 1: Replace the static card semantics**

```html
<div class="resumo__item">
  <dt>Total líquido</dt>
  <dd id="r-receita-liquida">—</dd>
  <p class="resumo__nota">Taxa Mercado Pago 0,99%</p>
</div>
```

- [ ] **Step 2: Render the API result with a safe fallback**

```js
var liquida = resumo.receita_liquida !== undefined
  ? resumo.receita_liquida
  : ((Number(resumo.receita_liquida_centavos || 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }));
el.rReceitaLiquida.textContent = 'R$ ' + liquida;
```

- [ ] **Step 3: Run panel regression coverage**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js`

Expected: exit 0, with the card label, note and per-payment rounded total asserted.

- [ ] **Step 4: Commit with the feature work**

```bash
git add php/mysql/bus-admin-data.php painel-onibus.html assets/js/painel-onibus.js analytics/tests/painel-empty-fleet.spec.js
git commit -m "feat: show net revenue in panel summary"
```
