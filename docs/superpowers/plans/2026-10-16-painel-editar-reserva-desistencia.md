# Editar reserva e registrar desistência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modal no painel do ônibus para corrigir todos os dados de uma reserva e marcar desistência por passageiro, com a desistência refletida na lista, no Excel, na frota e na chamada de embarque.

**Architecture:** A regra de negócio fica numa lib PHP pura (`php/lib/registration-edit.php`) que recebe o estado atual da reserva e o pedido de edição e devolve o novo estado + diff, sem PDO — testável sem banco. Um endpoint fino (`php/mysql/bus-registration-update.php`) faz lock, capacidade, CPF global, gravação, log e e-mail. Todas as leituras operacionais (frota, embarque, manifesto, balanceamento) passam a excluir passageiros/reservas com `withdrawn_at`; as contagens `passenger_count`/`children_count` passam a significar "ativos", então quem já lê esses campos continua certo. O front ganha um módulo próprio (`assets/js/painel-editar-reserva.js`) montado pelo `painel-onibus.js`, no mesmo padrão `window.KobX(root, options)` dos módulos da chamada.

**Tech Stack:** PHP 8.0+ (CI usa 8.0; local 8.5), MySQL 5.7/8.0 via PDO, JS ES5-compatível sem build, Playwright (Chromium), testes PHP como scripts `php php/tests/x.test.php`.

**Spec:** `docs/superpowers/specs/2026-10-16-painel-editar-reserva-desistencia-design.md`

## Global Constraints

- Painel e modal só em PT-BR (spec, Não-objetivos). A chamada de embarque tem pt/en/es; nada novo de texto entra nela.
- Não alterar `amount_cents`, `status`, receita ou receita líquida em nenhum caminho de edição.
- Desistência nunca apaga linha: `withdrawn_at`/`withdrawal_reason` em `bus_passengers`; reserva inteira em `bus_registrations.withdrawn_at`, `withdrawn_bus_number`, `withdrawn_fleet_status`.
- Capacidade física: 46 assentos por ônibus; criança de colo não ocupa assento (`bus_fleet_seat_count(p, c) = p`).
- Horários gravados em UTC (`gmdate('Y-m-d H:i:s')`); exibidos em America/Sao_Paulo (`CONVERT_TZ(..., "+00:00", "-03:00")`, padrão já usado).
- E-mail administrativo vai para `BUS_EMAIL_ADMIN` (`administrativo@kriativosonboard.com.br`) via `bus_enviar_com_retry`; falha no envio não desfaz o salvamento (`log_failure`).
- `php/db/` não vai para o FTP: toda coluna/tabela nova precisa de bootstrap em runtime (`ALTER ... ` em `try/catch`, padrão `bus_fleet_ensure_assignment_status`) além do SQL versionado.
- Subir `?v=` de todo CSS/JS alterado em `painel-onibus.html` **e** no `embarque-sw.js` (o teste `server/tests/boarding-offline-shell.test.mjs` exige igualdade).
- Rotas novas em `.htaccess` (`RewriteRule ^api/<nome>/?$ php/mysql/<nome>.php [QSA,L]`); `router.php` já mapeia `/api/*` em dev.
- Copy fixa do spec: título do modal "Editar reserva #CODE"; botões "Cancelar" / "Salvar alterações"; toggle "Desistiu"; campo "Motivo (opcional)"; bloco "Novo responsável"; status de reserva inteira "Desistente"; etiqueta na lista "Desistiu"; aviso colo→pagante "passa a ocupar um assento sem pagamento correspondente"; assunto do e-mail "Reserva CODE – alteração no painel".
- Playwright local só pelo Terminal do app, em porta privada (memória do projeto); o CI roda `@smoke` em Chromium.

## Review Focus

- **Webhook reentregue para reserva desistente** — Mercado Pago reenviando `confirmed` não pode devolver a reserva à frota. Teste no Task 3 (`bus_assign_fleet` ignora `withdrawn_at`).
- **Dois administradores salvando a mesma reserva** — o segundo salvamento não pode sobrescrever o primeiro às cegas. O pedido leva `expected_updated_at`; divergência → 409 "A reserva mudou desde que você abriu". Teste no Task 2 (lib) e Task 4 (endpoint).
- **Chamada offline com fila pendente para alguém que desistiu** — o POST de presença tem que voltar `manifest_changed` (o cliente já trata como `removed`). Teste no Task 3 (`bus_boarding_save`).
- **CPF trocado para o de outra reserva** — bloqueado com mensagem que diz o código da outra reserva. Teste no Task 4.
- **Reserva individual cujo único passageiro desiste e depois é reativada com o ônibus cheio** — 409 com vagas restantes; nada gravado. Teste no Task 2 (lib devolve `seats_needed`) e Task 4 (capacidade).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `php/db/010_registration_edit.sql` (novo) | Migração versionada: colunas de desistência + tabela de log |
| `php/lib/registration-edit.php` (novo) | Regras puras: normaliza pedido, valida, calcula novo estado, diff |
| `php/lib/registration-edit-schema.php` (novo) | `bus_registration_edit_ensure_schema(PDO)` — bootstrap runtime |
| `php/lib/registration-edit-email.php` (novo) | HTML/texto do e-mail administrativo |
| `php/mysql/bus-registration-update.php` (novo) | Endpoint POST: lock, capacidade, CPF global, grava, log, e-mail |
| `php/mysql/bus-group-names.php` (novo) | GET: nomes livres do catálogo (para o seletor de grupo) |
| `php/lib/bus-fleet.php` | Ocupação, snapshot e `bus_assign_fleet` ignoram reservas desistentes |
| `php/lib/bus-boarding.php` | Manifesto, espera e `bus_boarding_save` ignoram desistentes |
| `php/mysql/bus-manifest.php`, `bus-fleet-assign.php`, `bus-fleet-auto-balance.php` | Mesmo filtro |
| `php/mysql/bus-admin-data.php` | Expõe desistência por passageiro/reserva; frota e resumo ignoram desistentes |
| `php/mysql/bus-admin-xlsx.php`, `php/lib/xlsx.php` | Coluna "Desistência" e estilo esmaecido |
| `assets/js/painel-editar-reserva.js` (novo) | Modal: render, acordeão, validação, payload, envio |
| `assets/js/painel-onibus.js` | Ícone de editar na tabela e nos cards; marca de desistente; filtro "Desistentes"; monta o módulo |
| `assets/css/painel-onibus.css` | Estilos do modal, ícone, linha desistente |
| `painel-onibus.html` | `<dialog id="painel-editar-dialog">`, botão de filtro, script novo, `?v=` |
| `.htaccess` | 2 rotas |
| `php/tests/registration-edit.test.php` (novo) | Lib pura + integração MySQL (opcional por DSN) |
| `analytics/tests/painel-editar-reserva.spec.js` (novo) | Fluxos do modal com API mockada |
| `.github/workflows/tests.yml` | Roda `php php/tests/registration-edit.test.php` |

