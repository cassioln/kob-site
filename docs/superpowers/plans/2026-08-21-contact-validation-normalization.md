# Contact Validation and Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent structurally invalid Brazilian WhatsApp numbers, display reservation-form identity fields in uppercase, persist canonical names and lowercase e-mails, normalize existing records, and add a safe WhatsApp shortcut to the reservations panel.

**Architecture:** Keep the PHP validation layer as the production source of truth and mirror the same canonical rules in the Node payment module used by the server tests. The public checkout and VIP form will use browser-side helpers for masking, inline errors, and uppercase presentation, while the payload remains canonical. The panel will derive a WhatsApp link only from a validated national number and will leave invalid legacy numbers unlinked.

**Tech Stack:** Vanilla JavaScript, CSS, PHP 8 with PDO/MySQL, Node.js built-in test runner, Playwright, and the existing project test scripts.

## Global Constraints

- The contact principal WhatsApp remains required; passenger and VIP WhatsApps remain optional, but a filled optional value must be valid.
- Brazilian phone values accept 10-digit fixed lines, 11-digit mobile lines, or country code `55` followed by 10/11 national digits; persisted phone values contain only national digits.
- The number `55119958957` must be rejected because its 11-digit national interpretation has a mobile subscriber beginning with `1` instead of `9`.
- Names persist as title case with Portuguese connectors such as `de`, `da`, `do`, `das`, `dos`, and `e` kept lowercase when internal; e-mails persist in lowercase.
- Uppercase presentation applies only to the public reservation form, its review UI, and the VIP form; existing panel names and other pages keep their current presentation.
- Existing phone values are not guessed, deleted, or rewritten by the data migration.
- The WhatsApp shortcut uses `https://api.whatsapp.com/send?phone=55<numero-nacional>` and opens with `target="_blank" rel="noopener noreferrer"`.
- No payment is created and no reservation is written when backend validation fails.

---

## File Map

- Modify `php/lib/validation.php`: canonical name, e-mail, DDD, and phone helpers used by all PHP endpoints.
- Modify `php/lib/vip-reservations.php`: consume the shared canonical helpers for VIP payloads.
- Modify `server/bus-payment.mjs`: mirror PHP normalization and phone rules for the Node server/test path.
- Modify `server/tests/bus-payment.test.mjs`: backend acceptance and rejection cases.
- Create `php/tests/validation.test.php`: focused PHP validation and canonicalization tests.
- Modify `assets/js/onibus.js`: checkout masks, inline phone validation, uppercase review presentation, and canonical payload generation.
- Modify `assets/css/onibus.css`: uppercase presentation scoped to checkout fields and review values.
- Modify `painel-onibus.html`: no structural change expected unless the existing VIP form needs an explicit hook; preserve the current dynamic form structure.
- Modify `assets/js/painel-onibus.js`: VIP form normalization/validation and reservations-table WhatsApp link rendering.
- Modify `assets/css/painel-onibus.css`: VIP uppercase presentation and WhatsApp icon/link styling.
- Modify `analytics/tests/bus-payment.spec.js`: browser tests for blocked invalid phone, uppercase form presentation, and canonical payload.
- Modify `analytics/tests/painel-empty-fleet.spec.js`: browser test for WhatsApp link behavior in the reservations table.
- Create `php/db/008_normalize_contact_data.php`: one-time transactional migration for names and e-mails already stored in MySQL.

## Task 1: Establish canonical PHP and Node validation

**Files:**

- Modify: `php/lib/validation.php`
- Modify: `php/lib/vip-reservations.php`
- Modify: `server/bus-payment.mjs`
- Create: `php/tests/validation.test.php`
- Modify: `server/tests/bus-payment.test.mjs`

**Interfaces:**

