# Missing Contact Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `Não informado` for optional contact fields left empty and reserve `N/A` for passengers for whom the field does not apply.

**Architecture:** Keep database values unchanged (`NULL`/empty) and centralize the distinction at each operational presentation boundary. The panel will use passenger age metadata, while XLSX and PDF already have child-lap flags available during rendering.

**Tech Stack:** Vanilla JavaScript, CSS, PHP, PhpSpreadsheet-compatible XLSX export, TCPDF/FPDF boarding manifest, Playwright, PHP tests.

## Global Constraints

- Children aged 0–5 years in lap keep `N/A` for contact fields that do not apply.
- Adults and passengers aged 6–17 without an optional WhatsApp/e-mail show `Não informado` in presentation layers.
- Valid WhatsApp values keep the existing secure WhatsApp shortcut.
- Do not change database schema, stored `NULL`/empty values, payment logic, or reservation payloads.
- Preserve the existing visual hierarchy: missing optional data must be smaller/discreet and low emphasis.

---

### Task 1: Panel reservation table labels

**Files:**
- Modify: `assets/js/painel-onibus.js:590-598`
- Modify: `assets/css/painel-onibus.css:797-805`
- Test: `analytics/tests/painel-empty-fleet.spec.js`

**Interfaces:**
- Consumes: `p.crianca_colo` and `p.whatsapp` from the existing panel data model.
- Produces: a WhatsApp cell with `N/A` only for lap children and `Não informado` for other empty values.

- [ ] **Step 1: Add the failing panel assertion**

Add a fixture passenger without WhatsApp and a lap child without WhatsApp to the panel test data, then assert:

```js
await expect(page.locator('.tabela__tel--vazio').filter({ hasText: 'Não informado' })).toHaveCount(1);
await expect(page.locator('.tabela__tel--vazio').filter({ hasText: 'N/A' })).toHaveCount(1);
```

- [ ] **Step 2: Run the focused test and verify the new assertion fails**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js --reporter=dot`

Expected: the existing panel tests pass, but the new label assertions fail because empty values currently render `N/A` indiscriminately.

- [ ] **Step 3: Implement the panel presentation distinction**

Replace the empty WhatsApp branch with a text node whose value depends on the passenger type:

```js
var telefoneAusente = p.crianca_colo ? 'N/A' : 'Não informado';
celula('WhatsApp', telefoneAusente, 'tabela__tel tabela__tel--vazio');
```

Keep the valid-number branch and secure link behavior unchanged. Use the existing `.tabela__tel--vazio` style, adjusting only its size/color if necessary to make the missing value discreet.

- [ ] **Step 4: Run the focused panel tests**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js --reporter=dot`

Expected: all panel tests pass, including one `Não informado` adult/teen cell and one `N/A` lap-child cell.

- [ ] **Step 5: Commit the panel slice**

```bash
git add analytics/tests/painel-empty-fleet.spec.js assets/js/painel-onibus.js assets/css/painel-onibus.css
git commit -m "fix(panel): distinguish missing WhatsApp data"
```

### Task 2: Shared PHP fallback and XLSX export labels

**Files:**
- Create: `php/lib/contact-display.php`
- Modify: `php/mysql/bus-admin-xlsx.php:163-172`
- Test: `php/tests/contact-display.test.php`

**Interfaces:**
- Consumes: optional contact values and a boolean indicating whether the field is not applicable.
- Produces: `bus_missing_contact_label(mixed $value, bool $notApplicable): string`, returning `N/A`, `Não informado`, or the trimmed value.

- [ ] **Step 1: Add the shared fallback test**

Create `php/tests/contact-display.test.php` with these exact cases:

```php
require_once __DIR__ . '/../lib/contact-display.php';
assert(bus_missing_contact_label('', false) === 'Não informado');
assert(bus_missing_contact_label(null, false) === 'Não informado');
assert(bus_missing_contact_label('', true) === 'N/A');
assert(bus_missing_contact_label('  usuario@email.com  ', false) === 'usuario@email.com');
echo "PASS: contact display tests\n";
```

- [ ] **Step 2: Run the shared test and verify it fails**

Run: `php php/tests/contact-display.test.php`

Expected: FAIL because `php/lib/contact-display.php` does not exist yet.