---

### Task 1: Schema de desistência e log

**Files:**
- Create: `php/db/010_registration_edit.sql`
- Create: `php/lib/registration-edit-schema.php`
- Test: `php/tests/registration-edit.test.php` (seção MySQL, reaproveitada nos Tasks 3–4)
- Modify: `.github/workflows/tests.yml:62-65`

**Interfaces:**
- Produces: `bus_registration_edit_ensure_schema(PDO $pdo): void` — idempotente, tolera falta de permissão DDL (como `bus_fleet_ensure_assignment_status`).
- Produces (colunas): `bus_passengers.withdrawn_at DATETIME NULL`, `bus_passengers.withdrawal_reason VARCHAR(500) NULL`, `bus_registrations.withdrawn_at DATETIME NULL`, `bus_registrations.withdrawn_bus_number TINYINT UNSIGNED NULL`, `bus_registrations.withdrawn_fleet_status ENUM('assigned','waiting') NULL`.
- Produces (tabela): `bus_registration_edits (id BIGINT AUTO_INCREMENT PK, registration_id CHAR(36) NOT NULL, edited_at DATETIME NOT NULL, changes LONGTEXT NOT NULL /* JSON */, KEY (registration_id, edited_at), FK → bus_registrations ON DELETE CASCADE)`. Usar `LONGTEXT` com JSON serializado (MySQL 5.7 do CI aceita `JSON`, mas `LONGTEXT` evita diferença entre 5.7/8.0 e MariaDB do host).

- [ ] **Step 1: Escrever o teste de schema** em `php/tests/registration-edit.test.php`, no padrão de `bus-boarding.test.php` (helper `edit_expect`, seção pura primeiro, depois `KOB_BOARDING_TEST_DSN` com `SKIP` se ausente, banco `kob_boarding_test` resetado). Asserções da seção MySQL:

```php
bus_registration_edit_ensure_schema($pdo);
bus_registration_edit_ensure_schema($pdo); // idempotente
$cols = $pdo->query("SHOW COLUMNS FROM bus_passengers LIKE 'withdraw%'")->fetchAll(PDO::FETCH_COLUMN);
sort($cols);
edit_expect(['withdrawal_reason', 'withdrawn_at'], $cols, 'Passenger withdrawal columns');
foreach (['withdrawn_at', 'withdrawn_bus_number', 'withdrawn_fleet_status'] as $c)
    edit_expect(1, $pdo->query("SHOW COLUMNS FROM bus_registrations LIKE '$c'")->rowCount(), "Registration $c");
edit_expect(0, (int) $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(), 'Edit log table exists');
// usuário sem CREATE/ALTER (mesmo GRANT de bus-boarding.test.php) não quebra
bus_registration_edit_ensure_schema($runtime);
```

As tabelas de base do teste devem ter as colunas reais usadas pelos Tasks 2–4: `bus_registrations(id, primary_name, primary_cpf, primary_birth_date, email, whatsapp, passenger_count, children_count, group_name, is_vip, amount_cents, status, bus_number, fleet_assignment_status, paid_at, created_at, updated_at)` e `bus_passengers(id AUTO_INCREMENT, registration_id, position, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap)`.

- [ ] **Step 2: Rodar e ver falhar** — `KOB_BOARDING_TEST_DSN='mysql:host=127.0.0.1;port=3306;dbname=kob_boarding_test;charset=utf8mb4' php php/tests/registration-edit.test.php` → FAIL `Call to undefined function bus_registration_edit_ensure_schema`. Sem MySQL local, a seção imprime `SKIP` e a verificação acontece no CI (Step 5).

- [ ] **Step 3: Implementar** o SQL versionado (`ALTER TABLE ... ADD COLUMN ... AFTER`, `CREATE TABLE IF NOT EXISTS`, comentário de cabeçalho no padrão de `009`) e `bus_registration_edit_ensure_schema` com um `try { $pdo->query('SELECT withdrawn_at FROM bus_passengers LIMIT 0'); ... return; }` de curto-circuito (como `bus_boarding_ensure_schema`, para não fazer DDL em toda requisição) e `ALTER`s individuais em `try/catch`.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → `PASS: edit schema`.

- [ ] **Step 5: CI** — adicionar `php php/tests/registration-edit.test.php` ao passo "Validar persistência e concorrência da chamada" em `.github/workflows/tests.yml`.

- [ ] **Step 6: Commit** — `git add php/db/010_registration_edit.sql php/lib/registration-edit-schema.php php/tests/registration-edit.test.php .github/workflows/tests.yml && git commit -m "Adiciona colunas de desistência e log de edição das reservas"`

---