- `normalize_person_name(mixed $value, string $label, int $min = 2, int $max = 160): string` returns canonical title case or throws `ValidationError`.
- `normalize_whatsapp(mixed $value): string` returns national digits or throws `ValidationError`.
- `is_valid_whatsapp(mixed $value): bool` returns only the structural result without changing the payload.
- Node `normalizePersonName(value, label, minLength, maxLength)` and `normalizeWhatsapp(value)` mirror the PHP behavior used by `validateBusPayload`.

- [ ] **Step 1: Add failing PHP validation cases.**

Append focused assertions to `php/tests/validation.test.php` for:

```php
validation_expect_same('Samara Nascimento de Toledo', normalize_person_name('  SAMARA   NASCIMENTO DE TOLEDO  ', 'Nome'), 'nome canônico');
validation_expect_same('usuario@email.com', normalize_email(' USUARIO@EMAIL.COM '), 'e-mail minúsculo');
validation_expect_same('11999998888', normalize_whatsapp('(11) 99999-8888'), 'celular nacional');
validation_expect_same('11999998888', normalize_whatsapp('5511999998888'), 'celular com DDI');
validation_expect_throws(fn () => normalize_whatsapp('55119958957'), 'WhatsApp incompleto');
validation_expect_throws(fn () => normalize_whatsapp('11912345678'), 'celular sem prefixo 9');
```

The helper `validation_expect_throws` must assert that the callable raises `ValidationError`; it must not connect to the database.

- [ ] **Step 2: Run the PHP test to verify the new cases fail.**

Run: `php php/tests/validation.test.php`

Expected: FAIL because the current name helper does not canonicalize and `normalize_whatsapp` accepts the invalid 11-digit value.

- [ ] **Step 3: Implement the PHP canonical helpers.**

Add a fixed DDD set and normalize the national number before validating its shape:

```php
function normalize_whatsapp(mixed $value): string
{
    $all = digits_only($value);
    $national = (str_starts_with($all, '55') && in_array(strlen($all), [12, 13], true))
        ? substr($all, 2)
        : $all;

    if (!is_valid_brazilian_phone_digits($national)) {
        throw new ValidationError('WhatsApp inválido. Informe um número brasileiro com DDD.');
    }
    return $national;
}
```

`is_valid_brazilian_phone_digits` must require a known DDD, then either 8 subscriber digits beginning in `2`–`5` or 9 subscriber digits beginning in `9`. `normalize_person_name` must collapse whitespace, lowercase with `mb_strtolower`, uppercase the first letter of each token with `mb_substr`, and restore the internal connector list in lowercase.

Change `normalize_text` call sites in the reservation and VIP validation paths to use `normalize_person_name`; leave generic text normalization available for non-person values.

- [ ] **Step 4: Mirror the same rules in `server/bus-payment.mjs`.**

Export the phone/name helpers needed by tests and use them inside `validateBusPayload`. Preserve the existing optional-passenger behavior: empty string becomes `null`, non-empty malformed input throws `WhatsApp do passageiro N inválido.`.

- [ ] **Step 5: Add Node cases for parity.**

In `server/tests/bus-payment.test.mjs`, add payload variants asserting that mixed-case names are returned as `Samara Nascimento de Toledo`, contact e-mail is lowercase, `5511999998888` is accepted, and `55119958957` is rejected before `createRegistration` or Mercado Pago is called.

- [ ] **Step 6: Run the focused backend tests.**

Run:

```bash
php php/tests/validation.test.php
node --test server/tests/bus-payment.test.mjs
```

Expected: all focused PHP and Node tests pass.

- [ ] **Step 7: Commit the backend rule.**

```bash
git add php/lib/validation.php php/lib/vip-reservations.php server/bus-payment.mjs php/tests/validation.test.php server/tests/bus-payment.test.mjs
git commit -m "fix(validation): canonicalize contacts and validate WhatsApp"
```

## Task 2: Apply validation and uppercase presentation to checkout

**Files:**

- Modify: `assets/js/onibus.js`
- Modify: `assets/css/onibus.css`
- Modify: `analytics/tests/bus-payment.spec.js`

