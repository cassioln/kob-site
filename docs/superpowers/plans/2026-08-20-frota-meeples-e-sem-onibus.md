# Frota Meeples e Sem Ônibus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compactar meeples em grupos com 4 ou mais integrantes e permitir devolver reservas comuns para “Sem ônibus confirmado”.

**Architecture:** O frontend decide entre meeples individuais e a representação textual compacta, mantendo tooltip e dados existentes. O endpoint manual trata `bus_number: null` como estado `waiting`, enquanto destinos numéricos continuam usando a validação de capacidade existente.

**Tech Stack:** JavaScript vanilla, CSS existente do painel, PHP/PDO, Node test runner.

## Global Constraints

- Crianças de colo aparecem na representação, mas não consomem assentos.
- VIPs não podem ser enviados para “Sem ônibus confirmado”.
- A movimentação deve preservar grupos inteiros e a lógica atual de capacidade.
- A representação compacta começa em 7 integrantes no desktop e em 4 integrantes no mobile, usando contagens acompanhadas pelos ícones de meeple adulto e criança.

---

### Task 1: Compactar a representação dos meeples

**Files:**
- Modify: `assets/js/painel-onibus.js:702-741`
- Modify: `assets/css/painel-onibus.css:1688-1750`
- Test: `node --check assets/js/painel-onibus.js`

**Interfaces:**
- Consumes: `r.pagantes`, `r.criancas`, `r.is_vip`.
- Produces: meeples individuais para grupos de 1–3 integrantes e spans compactos `M`/`m` para grupos com 4+ integrantes.

- [ ] **Step 1: Ajustar a renderização responsiva do bloco de meeples**

  Calcular `totalIntegrantes = numPagantes + numColo`. Renderizar as duas variantes no DOM: meeples individuais e uma linha compacta com a contagem seguida do SVG correspondente. Aplicar classe de compactação permanente para `totalIntegrantes >= 7` e classe de compactação móvel para `totalIntegrantes >= 4`; o CSS decide a variante conforme a largura:

  ```html
  <span class="grupo-item__meeples-compacto">
    <span class="grupo-item__meeples-contagem">3</span>
    <svg class="meeple-svg meeple-svg--adult" ...></svg>
    <span class="grupo-item__meeples-sep">+</span>
    <span class="grupo-item__meeples-contagem">1</span>
    <svg class="meeple-svg meeple-svg--child" ...></svg>
  </span>
  ```

  Manter `meeplesContainer.title = textoDesc` em ambos os formatos.

- [ ] **Step 2: Ampliar meeples individuais e proteger a linha compacta**

  Atualizar os SVGs individuais para adultos com 20px, crianças com 14px e VIP com 20px. Adicionar CSS para `.grupo-item__meeples-compacto` com `display:inline-flex`, `white-space:nowrap`, `flex-shrink:0` e contagens com peso forte. Manter `max-width` e overflow do container para não alterar a largura do seletor.

- [ ] **Step 3: Verificar sintaxe**

  Run: `node --check assets/js/painel-onibus.js`

  Expected: exit code 0.

### Task 2: Adicionar menu visual de destinos e “Sem ônibus confirmado”

**Files:**
- Modify: `assets/js/painel-onibus.js:745-815`
- Modify: `php/mysql/bus-fleet-assign.php:42-162`
- Test: `php -l php/mysql/bus-fleet-assign.php`

**Interfaces:**
- Consumes: `moverMenu`, `moverParaOnibus(reservaId, destinoBusNum)` and the existing JSON API.
- Produces: `bus_number: null` for a common reservation and `fleet_assignment_status: waiting` in the database.

- [ ] **Step 1: Replace the native select with an accessible details menu**

  Render a `<details class="grupo-item__mover">` with a `<summary>` trigger and a `role="listbox"` options container. Each destination is a button with an inline bus or waiting icon, destination title, and available-vacancy detail. Keep only one card menu open at a time.

- [ ] **Step 2: Add the waiting destination only for non-VIP cards**

  Append the waiting button after the bus buttons only when `!r.is_vip`:

  ```js
  adicionarOpcaoMover(null, 'Sem ônibus confirmado', 'Enviar para a fila de espera', 'espera');
  ```

- [ ] **Step 3: Route the waiting button to the null destination**

  In the option click handler, before numeric capacity validation:

  ```js
  if (valor === null) {
      moverParaOnibus(r.id, null);
      return;
  }
  ```

- [ ] **Step 4: Reject null for VIPs in the endpoint**

  In the VIP branch, before capacity validation, throw `ValidationError('Reservas VIP não podem ficar sem ônibus confirmado.')` when `$bus_number === null`.

- [ ] **Step 5: Persist waiting state for common reservations**

  Replace the fixed update with a branch:

  ```php
  if ($bus_number === null) {
      $stmtUpdate = $pdo->prepare("UPDATE bus_registrations
          SET bus_number = NULL, fleet_assignment_status = 'waiting', updated_at = UTC_TIMESTAMP()
        WHERE id = ?");
      $stmtUpdate->execute([$registrationId]);
  } else {
      $stmtUpdate = $pdo->prepare("UPDATE bus_registrations
          SET bus_number = ?, fleet_assignment_status = 'assigned', updated_at = UTC_TIMESTAMP()
        WHERE id = ?");
      $stmtUpdate->execute([$bus_number, $registrationId]);
  }
  ```

- [ ] **Step 6: Verify backend syntax**

  Run: `php -l php/mysql/bus-fleet-assign.php && php -l php/mysql/bus-admin-data.php`

  Expected: no syntax errors.

### Task 3: Run the regression suite

**Files:**
- Test: `npm run test:server`
- Test: `git diff --check`

- [ ] **Step 1: Run JavaScript and PHP checks**

  Run: `node --check assets/js/painel-onibus.js && php -l php/mysql/bus-fleet-assign.php && php -l php/mysql/bus-admin-data.php`

  Expected: all commands exit with code 0.

- [ ] **Step 2: Run server tests**

  Run: `npm run test:server`

  Expected: all existing tests pass.

- [ ] **Step 3: Check whitespace and final diff**

  Run: `git diff --check && git diff --stat`

  Expected: no whitespace errors and only the frontend/backend files listed in this plan are changed.