### Task 2: Regras da edição (lib pura)

**Files:**
- Create: `php/lib/registration-edit.php`
- Test: `php/tests/registration-edit.test.php` (seção pura, antes do `SKIP`)

**Interfaces:**
- Consumes: `normalize_person_name`, `normalize_cpf`, `vip_optional_email`, `vip_optional_whatsapp` (de `vip-reservations.php`), `bus_catalogo_grupos()`, `ValidationError`.
- Produces:

```php
/**
 * @param array $current  ['registration' => row de bus_registrations, 'passengers' => list<row de bus_passengers>]
 * @param array $request  corpo JSON do painel (formato abaixo)
 * @param list<string> $groupNamesInUse  nomes de grupo usados por OUTRAS reservas
 * @return array{
 *   registration: array,          // colunas a gravar em bus_registrations (só as que mudam)
 *   passengers: list<array>,      // por id: full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap, withdrawn_at, withdrawal_reason
 *   changes: list<array{passenger_id:?string, field:string, before:mixed, after:mixed}>,
 *   seats_before: int, seats_after: int,
 *   notify: bool,                 // houve desistência, reativação ou troca de responsável
 *   fully_withdrawn: bool, reactivated_registration: bool
 * }
 * @throws ValidationError com mensagem final em PT-BR
 */
function bus_registration_edit_plan(array $current, array $request, array $groupNamesInUse, string $nowUtc): array
```

Formato de `$request`:

```json
{ "registration_id": "uuid", "expected_updated_at": "2026-10-16 18:00:00",
  "group_name": "Azul" | null,
  "primary_passenger_id": "12",
  "passengers": [ { "id": "12", "full_name": "...", "cpf": "...", "whatsapp": "...", "email": "...",
                    "age_group": "adult" | "minor" | "lap", "withdrawn": false, "withdrawal_reason": "" } ] }
```

Regras (cada uma vira uma asserção no Step 1):
1. `passengers` tem exatamente os mesmos ids da reserva — nem a mais, nem a menos → `Os passageiros enviados não conferem com a reserva.`
2. `expected_updated_at` ≠ `registration.updated_at` → `A reserva mudou desde que você abriu. Feche e abra de novo para ver os dados atuais.` (o endpoint traduz para 409 — ver Task 4).
3. Nome (2+ palavras, `normalize_person_name(..., 3, 255)`), CPF (`normalize_cpf`), WhatsApp e e-mail opcionais normalizados; CPF repetido dentro da reserva → `Não repita o CPF de um passageiro.`
4. Responsável = `primary_passenger_id`: ativo, `age_group = adult`, WhatsApp e e-mail não vazios. Mensagens: `O responsável precisa ser um adulto (18+) que continua na viagem.` / `Informe WhatsApp e e-mail do responsável.`
5. Se o responsável atual desistiu e `primary_passenger_id` não mudou (e ainda há ativos) → `Escolha o novo responsável da reserva.`
6. Ativos de colo ≤ ativos pagantes (adult+minor) → `Há mais crianças de colo do que adultos pagantes na viagem. Marque também a desistência da criança ou mantenha um adulto.`
7. Desistência só em reserva com `status = confirmed` (inclui VIP); em outra, `withdrawn = true` → `Só reservas confirmadas podem registrar desistência.`
8. `withdrawal_reason` ≤ 500 caracteres, `trim`, vazio → `null`; desmarcar desistência zera `withdrawn_at` e `withdrawal_reason`. Marcar mantém `withdrawn_at` existente (não muda a data a cada salvamento) ou usa `$nowUtc`.
9. Grupo: `null` permitido; senão precisa estar em `bus_catalogo_grupos()` e não em `$groupNamesInUse` (o atual da própria reserva é permitido) → `Escolha um nome de grupo disponível.`
10. Todos desistiram → `fully_withdrawn = true`; registration recebe `withdrawn_at = now`, `withdrawn_bus_number = bus_number atual`, `withdrawn_fleet_status = fleet_assignment_status atual`, `bus_number = null`; `passenger_count`/`children_count` **não mudam**; regra 4/5 não se aplica.
11. Algum ativo e `registration.withdrawn_at` não nulo → `reactivated_registration = true`; registration recebe `bus_number = withdrawn_bus_number`, `fleet_assignment_status = withdrawn_fleet_status ?? 'assigned'`, zera os três `withdrawn_*`.
12. Caso geral: `passenger_count` = ativos adult+minor, `children_count` = ativos lap; `primary_name`, `primary_cpf`, `email`, `whatsapp` = dados do responsável; `primary_birth_date = null` só quando o responsável mudou.
13. `seats_before` = assentos ativos antes (0 se a reserva já estava desistente), `seats_after` = assentos ativos depois (0 se `fully_withdrawn`).
14. `changes`: uma entrada por campo alterado (`full_name`, `cpf`, `whatsapp`, `email`, `age_group`, `withdrawn`, `withdrawal_reason`, `primary`, `group_name`); `notify = true` se há `withdrawn` mudando em qualquer sentido ou `primary` mudando.

- [ ] **Step 1: Escrever os testes puros** — `const NOW = '2026-10-16 19:00:00';` e fixture `edit_fixture()` com reserva confirmada no ônibus 3 (`updated_at = '2026-10-16 18:00:00'`), passageiros id 1 (adulto, responsável, com contato), 2 (adulto), 3 (colo). Uma asserção por regra 1–14, por exemplo:

