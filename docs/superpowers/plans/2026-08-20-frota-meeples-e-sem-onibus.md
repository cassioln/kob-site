# Frota Meeples e Sem Ônibus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compactar meeples em grupos com 4 ou mais integrantes e permitir devolver reservas comuns para “Sem ônibus confirmado”.

**Architecture:** O frontend decide entre meeples individuais e a representação textual compacta, mantendo tooltip e dados existentes. O endpoint manual trata `bus_number: null` como estado `waiting`, enquanto destinos numéricos continuam usando a validação de capacidade existente.

**Tech Stack:** JavaScript vanilla, CSS existente do painel, PHP/PDO, Node test runner.

## Global Constraints

- Crianças de colo aparecem na representação, mas não consomem assentos.
- VIPs não podem ser enviados para “Sem ônibus confirmado”.
- A movimentação deve preservar grupos inteiros e a lógica atual de capacidade.
- A representação compacta começa em 4 integrantes e usa `M` para pagantes e `m` para crianças de colo.

---

### Task 1: Compactar a representação dos meeples

**Files:**
- Modify: `assets/js/painel-onibus.js:702-741`
- Modify: `assets/css/painel-onibus.css:1688-1750`
- Test: `node --check assets/js/painel-onibus.js`

**Interfaces:**
- Consumes: `r.pagantes`, `r.criancas`, `r.is_vip`.
- Produces: meeples individuais para grupos de 1–3 integrantes e spans compactos `M`/`m` para grupos com 4+ integrantes.

- [ ] **Step 1: Ajustar a renderização do bloco de meeples**

  Calcular `totalIntegrantes = numPagantes + numColo`. Para `totalIntegrantes >= 4`, renderizar uma linha sem SVG repetido:

  ```html
  <span class="grupo-item__meeples-compacto">
    <span class="grupo-item__meeples-contagem grupo-item__meeples-contagem--adultos">3 M</span>
    <span class="grupo-item__meeples-sep">+</span>
    <span class="grupo-item__meeples-contagem grupo-item__meeples-contagem--criancas">1 m</span>
  </span>
  ```

  Manter `meeplesContainer.title = textoDesc` em ambos os formatos.

- [ ] **Step 2: Ampliar meeples individuais e proteger a linha compacta**

  Atualizar os SVGs individuais para adultos com 20px, crianças com 14px e VIP com 20px. Adicionar CSS para `.grupo-item__meeples-compacto` com `display:inline-flex`, `white-space:nowrap`, `flex-shrink:0` e contagens com peso forte. Manter `max-width` e overflow do container para não alterar a largura do seletor.

- [ ] **Step 3: Verificar sintaxe**

  Run: `node --check assets/js/painel-onibus.js`

  Expected: exit code 0.

### Task 2: Adicionar destino “Sem ônibus confirmado”

**Files:**
- Modify: `assets/js/painel-onibus.js:745-781`
- Modify: `php/mysql/bus-fleet-assign.php:42-162`
- Test: `php -l php/mysql/bus-fleet-assign.php`

**Interfaces:**
- Consumes: `selectMover`, `moverParaOnibus(reservaId, destinoBusNum)` and the existing JSON API.
- Produces: `bus_number: null` for a common reservation and `fleet_assignment_status: waiting` in the database.

- [ ] **Step 1: Add the frontend option only for non-VIP cards**

  Append an option after the bus options:

  ```js
  if (!r.is_vip) {
    var optSemOnibus = document.createElement('option');
    optSemOnibus.value = '__sem_onibus__';
    optSemOnibus.textContent = 'Sem ônibus confirmado';
    selectMover.appendChild(optSemOnibus);
  }
  ```

- [ ] **Step 2: Route the option to the null destination**

  Before numeric capacity validation:

  ```js
  if (this.value === '__sem_onibus__') {
    this.disabled = true;
    moverParaOnibus(r.id, null);
    return;
  }
  ```

- [ ] **Step 3: Reject null for VIPs in the endpoint**

  In the VIP branch, before capacity validation, throw `ValidationError('Reservas VIP não podem ficar sem ônibus confirmado.')` when `$bus_number === null`.

- [ ] **Step 4: Persist waiting state for common reservations**

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

- [ ] **Step 5: Verify backend syntax**

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

