# Legacy Mobile Phone Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept valid Brazilian legacy mobile numbers with DDD and eight subscriber digits beginning with 9, without weakening invalid-number protection.

**Architecture:** Keep the validation rule identical in the public reservation form, the panel/VIP form, and PHP. Inputs with DDI 55 normalize to national digits; accepted legacy values remain stored without DDI and use the existing ten-digit display mask.

**Tech Stack:** Vanilla JavaScript, PHP 8, Playwright, PHP CLI tests.

## Global Constraints

- Accept only valid Brazilian DDDs.
- Ten national digits accept fixed lines beginning 2–5 and legacy mobiles beginning 9.
- Eleven national digits accept only `DDD + 9 + eight digits`.
- Store national digits only; never store DDI 55.
- Keep repeated digits and all other prefixes/lengths invalid.

---

### Task 1: Align validation and panel WhatsApp links

**Files:**
- Modify: `assets/js/onibus.js:210-224`
- Modify: `assets/js/painel-onibus.js:290-304`
- Modify: `php/lib/validation.php:123-165`
- Modify: `php/tests/validation.test.php:38-43`
- Modify: `analytics/tests/painel-empty-fleet.spec.js:240-329`

**Interfaces:**
- Consumes: a Brazilian telephone string with optional DDI 55.
- Produces: national digits from `normalizeWhatsappDigits`, `normalizarWhatsapp`, and `normalize_whatsapp`; `''` or `ValidationError` for invalid values.

- [ ] **Step 1: Write the failing backend and panel regression tests**

```php
validation_expect_same('8599266494', normalize_whatsapp('558599266494'), 'celular legado com DDI');
validation_expect_throws(fn () => normalize_whatsapp('8569266494'), 'prefixo legado inválido');
```

```js
// Mock a passenger with whatsapp: '(85) 9926-6494'.
await expect(links).toHaveCount(2);
await expect(links.nth(1)).toHaveAttribute(
  'href',
  'https://api.whatsapp.com/send?phone=558599266494'
);
```

- [ ] **Step 2: Run tests to verify the legacy mobile case fails**

Run: `php php/tests/validation.test.php && npx playwright test analytics/tests/painel-empty-fleet.spec.js -g "atalho seguro de WhatsApp"`

Expected: PHP rejects `8599266494` and the panel does not render its link.

- [ ] **Step 3: Implement the shared rule in each validation boundary**

```js
if (national.length === 10) return /^[2-59]\d{7}$/.test(subscriber);
if (national.length === 11) return /^9\d{8}$/.test(subscriber);
```

```php
if (strlen($national) === 10) {
    return preg_match('/^[2-59]\d{7}$/', $subscriber) === 1;
}
```

Keep DDD validation, repeated-digit rejection and DDI stripping unchanged.

- [ ] **Step 4: Run the regression tests**

Run: `php php/tests/validation.test.php && npx playwright test analytics/tests/painel-empty-fleet.spec.js -g "atalho seguro de WhatsApp"`

Expected: both commands exit 0; the legacy link targets `phone=558599266494`.

### Task 2: Verify the public form contract

**Files:**
- Modify: `analytics/tests/bus-payment.spec.js` only if no existing form test covers the normalizer.

**Interfaces:**
- Consumes: `+55 85 9926-6494` and `+55 85 9815-8188` entered in the reservation form.
- Produces: form payloads `8599266494` and `8598158188`.

- [ ] **Step 1: Add a focused form assertion, when the current fixture exposes the contact fields**

```js
await page.getByLabel(/whatsapp/i).fill('+55 85 9926-6494');
await expect(page.getByLabel(/whatsapp/i)).toHaveValue('(85) 9926-6494');
```

- [ ] **Step 2: Run the focused public-form test**

Run: `npx playwright test analytics/tests/bus-payment.spec.js`

Expected: exit 0. If the existing fixture cannot access the form without a payment dependency, retain the PHP and panel regressions from Task 1 as the contract coverage.

- [ ] **Step 3: Commit with the feature work**

```bash
git add assets/js/onibus.js assets/js/painel-onibus.js php/lib/validation.php php/tests/validation.test.php analytics/tests/painel-empty-fleet.spec.js
git commit -m "fix: support legacy mobile phone numbers"
```