```php
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['3' => ['withdrawn' => true]]), [], NOW);
edit_expect(2, $plan['registration']['passenger_count'], 'Lap child withdrawal keeps payers');
edit_expect(0, $plan['registration']['children_count'], 'Lap child no longer counted');
edit_expect([2, 2], [$plan['seats_before'], $plan['seats_after']], 'Lap child frees no seat');
// Os dois adultos saem e só a criança de colo fica: a regra de colo vem antes da de responsável.
edit_expect_error('Há mais crianças de colo', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true], '2' => ['withdrawn' => true]]), [], NOW));
edit_expect_error('Escolha o novo responsável', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true]]), [], NOW));
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['withdrawn' => true]], '2'), [], NOW);
edit_expect('Pessoa Dois', $plan['registration']['primary_name'], 'New primary becomes contact');
edit_expect(null, $plan['registration']['primary_birth_date'], 'Birth date cleared on primary change');
edit_expect(true, $plan['notify'], 'Withdrawal notifies');
$all = edit_request(['1' => ['withdrawn' => true], '2' => ['withdrawn' => true], '3' => ['withdrawn' => true]]);
$plan = bus_registration_edit_plan(edit_fixture(), $all, [], NOW);
edit_expect(true, $plan['fully_withdrawn'], 'All withdrawn');
edit_expect(null, $plan['registration']['bus_number'], 'Leaves the bus');
edit_expect(3, $plan['registration']['withdrawn_bus_number'], 'Remembers the bus');
edit_expect(false, array_key_exists('passenger_count', $plan['registration']), 'Counts untouched (trigger needs >= 1)');
edit_expect([2, 0], [$plan['seats_before'], $plan['seats_after']], 'Seats freed');
```

`edit_request(array $overrides, ?string $primaryId = '1')` monta o pedido a partir da fixture aplicando `$overrides[id]` em cada passageiro. `edit_expect_error(string $prefix, callable $fn)` falha se não lançar `ValidationError` cuja mensagem começa com `$prefix`. Incluir também: reativação da reserva inteira volta `bus_number = 3`; colo → adult aumenta `seats_after`; `expected_updated_at` divergente; grupo em uso por outra reserva; grupo fora do catálogo; desistência em `payment_pending`; ids a mais/a menos; `withdrawn_at` preservado em novo salvamento.

- [ ] **Step 2: Rodar e ver falhar** — `php php/tests/registration-edit.test.php` → FAIL `undefined function bus_registration_edit_plan`.

- [ ] **Step 3: Implementar `bus_registration_edit_plan`** em `php/lib/registration-edit.php` (`require_once` de `validation.php`, `vip-reservations.php`, `group-names.php`, `bus-fleet.php`). Sem PDO; `$nowUtc` injetado para o teste ser determinístico. Ordem de validação: 1 → 2 → 3 → 7 → 8 → 9 → (todos desistiram? 10 : 6, 5, 4) → 11 → 12 → 13 → 14. A regra 6 vem antes de 5/4 porque, sem adulto ativo, não há responsável possível e a mensagem útil é a da criança.

- [ ] **Step 4: Rodar e ver passar** — `php php/tests/registration-edit.test.php` → `PASS: registration edit rules` (e `SKIP: MySQL` sem DSN).

- [ ] **Step 5: Commit** — `git commit -m "Regras de edição e desistência de reserva em lib testável"`

---

### Task 3: Leituras operacionais ignoram desistentes

**Files:**
- Modify: `php/lib/bus-fleet.php:165-189` (`bus_fleet_bus_occupancy`), `:313-375` (`bus_fleet_load_balance_snapshot`), `:784-823` (`bus_assign_fleet`)
- Modify: `php/lib/bus-boarding.php:55-95` (`bus_boarding_manifest`), `:98-137` (`bus_boarding_save`)
- Modify: `php/mysql/bus-manifest.php:40-52`, `php/mysql/bus-fleet-assign.php:~100-110`, `php/mysql/bus-fleet-auto-balance.php:60-70`
- Modify: `php/mysql/lib/confirmation-mailer.php` (consulta dos passageiros que recebem e-mail próprio: `AND withdrawn_at IS NULL`, defesa para reenvio manual)
- Test: `php/tests/registration-edit.test.php` (seção MySQL)

**Interfaces:**
- Consumes: colunas do Task 1.
- Regra única, aplicada em todos os pontos: reserva entra só se `r.withdrawn_at IS NULL`; passageiro entra só se `p.withdrawn_at IS NULL`. As funções chamam `bus_registration_edit_ensure_schema($pdo)` antes da consulta **somente fora de transação** (DDL faz commit implícito — mesma regra do comentário em `bus_fleet_load_balance_snapshot`). Dentro de transação, os endpoints já chamaram o ensure antes de abrir.

- [ ] **Step 1: Testes MySQL** — inserir reserva `confirmed` no ônibus 1 com 3 passageiros (1 desistente adulto, 1 ativo adulto, 1 colo ativo) e outra reserva `confirmed` totalmente desistente com `bus_number NULL`, `withdrawn_bus_number = 1`. Asserções:

```php
edit_expect(1, bus_fleet_bus_occupancy($pdo, 1), 'Withdrawn passenger frees seat (counts already updated)');
$people = array_column(bus_boarding_manifest($pdo)['people'], 'name');
edit_expect(false, in_array('Desistente Adulto', $people, true), 'Withdrawn passenger leaves roll call');
edit_expect(0, bus_boarding_manifest($pdo)['waiting'], 'Fully withdrawn registration is not waiting');
edit_expect('manifest_changed', bus_boarding_save($pdo, [...withdrawn passenger id..., 'bus_number' => 1])['error'], 'Offline queue for withdrawn person is rejected');
bus_assign_fleet($pdo, 'withdrawn-registration');
edit_expect(null, $pdo->query("SELECT bus_number FROM bus_registrations WHERE id='withdrawn-registration'")->fetchColumn(), 'Webhook replay does not re-seat a withdrawn registration');
edit_expect(false, in_array('withdrawn-registration', array_column(bus_fleet_load_balance_snapshot($pdo)['groups'], 'id'), true), 'Balance ignores withdrawn registration');
```