**Interfaces:**

- `normalizeFullName(value)` returns the same title-case canonical form as PHP.
- `normalizeEmail(value)` trims and lowercases the value before payload creation.
- `normalizeWhatsappDigits(value)` returns national digits only when valid and an empty result otherwise.
- `validateWhatsappField(field, required, label)` sets `aria-invalid`, focuses the field, and returns a boolean.

- [ ] **Step 1: Add browser assertions for the invalid number and canonical payload.**

Extend the existing mocked checkout test in `analytics/tests/bus-payment.spec.js` with:

```js
await page.locator('#primary-name').fill('SAMARA NASCIMENTO DE TOLEDO');
await page.locator('#primary-whatsapp').fill('55119958957');
await page.getByRole('button', { name: /continuar/i }).click();
await expect(page.locator('#primary-whatsapp')).toHaveAttribute('aria-invalid', 'true');
await expect(page.locator('#bus-form-status')).toContainText(/WhatsApp.*DDD|WhatsApp.*válido/i);
```

Add a valid path that fills uppercase name/e-mail, completes the mocked checkout, and asserts the intercepted request contains `Samara Nascimento de Toledo` and `usuario@email.com`.

- [ ] **Step 2: Run the new browser assertions to verify they fail.**

Run: `npx playwright test analytics/tests/bus-payment.spec.js --grep "WhatsApp|canonical"`

Expected: FAIL because the current mask accepts the malformed value and the current helper only trims names.

- [ ] **Step 3: Implement browser helpers and field validation.**

Replace the current length-only check:

```js
if (digits(primaryWhatsapp.value).length !== 11) {
  return invalid('Informe um WhatsApp válido com DDD.', primaryWhatsapp);
}
```

with the shared structural check. Apply it to the required primary field in `validateStep1` and to non-empty `newPWhatsapp` before saving an additional passenger. Bind `blur` validation so the user receives feedback before trying to advance, while keeping the step transition as the authoritative block.

Update `getPayload()` to use canonical names and lowercase e-mails. Keep the existing CPF and date masks untouched.

- [ ] **Step 4: Add uppercase presentation without changing payload casing.**

Scope CSS to the checkout:

```css
#bus-form input[name="primary_name"],
#bus-form input[type="email"],
#bus-form input[id^="new-p-"] {
  text-transform: uppercase;
}
```

Use explicit uppercase display values in the dynamic review text where CSS alone cannot guarantee the generated text, while `getPayload()` always sends canonical title-case names and lowercase e-mails.

- [ ] **Step 5: Run focused checkout tests.**

Run: `npx playwright test analytics/tests/bus-payment.spec.js --grep "WhatsApp|canonical"`

Expected: the invalid number is blocked at the current step and the valid request contains canonical persisted values.

- [ ] **Step 6: Commit the checkout changes.**

```bash
git add assets/js/onibus.js assets/css/onibus.css analytics/tests/bus-payment.spec.js
git commit -m "fix(checkout): validate WhatsApp and canonicalize identity fields"
```

## Task 3: Apply the same behavior to the VIP form

**Files:**

- Modify: `assets/js/painel-onibus.js`
- Modify: `assets/css/painel-onibus.css`
- Modify: `analytics/tests/painel-empty-fleet.spec.js`

**Interfaces:**

- The dynamically created fields continue using `data-vip-field` and `data-vip-index`.
- `confirmarVips` sends canonical `full_name`, lowercase `email`, national-digit `whatsapp`, and preserves empty optional values.

- [ ] **Step 1: Add a mocked VIP form test.**

Extend the panel fixture with a successful `bus-admin-data` response and a mocked `bus-vip-create` route. Fill:

```js
await page.locator('#vip-0-full_name').fill('SAMARA NASCIMENTO DE TOLEDO');
await page.locator('#vip-0-email').fill('USUARIO@EMAIL.COM');
await page.locator('#vip-0-whatsapp').fill('55119958957');
await page.getByRole('button', { name: /confirmar reservas VIP/i }).click();
```