- [ ] **Step 3: Implement the shared fallback and import it in the XLSX exporter**

Create the helper:

```php
function bus_missing_contact_label(mixed $value, bool $notApplicable): string
{
    if ($notApplicable) {
        return 'N/A';
    }
    $text = trim((string) ($value ?? ''));
    return $text === '' ? 'Não informado' : $text;
}
```

Require it from `php/mysql/bus-admin-xlsx.php` and use it in the row builder:

```php
$whatsappPassageiro = $isVip ? '' : bus_missing_contact_label($p['whatsapp'] ?? null, $isChildLap);
if (!$isChildLap && ($p['whatsapp'] ?? '') !== '') {
    $whatsappPassageiro = bus_format_phone((string) $p['whatsapp']);
}

$emailPassageiro = $isVip ? '' : bus_missing_contact_label($p['email'] ?? null, $isChildLap);
if (!$isChildLap && (string) ($p['email'] ?? '') !== '') {
    $emailPassageiro = (string) $p['email'];
} elseif ($responsavel) {
    $emailPassageiro = bus_missing_contact_label($r['email'] ?? null, false);
}
```

Preserve the prior VIP/export contract where non-applicable VIP fields remain blank.

- [ ] **Step 4: Run the shared test and PHP lint**

Run:

```bash
php php/tests/contact-display.test.php
php -l php/mysql/bus-admin-xlsx.php
```

Expected: the helper test passes and no PHP syntax errors occur.

- [ ] **Step 5: Commit the PHP fallback/XLSX slice**

```bash
git add php/lib/contact-display.php php/mysql/bus-admin-xlsx.php php/tests/contact-display.test.php
git commit -m "fix(export): label missing contact data clearly"
```

### Task 3: Boarding PDF labels

**Files:**
- Modify: `php/lib/boarding-pdf.php:200-210`
- Test: `php/tests/boarding-pdf.test.php`

**Interfaces:**
- Consumes: `bus_missing_contact_label`, `$p['is_child_lap']`, and `$p['whatsapp']` in the manifest row renderer.
- Produces: `N/A` for lap children and `Não informado` for applicable passengers without WhatsApp.

- [ ] **Step 1: Add PDF text expectations**

Extend the existing boarding PDF test fixture to include one adult without WhatsApp and one lap child, then assert the extracted text contains both:

```php
assertStringContainsString('Não informado', $text);
assertStringContainsString('N/A', $text);
```

- [ ] **Step 2: Run the PDF test and verify the new assertion fails**

Run: `php php/tests/boarding-pdf.test.php`

Expected: the new `Não informado` assertion fails while the current `N/A` output is still present.

- [ ] **Step 3: Import the shared fallback and update the PDF fallback**

Require `php/lib/contact-display.php`, then use the passenger’s lap-child flag when rendering the phone column:

```php
$tel = ($p['whatsapp'] ?? '') !== ''
    ? bus_format_phone((string) $p['whatsapp'])
    : bus_missing_contact_label(null, !empty($p['is_child_lap']));
```

- [ ] **Step 4: Run PDF tests and lint**

Run:

```bash
php php/tests/boarding-pdf.test.php
php -l php/lib/boarding-pdf.php
```

Expected: all assertions pass and PHP reports no syntax errors.

- [ ] **Step 5: Commit the PDF slice**

```bash
git add php/lib/boarding-pdf.php php/tests/boarding-pdf.test.php
git commit -m "fix(pdf): distinguish missing passenger contacts"
```

### Task 4: Full verification and final review

**Files:**
- Verify: all files changed in Tasks 1–3

- [ ] **Step 1: Run the focused and backend tests**

```bash
npx playwright test analytics/tests/painel-empty-fleet.spec.js --reporter=dot
php php/tests/validation.test.php
php php/tests/boarding-pdf.test.php
npm run test:server
```

- [ ] **Step 2: Check the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended implementation/test files are changed.

- [ ] **Step 3: Review semantics**

Confirm that:

1. An adult with no optional WhatsApp is `Não informado`.
2. A 6–17-year-old with no optional WhatsApp is `Não informado`.
3. A 0–5-year-old lap passenger is `N/A`.
4. A valid phone remains clickable and formatted.
5. Database values remain empty/`NULL` when the user omitted the field.