(`passenger_count` da fixture já reflete ativos, como o endpoint gravaria.)

- [ ] **Step 2: Rodar e ver falhar** (CI ou MySQL local) — falha em "Withdrawn passenger leaves roll call".

- [ ] **Step 3: Implementar** — acrescentar `AND r.withdrawn_at IS NULL` / `AND p.withdrawn_at IS NULL` nas consultas listadas; em `bus_assign_fleet` selecionar `withdrawn_at` e retornar cedo se não nulo; em `bus_boarding_save` selecionar `p.withdrawn_at, r.withdrawn_at` e responder `manifest_changed` se algum não for nulo. `bus-manifest.php` e o PDF/XLSX da chamada leem `bus_boarding_manifest`/consulta própria — conferir que ambos filtram.

- [ ] **Step 4: Rodar e ver passar**; rodar também `php php/tests/bus-boarding.test.php`, `boarding-rollcall-pdf.test.php`, `boarding-rollcall-xlsx.test.php`, `bus-fleet-balance.test.php`, `bus-fleet-lock.test.php` → todos `PASS`. As fixtures de `bus-boarding.test.php` criam tabelas sem as colunas novas: chamar `bus_registration_edit_ensure_schema($pdo)` depois do `CREATE TABLE` delas.

- [ ] **Step 5: Commit** — `git commit -m "Frota, embarque e manifesto ignoram passageiros e reservas desistentes"`

---

### Task 4: Endpoint de edição + nomes de grupo livres + e-mail

**Files:**
- Create: `php/mysql/bus-registration-update.php`
- Create: `php/mysql/bus-group-names.php`
- Create: `php/lib/registration-edit-email.php`
- Modify: `php/lib/registration-edit.php` (função de gravação `bus_registration_edit_apply`)
- Modify: `.htaccess` (2 rotas, junto de `bus-vip-*`)
- Test: `php/tests/registration-edit.test.php` (seção MySQL)

**Interfaces:**
- Consumes: `bus_registration_edit_plan` (Task 2), `bus_registration_edit_ensure_schema` (Task 1), `bus_fleet_bus_occupancy`, `bus_fleet_is_bus_locked`, `bus_fleet_vip_occupancy` + `bus_fleet_load_legacy_vip_settings` (mesma conta de `bus-vip-create.php:50`), `bus_nomes_em_uso`, `bus_enviar_com_retry`, `BUS_EMAIL_ADMIN`.
- Produces:

```php
/** Tudo dentro de uma transação que o chamador abriu. Retorna ['plan' => ..., 'waiting' => int]. */
function bus_registration_edit_apply(PDO $pdo, array $request, string $nowUtc): array
/** @param array $context ['code','group','bus_number','changes','seats_freed','waiting'] */
function bus_registration_edit_email_html(array $context): string
function bus_registration_edit_email_text(array $context): string
```

- HTTP de `bus-registration-update.php`: POST com `X-Admin-Token`; 200 `{ "success": true, "registration_id": "...", "updated_at": "..." }`; 400 `{ "error": msg }` para `ValidationError`; 409 `{ "error": msg, "code": "stale" | "capacity" | "locked" | "cpf_in_use" }`; 403/405 como `bus-vip-delete.php`; 500 genérico com `log_failure('bus-registration-update', $e)`.
- HTTP de `bus-group-names.php`: GET com token → `{ "livres": ["..."], "em_uso": ["..."] }` (catálogo menos `bus_nomes_em_uso`).

`bus_registration_edit_apply` faz, nesta ordem: `SELECT ... FROM bus_registrations WHERE id = ? FOR UPDATE` e passageiros `FOR UPDATE`; `bus_nomes_em_uso` sem o próprio; `bus_registration_edit_plan`; CPF global — para cada CPF que mudou, `SELECT r.id FROM bus_passengers p JOIN bus_registrations r ... WHERE p.cpf = ? AND r.id <> ? AND p.withdrawn_at IS NULL AND r.withdrawn_at IS NULL AND r.status IN ('confirmed','payment_pending','paid_awaiting_proof') LIMIT 1` → `ValidationError` com código `cpf_in_use` e mensagem `Este CPF já está na reserva #ABCD1234.`; capacidade — se `seats_after > seats_before` e o ônibus destino (atual, ou `withdrawn_bus_number` na reativação) não é nulo: travado → `locked` `O Ônibus N está bloqueado para alterações.`; `ocupação(excluindo a própria) + legado VIP + seats_after > 46` → `capacity` `O Ônibus N não tem vagas suficientes (X livres; são necessárias Y).`; `UPDATE` dos passageiros e da reserva (`updated_at = UTC_TIMESTAMP()`); `INSERT INTO bus_registration_edits`; conta `waiting` (`fleet_assignment_status='waiting' AND bus_number IS NULL AND withdrawn_at IS NULL AND status='confirmed'`). O endpoint dá commit e só então, se `plan.notify`, envia o e-mail em `try/catch` + `log_failure('registration-edit-email', ...)`.

Para os códigos 409, criar `final class RegistrationEditConflict extends ValidationError { public function __construct(string $msg, public readonly string $code) }` em `registration-edit.php` (PHP 8.0 não tem `readonly`: usar propriedade pública comum).