Assert that the form shows an inline validation error and the create request is not sent. Then replace the phone with `5511999998888`, submit, and assert the request body contains canonical name/e-mail and `11999998888`.

- [ ] **Step 2: Run the VIP test to verify it fails.**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js --grep "VIP.*WhatsApp|VIP.*normal"`

Expected: FAIL because the current VIP form only checks empty required fields and sends display-form values unchanged.

- [ ] **Step 3: Implement VIP normalization and validation.**

In the dynamic input handler, keep the formatted phone in the draft but clear `aria-invalid` only after the field becomes structurally valid or empty. In `confirmarVips`, validate every draft before setting `estado.vipEnviando = true`; focus the first invalid field and keep the dialog open.

Build the payload with:

```js
{
  full_name: normalizeFullName(draft.full_name),
  cpf: draft.cpf.trim(),
  whatsapp: normalizeWhatsappDigits(draft.whatsapp),
  email: normalizeEmail(draft.email),
  bus_number: draft.bus_number === '' ? null : Number(draft.bus_number)
}
```

- [ ] **Step 4: Scope uppercase styling to VIP name/e-mail inputs.**

Add selectors for `[data-vip-field="full_name"]` and `[data-vip-field="email"]` in `assets/css/painel-onibus.css`; do not change the casing of the panel cards or reservations table.

- [ ] **Step 5: Run focused VIP tests and PHP validation.**

Run:

```bash
npx playwright test analytics/tests/painel-empty-fleet.spec.js --grep "VIP.*WhatsApp|VIP.*normal"
php php/tests/vip-reservations.test.php
```

Expected: malformed optional phone blocks submission, empty phone remains valid, and valid payloads pass.

- [ ] **Step 6: Commit the VIP changes.**

```bash
git add assets/js/painel-onibus.js assets/css/painel-onibus.css analytics/tests/painel-empty-fleet.spec.js
git commit -m "fix(vip): validate and canonicalize contact fields"
```

## Task 4: Add the WhatsApp shortcut to the reservations table

**Files:**

- Modify: `assets/js/painel-onibus.js`
- Modify: `assets/css/painel-onibus.css`
- Modify: `analytics/tests/painel-empty-fleet.spec.js`

**Interfaces:**

- `createWhatsappLink(phone, passengerName)` returns an anchor element or `null`.
- The anchor has `href="https://api.whatsapp.com/send?phone=55<national>"`, `target="_blank"`, `rel="noopener noreferrer"`, and an accessible label.

- [ ] **Step 1: Add table fixture assertions.**

Render one reservation with a valid formatted passenger phone and another with `55119958957`. Assert:

```js
const link = page.locator('.tabela__whatsapp-link').first();
await expect(link).toHaveAttribute('href', 'https://api.whatsapp.com/send?phone=5511999998888');
await expect(link).toHaveAttribute('target', '_blank');
await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
await expect(page.locator('.tabela__whatsapp-link')).toHaveCount(1);
```

- [ ] **Step 2: Run the panel link test to verify it fails.**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js --grep "WhatsApp"`

Expected: FAIL because the current table inserts only text through `celula('WhatsApp', ...)`.

- [ ] **Step 3: Implement safe link generation.**

Add a helper that strips formatting, removes a valid leading `55` only for 12/13-digit input, calls the same structural phone predicate, and returns `null` for invalid/empty legacy values. Render a compact inline SVG or the existing project WhatsApp icon inside the anchor next to the visible formatted number. Use the passenger name in `aria-label`; do not put the phone number in a title only.

- [ ] **Step 4: Style the icon without changing table density.**

Add `.tabela__whatsapp-link` and child icon rules with inline-flex alignment, a visible hover/focus state, and a minimum  hit area of 32px. Keep the number text readable and preserve the existing empty-state style for `N/A`.