- [ ] **Step 1: Testes MySQL de `bus_registration_edit_apply`** (com transação aberta pelo teste):
  - desistência do adulto 2 grava `withdrawn_at`, recalcula `passenger_count`, grava 1 linha no log com `changes` contendo `{"field":"withdrawn","before":false,"after":true}`;
  - reativação com ônibus cheio (encher o ônibus 1 até 46 com outra reserva) → `RegistrationEditConflict` `capacity`, e nada mudou no banco depois do `rollBack`;
  - ônibus travado (`bus_fleet_save_locked_buses($pdo, [1])`) + aumento de assento → `locked`;
  - CPF de passageiro ativo de outra reserva → `cpf_in_use` com o código dela; CPF de passageiro **desistente** de outra reserva → permitido;
  - `expected_updated_at` antigo → `stale`;
  - reserva inteira desistente e depois reativada volta ao `withdrawn_bus_number`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `bus_registration_edit_apply`, os dois endpoints (padrão de `bus-vip-delete.php`: `bus_check_admin_token`, método, `read_json_body`, `bus_pdo`, ensure schema **antes** de `beginTransaction`), o template de e-mail (padrão `admin-email.php` com `bus_email_abertura/cabecalho/linha/fechamento`; assunto `Reserva CODE – alteração no painel`; lista desistências com motivo, reativações, troca de responsável, "N lugares liberados no Ônibus X" e "N reservas aguardando ônibus" quando `waiting > 0`) e as rotas no `.htaccess`.
- [ ] **Step 4: Rodar e ver passar**; `php -l` em cada arquivo novo.
- [ ] **Step 5: Commit** — `git commit -m "Endpoint para editar reserva, registrar desistência e avisar a organização"`

---

### Task 5: Dados do painel e Excel administrativo conhecem a desistência

**Files:**
- Modify: `php/mysql/bus-admin-data.php` (consulta de reservas `:63-75`, passageiros `:77-95`, índice de CPF `:105-121`, frota `:196-310`, resumo `:345-370`, `$lista[] = [...]` `:420-444`, `semOnibusConfirmado` `:449-485`)
- Modify: `php/mysql/bus-admin-xlsx.php:80-225`, `php/lib/xlsx.php:67-91` (+ estilos)
- Test: `php/tests/xlsx.test.php`

**Interfaces:**
- Produces (JSON de `bus-admin-data`), consumido pelo Task 6/7:
  - em cada passageiro: `id` (string), `desistiu` (bool), `desistiu_em` (`dd/mm/aaaa hh:mm` São Paulo ou `null`), `motivo_desistencia` (string|null), `whatsapp_digitos` (string|null, para preencher o modal), `email` (já existe), `cpf` (já existe, formatado);
  - em cada reserva: `updated_at` (string crua, para `expected_updated_at`), `desistente` (bool), e quando `desistente`: `status_chave = 'desistente'`, `status_rotulo = 'Desistente'`, `status_tom = 'falha'`; `pagantes`/`criancas` continuam vindo das colunas (ativos);
  - `resumo.reservas_desistentes` (int).
- Frota (`porOnibus`, `semOnibusConfirmado`, atribuição automática do passo 3): pular reservas com `withdrawn_at`; listas `passageiros` dos cards sem desistentes.
- Resumo: reserva desistente não soma em `pagantes`/`total_a_bordo`; **receita continua somando** (regra "valores não mudam").
- Índice "onde mais esse CPF aparece": ignorar passageiros desistentes.
- Excel: coluna nova `['titulo' => 'Desistência', 'largura' => 26]` depois de "Status"; valor `Desistiu em dd/mm/aaaa hh:mm` + ` · motivo` quando houver; linha com estilo `desistente` (novo índice 22 em `xlsx_estilos_indices`, fonte cinza `#94A3B8`, tachado `<strike/>`) e `desistente_centralizado` (23); filtro `desistente` aceito em `?filtro=`.

- [ ] **Step 1: Teste XLSX** — em `php/tests/xlsx.test.php`, linha com `'estilo' => 'desistente'` e célula centralizada; abrir o ZIP gerado e conferir que `xl/styles.xml` contém `<strike/>` e que a célula usa `s="22"` / `s="23"`.
- [ ] **Step 2: Rodar e ver falhar** — `php php/tests/xlsx.test.php`.
- [ ] **Step 3: Implementar** estilos em `xlsx.php` (acrescentar ao fim do `cellXfs` para não mexer nos índices existentes; mapear `centralizado` → `desistente_centralizado` no bloco de `:296`), coluna e filtro em `bus-admin-xlsx.php`, e os campos/filtros em `bus-admin-data.php`.
- [ ] **Step 4: Rodar e ver passar** — `php php/tests/xlsx.test.php`; `php -l php/mysql/bus-admin-data.php php/mysql/bus-admin-xlsx.php`; `npm run test:server` (150 pass).
- [ ] **Step 5: Commit** — `git commit -m "Painel e Excel mostram desistências sem contar na frota"`

---

### Task 6: Lista de reservas e cards da frota (ícone de editar, marca de desistente, filtro)

**Files:**
- Modify: `assets/js/painel-onibus.js` — `linhasVisiveis` (`:428`), `renderizar` (`:464-670`), card da frota (`:1046-1150`), `el` (`:29-90`)
- Modify: `assets/css/painel-onibus.css`
- Modify: `painel-onibus.html:127-133` (botão de filtro)
- Test: `analytics/tests/painel-editar-reserva.spec.js` (novo; mocks no padrão de `painel-empty-fleet.spec.js`, inclusive `beforeEach` que responde `**/api/bus-boarding` com `{ people: [], waiting: 0 }`)

**Interfaces:**
- Consumes: JSON do Task 5.
- Produces: `window.KobEditarReserva` é chamado assim (Task 7 implementa):

```js
// em painel-onibus.js
var editor = window.KobEditarReserva ? window.KobEditarReserva(document.getElementById('painel-editar-dialog'), {
  token: function () { return estado.token; },
  reserva: function (id) { return encontrarReserva(id); },      // objeto de estado.reservas
  frota: function () { return estado.frota; },
  confirmar: mostrarConfirmacaoModal,                           // (titulo, msg, rotulo) => Promise<bool>
  aoSalvar: function () { carregar(); }
}) : null;
function abrirEdicao(reservaId) { if (editor) editor.abrir(reservaId); }
```

- Botão de editar: `<button type="button" class="tabela__editar" aria-label="Editar reserva #CODE" title="Editar reserva">` com SVG de lápis, dentro de `.tabela__bloco-reserva` na primeira linha; no card da frota `class="grupo-item__editar"` em `.grupo-item__top` antes do `codeTag`, com `mousedown` → `stopPropagation()`, omitido quando `String(r.id).startsWith('vip_')`.
- Linha de passageiro desistente: `tr.classList.add('tabela__linha--desistente')`; abaixo do nome, `<span class="etiqueta etiqueta--falha">Desistiu</span>` + ` dd/mm/aaaa hh:mm`; a contagem `N pessoas` usa só ativos (`pagantes + criancas` já vêm ativos).
- Filtro: `<button class="filtro__opcao" data-filtro="desistente">Desistentes</button>` depois de "Cancelados / Falhas"; `linhasVisiveis` já compara `status_chave`.

- [ ] **Step 1: Testes Playwright** (`@smoke`):

```js
test('lista mostra lápis por reserva, marca desistente e filtra Desistentes @smoke', async ({ page }) => {
  // fixture: reserva A confirmada (2 pax, Bruno desistiu em 16/10/2026 15:00), reserva B desistente inteira
  await page.goto('/painel-onibus.html');
  await page.getByRole('tab', { name: 'Reservas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Editar reserva/ })).toHaveCount(2);
  const bruno = page.locator('tr', { hasText: 'Bruno' });
  await expect(bruno).toHaveClass(/tabela__linha--desistente/);
  await expect(bruno).toContainText('Desistiu');
  await page.getByRole('button', { name: 'Desistentes', exact: true }).click();
  await expect(page.locator('#tabela-corpo tr')).toHaveCount(1); // só a reserva B (1 passageiro)
});
test('card da frota tem lápis que não inicia arraste e VIP legado não tem @smoke', async ({ page }) => {
  // card real + card id 'vip_1'
  await page.getByRole('tab', { name: 'Planejamento de Frota' }).click();
  const card = page.locator('.grupo-item').filter({ hasText: 'AAAA0001' });
  await expect(card.getByRole('button', { name: 'Editar reserva #AAAA0001' })).toBeVisible();
  await expect(page.locator('.grupo-item').filter({ hasText: 'VIP 1' }).locator('.grupo-item__editar')).toHaveCount(0);
  await card.locator('.grupo-item__editar').click();
  await expect(card).not.toHaveClass(/dragging/);
  await expect(page.locator('#painel-editar-dialog')).toBeVisible(); // depende do Task 7; até lá, marcar como test.fixme
});
```

- [ ] **Step 2: Rodar e ver falhar** (porta privada, Terminal do app): `npx playwright test --config=<config 4179> painel-editar-reserva`.
- [ ] **Step 3: Implementar** botões, marca, filtro e CSS (`.tabela__linha--desistente .tabela__nome { text-decoration: line-through; opacity: .6 }`, lápis 32×32 com alvo de toque ≥ 44 px no mobile, mesmas cores de `.grupo-item__code`).
- [ ] **Step 4: Rodar e ver passar**; rodar `painel-empty-fleet` e `painel-embarque` para garantir que a tabela/frota não quebraram.
- [ ] **Step 5: Commit** — `git commit -m "Ícone de editar na lista e na frota e marca de desistência"`

---

### Task 7: Modal de edição

**Files:**
- Create: `assets/js/painel-editar-reserva.js`
- Modify: `painel-onibus.html` (dialog depois de `#painel-vip-dialog`; `<script defer>` antes de `painel-onibus.js`; `?v=` de CSS/JS alterados), `embarque-sw.js` (mesmas versões)
- Modify: `assets/css/painel-onibus.css`
- Test: `analytics/tests/painel-editar-reserva.spec.js`

**Interfaces:**
- Consumes: opções do Task 6; `GET api/bus-group-names`, `POST api/bus-registration-update` (Task 4); campos do Task 5.
- Produces: `window.KobEditarReserva(dialog, options) → { abrir(reservaId): void }`.

Markup fixo do dialog (o JS só preenche `#editar-grupo-campo`, `#editar-passageiros`, `#editar-responsavel`):

```html
<dialog id="painel-editar-dialog" class="bus-dialog bus-dialog--vip bus-dialog--editar" aria-labelledby="painel-editar-titulo">
  <form id="form-editar" method="dialog" novalidate>
    <div class="bus-dialog__header">
      <div class="bus-dialog__badge-icone bus-dialog__badge-icone--editar" aria-hidden="true"><svg><!-- lápis --></svg></div>
      <div><h2 id="painel-editar-titulo">Editar reserva</h2><p id="painel-editar-subtitulo" class="bus-dialog__subtitle"></p></div>
    </div>
    <div id="editar-grupo-campo"></div>
    <ul id="editar-passageiros" class="editar-passageiros"></ul>
    <fieldset id="editar-responsavel" hidden><legend>Novo responsável</legend></fieldset>
    <p id="editar-aviso" class="editar-aviso" role="status" hidden></p>
    <p id="editar-erro" class="vip-form__erro" role="alert" hidden></p>
    <div class="bus-dialog__actions bus-dialog__actions--vip">
      <button id="editar-cancelar" class="botao botao--discreto" type="button">Cancelar</button>
      <button id="editar-salvar" class="botao botao--primario" type="submit">Salvar alterações</button>
    </div>
  </form>
</dialog>
```