- [ ] **Step 5: Run the panel link test.**

Run: `npx playwright test analytics/tests/painel-empty-fleet.spec.js --grep "WhatsApp"`

Expected: one valid phone link with DDI `55`, no link for invalid data, and no console errors.

- [ ] **Step 6: Commit the panel shortcut.**

```bash
git add assets/js/painel-onibus.js assets/css/painel-onibus.css analytics/tests/painel-empty-fleet.spec.js
git commit -m "feat(panel): add direct WhatsApp contact links"
```

## Task 5: Normalize existing names and e-mails transactionally

**Files:**

- Create: `php/db/008_normalize_contact_data.php`
- Modify: `php/tests/validation.test.php`

**Interfaces:**

- CLI script loads `php/mysql/lib/db.php`, uses `bus_pdo()`, and performs no network calls other than the configured database connection.
- It updates only `bus_registrations.primary_name`, `bus_registrations.email`, `bus_passengers.full_name`, and `bus_passengers.email`.
- It prints counts by table and commits only if every update succeeds.

- [ ] **Step 1: Add pure migration fixture tests.**

Extend the PHP validation test with multiple values containing uppercase text, repeated spaces, accents, and connector words. Assert the canonical result before writing the migration script.

- [ ] **Step 2: Implement the migration script.**

Use the shared helpers and a transaction. The update shape must be:

```php
$pdo->beginTransaction();
// SELECT id, primary_name, email FROM bus_registrations
// SELECT registration_id, position, full_name, email FROM bus_passengers
// normalize only selected fields
// UPDATE by primary key / composite key only when a value changed
$pdo->commit();
```

Before updating, print only row counts and field counts, never names, e-mails, CPF, or phones. On any exception, roll back and exit non-zero. Add a CLI guard so the script cannot be invoked through the web server.

- [ ] **Step 3: Run a read-only preflight.**

Run a query that reports counts of rows with names/e-mails requiring normalization and counts of structurally invalid non-empty phones, without printing PII. Confirm the migration will not touch phone columns.

- [ ] **Step 4: Run the migration once against the configured database.**

Run: `php php/db/008_normalize_contact_data.php`

Expected: transaction commits, field counts are printed, and no phone update is reported.

- [ ] **Step 5: Verify idempotency and database state.**

Run the migration a second time and expect zero changed fields. Then query only aggregate counts to confirm names/e-mails are canonical and the phone invalid-count is unchanged.

- [ ] **Step 6: Commit the migration script.**

```bash
git add php/db/008_normalize_contact_data.php php/tests/validation.test.php
git commit -m "chore(data): normalize stored contact identity fields"
```

## Task 6: Full verification and release checkpoint

**Files:**

- No new source files; review all files from Tasks 1–5.

- [ ] **Step 1: Run PHP syntax and focused tests.**

```bash
php -l php/lib/validation.php
php -l php/lib/vip-reservations.php
php -l php/db/008_normalize_contact_data.php
php php/tests/validation.test.php
php php/tests/vip-reservations.test.php
```

Expected: no syntax errors and all focused tests pass.

- [ ] **Step 2: Run the Node server tests.**

Run: `npm run test:server`

Expected: all server tests pass, including the new canonicalization and phone cases.

- [ ] **Step 3: Run the targeted Playwright tests.**

```bash
npx playwright test analytics/tests/bus-payment.spec.js --grep "WhatsApp|canonical"
npx playwright test analytics/tests/painel-empty-fleet.spec.js --grep "WhatsApp|VIP"
```

Expected: checkout blocks invalid phones, VIP submission normalizes fields, and the panel link has the correct security attributes.

- [ ] **Step 4: Run the complete project verification.**

```bash
npm run test:server
npm run test:analytics
npm run test:analytics:pii
git diff --check
git status --short
```

Expected: all tests pass, diff check is clean, and only intentional implementation commits remain. Do not push or deploy automatically from this checkpoint.