Comportamento:
- Título `Editar reserva #CODE`; subtítulo `Grupo · Status` (ou só status).
- Cada passageiro: `<li>` com `<button type="button" class="editar-passageiro__resumo" aria-expanded="false" aria-controls="editar-p-ID">` mostrando nome, faixa, CPF, meeple de responsável, etiqueta "Desistiu"; painel `id="editar-p-ID"` com campos Nome *, CPF *, WhatsApp, E-mail (mesmas máscaras/normalizadores de `painel-onibus.js`: expor `formatarCpf`, `formatarWhatsapp`, `normalizarWhatsapp`, `normalizarEmail`, `emailValido`, `normalizarNomeCompleto` via `options.formatos` em vez de duplicar), select Faixa etária (`18 anos ou mais` = adult, `6 a 17 anos` = minor, `0 a 5 anos (colo)` = lap), switch `<button role="switch" aria-checked>Desistiu</button>` (só se `reserva.status === 'confirmed'`), e `Motivo (opcional)` (`maxlength=500`) visível quando ligado. Um painel aberto por vez.
- Grupo: `<select>` com "Sem nome de grupo" + atual + `livres` do `GET api/bus-group-names` (carregado ao abrir; erro → mantém só o atual e mostra aviso).
- "Novo responsável": aparece quando o responsável atual está com Desistiu ligado e ainda há ativos; rádios só de ativos com faixa adult; escolher um sem WhatsApp/e-mail abre o painel dele e marca os campos `required`.
- Aviso colo→pagante: ao mudar um select de `lap` para outra faixa, `#editar-aviso` = `NOME passa a ocupar um assento sem pagamento correspondente.`
- Validação no cliente, em ordem, com foco no campo e mensagens iguais às do Task 2: nome/CPF vazios, WhatsApp/e-mail inválidos, colo > pagantes, responsável faltando ou sem contato.
- Fechar (Cancelar, Esc, clique fora) com alterações → `options.confirmar('Descartar alterações?', 'As alterações desta reserva ainda não foram salvas. Deseja descartar e fechar?', 'Descartar e fechar')`.
- Salvar: botão `aria-busy`, texto `Salvando…`; POST com `X-Admin-Token`, corpo do Task 2 (`expected_updated_at = reserva.updated_at`); 200 → fecha e `options.aoSalvar()`; 4xx → mensagem do servidor em `#editar-erro`, botão volta.

- [ ] **Step 1: Testes Playwright** (`@smoke` nos três primeiros):
  - `abre, expande um passageiro por vez e edita dados`: clicar lápis → título `Editar reserva #AAAA0001`; `aria-expanded` alterna; trocar nome/CPF/WhatsApp → POST recebido com `passengers[i].full_name` novo, `cpf` com dígitos, `expected_updated_at` da fixture; dialog fecha e `bus-admin-data` é pedido de novo.
  - `desistência do responsável exige novo responsável adulto`: ligar Desistiu em Ana → aparece "Novo responsável" com só os adultos ativos (criança e menor fora); salvar sem escolher → `Escolha o novo responsável da reserva.` e nenhum POST; escolher Bruno sem e-mail → painel dele abre e salvar sem e-mail → `Informe WhatsApp e e-mail do responsável.`; preencher → POST com `primary_passenger_id` do Bruno e `withdrawn: true`, `withdrawal_reason` digitado.
  - `colo sem adulto bloqueia e colo→pagante avisa`: reserva 1 adulto + 1 colo; ligar Desistiu só no adulto → mensagem de colo; mudar faixa do colo para 6 a 17 → `#editar-aviso` contém `passa a ocupar um assento sem pagamento correspondente`.
  - `erro do servidor mantém o modal`: POST 409 `{ error: 'O Ônibus 1 não tem vagas suficientes (0 livres; são necessárias 1).', code: 'capacity' }` → mensagem visível, modal aberto, botão habilitado.
  - `fechar com alterações pede confirmação`: Esc depois de editar → aparece `#painel-alerta-dialog` com "Descartar alterações?"; cancelar mantém o modal.
  - `reserva pendente não oferece desistência`: `status: 'payment_pending'` → nenhum `role=switch`.
  - Teclado: Tab chega ao primeiro resumo; Enter expande; foco volta ao lápis ao fechar.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** módulo, markup, CSS (reaproveitar `.bus-dialog--vip`, `.vip-formulario__grid`, `.vip-formulario__campo`; novos: `.editar-passageiro__resumo`, `.editar-passageiro--desistente`, switch, `.bus-dialog__badge-icone--editar`), e a ligação no `painel-onibus.js` (Task 6) — remover o `test.fixme` do Task 6.
- [ ] **Step 4: Rodar e ver passar** — `painel-editar-reserva`, `painel-empty-fleet`, `painel-embarque`, `check-busao-app` no Chromium; `npm run test:server` (o teste do shell offline confere as versões do `embarque-sw.js`).
- [ ] **Step 5: Verificação visual** — subir `kob-site` (`preview_start`), abrir o modal com dados mockados em 390 px e 1280 px, screenshot do estado recolhido, expandido e com "Novo responsável".
- [ ] **Step 6: Commit** — `git commit -m "Modal para editar reserva e marcar desistência por passageiro"`

---

### Task 8: Fechamento

**Files:**
- Modify: `README.md` (seção do painel: edição/desistência em 3–5 linhas)
- Modify: `docs/superpowers/specs/2026-10-16-painel-editar-reserva-desistencia-design.md` (marcar as escolhas deixadas ao builder: acordeão de um item aberto; resposta do endpoint = `carregar()`; `primary_birth_date` zerada)

- [ ] **Step 1:** rodar `npm run test:server`, todos os `php php/tests/*.test.php` (com DSN do MySQL local se houver), Playwright Chromium do painel inteiro e `check-busao-app`/`painel-embarque-offline` com os perfis Pixel 7 e iPhone 15 — todos verdes.
- [ ] **Step 2:** commit da documentação; push; PR com o template do repositório (Summary com o diff de fluxo, Evidence com screenshots e contagens de teste, Merge Danger: **one-way** por causa das colunas novas — a migração é aditiva e o rollback do código continua funcionando com as colunas presentes).
