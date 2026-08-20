
# Automatic Fleet Distribution Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a server-validated preview/apply workflow that redistributes whole non-VIP reservation groups to maximize closed buses, preserves older approved payments when capacity is insufficient, and exposes groups without a confirmed bus.

**Architecture:** Add an explicit fleet_assignment_status state to the existing MySQL reservation model, keep the optimizer as a pure function in php/lib/bus-fleet.php, and expose one authenticated endpoint with preview and apply modes. The browser only renders the returned plan and sends the plan signature back; the server recomputes and applies the plan inside an InnoDB transaction after checking that the snapshot is unchanged.

**Tech Stack:** PHP 8, MySQL/InnoDB, vanilla JavaScript, existing HTML/CSS panel, standalone PHP CLI tests, Node syntax/static checks, existing Node server tests, browser visual inspection.

## Global Constraints

- VIPs are immutable for automation and remain assigned to their manually defined bus.
- Reservations are indivisible groups; passenger_count + children_count is moved as one unit.
- No bus may exceed 46 people; a bus closes at 40 people.
- Optimization order is: maximize closed buses, preserve earliest paid_at groups, minimize group moves, then minimize bus-number displacement.
- A proposed bus below 40 cannot retain common groups; those groups become waiting even if physical seats remain. VIPs remain fixed as an exception.
- waiting means confirmed, bus_number = NULL, and fleet_assignment_status = 'waiting'; it must not be auto-assigned on read.
- Manual assignment clears waiting and sets fleet_assignment_status = 'assigned'.
- Preview never writes; apply requires explicit confirmation and is atomic.
- APIs, payment statuses, amounts, timestamps, passenger data, and VIP assignments are not changed by the optimizer.
- No new runtime dependency, framework, icon library, or image asset is allowed.

## File Map

- Create php/db/004_add_fleet_assignment_status.sql: add the persistent allocation state and index.
- Modify php/lib/bus-fleet.php: add snapshot, signature, optimizer, and transaction helper functions while preserving confirmation auto-assignment.
- Create php/mysql/bus-fleet-auto-balance.php: authenticated preview/apply endpoint.
- Modify php/mysql/bus-admin-data.php: respect waiting and return the waiting list in frota.sem_onibus_confirmado.
- Modify php/mysql/bus-fleet-assign.php: clear waiting on manual placement of a real reservation.
- Modify painel-onibus.html: add the optimizer action, preview region, and waiting-list mount point.
- Modify assets/js/painel-onibus.js: request/render preview, apply a fresh plan, and render manual waiting-list placement without changing existing drag/drop behavior.
- Modify assets/css/painel-onibus.css: style the action, preview, result states, and waiting list responsively.
- Create php/tests/bus-fleet-balance.test.php: pure optimizer and signature regression tests.

---

### Task 1: Add the explicit waiting state and expose it in the read model

**Files:**
- Create: php/db/004_add_fleet_assignment_status.sql
- Modify: php/mysql/bus-admin-data.php around the main reservation query and Frota aggregation
- Test: php -l php/mysql/bus-admin-data.php

**Interfaces:**
- Produces database column bus_registrations.fleet_assignment_status ENUM('assigned','waiting') NOT NULL DEFAULT 'assigned'.
- Produces API field frota.sem_onibus_confirmado, an array of waiting group summaries.
- Adds fleet_assignment_status to each existing reservations entry.

- [ ] Step 1: Add the migration.

    ALTER TABLE bus_registrations
      ADD COLUMN fleet_assignment_status ENUM('assigned', 'waiting') NOT NULL DEFAULT 'assigned'
        COMMENT 'Estado operacional da alocacao na frota'
      AFTER bus_number;

    CREATE INDEX bus_registrations_fleet_assignment_status_idx
      ON bus_registrations (fleet_assignment_status, bus_number);

- [ ] Step 2: Include the state in the admin query.

Add r.fleet_assignment_status immediately after r.bus_number. Normalize missing/unknown values to assigned:

    $fleetAssignmentStatus = ($r['fleet_assignment_status'] ?? 'assigned') === 'waiting'
        ? 'waiting'
        : 'assigned';

Return the normalized field in each reservation payload.

- [ ] Step 3: Stop read-time auto-allocation for waiting reservations.

Only add paid reservations to the existing $reservasSemFixoIndices list when bus_number is NULL and the normalized fleet status is not waiting. Do not add waiting reservations to $porOnibus or any occupancy total.

- [ ] Step 4: Build the waiting response.

Collect confirmed reservations with fleet_assignment_status = waiting and bus_number = NULL. Sort by paid_at ASC, then created_at ASC, then id ASC. Return each item with id, code, contato, grupo, pagantes, criancas, total, and pago_em under frota.sem_onibus_confirmado.

- [ ] Step 5: Run and commit.

    php -l php/mysql/bus-admin-data.php
    git diff --check
    git add php/db/004_add_fleet_assignment_status.sql php/mysql/bus-admin-data.php
    git commit -m "feat: persist fleet waiting assignments"

Expected: syntax and diff checks exit 0.

### Task 2: Implement and test the pure fleet optimizer

**Files:**
- Modify: php/lib/bus-fleet.php
- Create: php/tests/bus-fleet-balance.test.php
- Test: php php/tests/bus-fleet-balance.test.php

**Interfaces:**
- bus_fleet_balance_signature(array $snapshot): string returns a SHA-256 snapshot signature.
- bus_fleet_build_balance_plan(array $snapshot, int $capacity = 46, int $minimum = 40): array returns moves, waiting, buses, current, proposed, and signature.
- The optimizer receives normalized groups with id, size, bus_number, fleet_assignment_status, paid_at, and is_vip. VIP rows are never movable and are represented in snapshot.vip_occupancy.

- [ ] Step 1: Write failing pure-function tests.

The standalone test must cover:
- 46 and 34 occupancy where whole groups of 2 and 4 move and both buses close;
- VIP occupancy that remains fixed while a non-VIP group moves;
- indivisible groups, with no partial movement;
- older paid_at groups winning a waiting-seat tie when only one bus can close;
- stable signatures for equal snapshots;
- capacity above 46 being rejected.

Use this fixture shape:

    [
        'buses' => [
            ['number' => 1],
            ['number' => 2],
        ],
        'groups' => [
            [
                'id' => 'group-a',
                'size' => 6,
                'bus_number' => 1,
                'fleet_assignment_status' => 'assigned',
                'paid_at' => '2026-08-01 09:00:00',
                'is_vip' => false,
            ],
        ],
        'vip_occupancy' => [1 => 2],
    ]

The test should exit 1 with a readable failure before implementation and print PASS: fleet balance pure-function tests after implementation.

The payment-priority case must use two buses and three whole groups: old size 35 and mid size 5 on bus 1, new size 10 on bus 2. The expected plan keeps old and mid together at 40 on bus 1 and puts new in waiting; the alternative of keeping old and new is rejected because mid was approved earlier than new.

- [ ] Step 2: Add stable signature helpers.

Add bus_fleet_balance_signature() using normalized group ordering, sorted VIP occupancy, JSON_UNESCAPED_UNICODE, JSON_UNESCAPED_SLASHES, JSON_THROW_ON_ERROR, and hash('sha256', ...). Add bus_fleet_group_priority() returning paid_at then id.

- [ ] Step 3: Implement bus_fleet_build_balance_plan().

Implement these phases:
1. Normalize bus numbers, group sizes, statuses, and VIP occupancy.
2. Build fixed occupancy for every bus from VIPs.
3. Sort movable groups by paid_at ASC, then id ASC.
4. Explore assignments to existing buses or waiting using branch-and-bound. Reject a branch above capacity. A bus may retain common groups only when its final occupancy reaches minimum. Prune when its optimistic closed-bus upper bound cannot beat the current best or when it cannot preserve the current payment-priority prefix.
5. Score complete candidates lexicographically: closed-bus count descending, payment-priority vector descending, moved-group count ascending, total absolute bus-number displacement ascending.
6. Return moves, waiting IDs, before/after metrics, and the signature. A bus below minimum has no common-group assignments in the proposed result; its common groups are included in waiting.

The exact return shape is:

    [
        'signature' => 'sha256...',
        'moves' => [
            [
                'registration_id' => 'uuid',
                'from_bus' => 1,
                'to_bus' => 2,
                'size' => 6,
            ],
        ],
        'waiting' => ['uuid'],
        'buses' => [
            1 => [
                'before' => 46,
                'after' => 40,
                'vip_occupancy' => 0,
                'closed' => true,
            ],
        ],
        'current' => ['closed' => 1, 'waiting' => 0],
        'proposed' => ['closed' => 2, 'waiting' => 0],
    ]

- [ ] Step 4: Run and commit.

    php php/tests/bus-fleet-balance.test.php
    php -l php/lib/bus-fleet.php
    git add php/lib/bus-fleet.php php/tests/bus-fleet-balance.test.php
    git commit -m "feat: add deterministic fleet balance optimizer"

Expected: pure tests print PASS and all syntax checks exit 0.

### Task 3: Add the authenticated preview/apply endpoint

**Files:**
- Create: php/mysql/bus-fleet-auto-balance.php
- Modify: php/lib/bus-fleet.php
- Test: php -l php/mysql/bus-fleet-auto-balance.php

**Interfaces:**
- POST api/bus-fleet-auto-balance?token=... with {"mode":"preview"} returns a plan without writing.
- The same endpoint with {"mode":"apply","signature":"sha256..."} recomputes and applies only if the signature matches.
- HTTP 409 means stale preview, 400 invalid input, 403 invalid token, and 500 transaction failure.

- [ ] Step 1: Add bus_fleet_load_balance_snapshot(PDO $pdo).

Select confirmed id, bus_number, fleet_assignment_status, passenger_count, children_count, paid_at, and created_at ordered by paid_at, created_at, id. Load vip_seats and vip_assignments from bus_settings. Build existing bus numbers from assignments and VIPs, with bus 1 as the fallback. Return normalized groups, buses, and vip_occupancy.

- [ ] Step 2: Implement preview mode.

Authenticate exactly like php/mysql/bus-fleet-assign.php, require POST, parse JSON with read_json_body(), validate mode, load the snapshot, build the plan, and return:

    json_response(200, [
        'success' => true,
        'mode' => 'preview',
        'plan' => $plan,
    ]);

Preview must not begin a transaction or execute any write statement.

- [ ] Step 3: Implement apply mode.

Start an InnoDB transaction, lock confirmed reservation rows and bus_settings, load a fresh snapshot, recompute the plan, and compare the received signature with the fresh signature. Return 409 and roll back if they differ.

Apply with prepared statements that set both fields:

    UPDATE bus_registrations
       SET bus_number = ?, fleet_assignment_status = 'assigned', updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND status = 'confirmed';

    UPDATE bus_registrations
       SET bus_number = NULL, fleet_assignment_status = 'waiting', updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND status = 'confirmed';

Require rowCount() = 1 for every expected update. Commit only after all updates succeed. On Throwable, roll back if active, call log_failure('bus-fleet-auto-balance', $e), and return a generic error.

- [ ] Step 4: Run and commit.

    php -l php/lib/bus-fleet.php
    php -l php/mysql/bus-fleet-auto-balance.php
    git diff --check
    git add php/lib/bus-fleet.php php/mysql/bus-fleet-auto-balance.php
    git commit -m "feat: add transactional fleet balance endpoint"

Expected: all syntax checks exit 0.

### Task 4: Preserve the manual assignment flow

**Files:**
- Modify: php/mysql/bus-fleet-assign.php
- Modify: php/lib/bus-fleet.php
- Test: php -l php/mysql/bus-fleet-assign.php

**Interfaces:**
- Manual placement of a real reservation always sets fleet_assignment_status = assigned.
- The existing confirmation auto-assignment continues to place new confirmed payments.
- A waiting reservation manually placed on a bus disappears from frota.sem_onibus_confirmado.

- [ ] Step 1: Update manual placement.

Change the real-reservation UPDATE to set bus_number, fleet_assignment_status = assigned, and updated_at = UTC_TIMESTAMP(). Keep the existing VIP branch unchanged so manual VIP movement remains available.

- [ ] Step 2: Guard confirmation auto-assignment.

Select fleet_assignment_status in bus_assign_fleet(). Return early for an existing waiting record. A new confirmed record with the default assigned state and bus_number NULL continues to use the existing first-fit allocation. When assigning, write both bus_number and fleet_assignment_status = assigned.

- [ ] Step 3: Run and commit.

    php -l php/mysql/bus-fleet-assign.php
    php -l php/lib/bus-fleet.php
    git add php/mysql/bus-fleet-assign.php php/lib/bus-fleet.php
    git commit -m "fix: clear fleet waiting state on manual assignment"

Expected: both syntax checks exit 0.

### Task 5: Add the panel action, preview, and waiting-list UI

**Files:**
- Modify: painel-onibus.html in the Frota header and content
- Modify: assets/js/painel-onibus.js in element references, Frota rendering, and event registration
- Test: node --check assets/js/painel-onibus.js

**Interfaces:**
- DOM IDs: otimizar-distribuicao, frota-otimizacao, frota-otimizacao-resumo, frota-otimizacao-movimentos, frota-otimizacao-espera, frota-otimizacao-cancelar, frota-otimizacao-aplicar, frota-sem-onibus.
- JS state: estado.frotaBalancePreview stores only the server plan and signature.
- solicitarBalance() and aplicarBalance() are the only browser functions calling the new endpoint.

- [ ] Step 1: Add static mounts.

Add a Frota header action:

    <div class="frota-header__acoes">
      <button id="otimizar-distribuicao" class="botao botao--primario" type="button">
        Otimizar distribuição
      </button>
      <p class="frota-header__acao-ajuda">Reorganiza grupos inteiros para fechar mais ônibus.</p>
    </div>

Add a hidden preview section with heading, summary, moves mount, waiting mount, VIP notice, Cancelar, and Aplicar distribuição buttons. Add a hidden frota-sem-onibus section with a heading, explanatory copy, and list mount. Keep all existing IDs and the current drag/drop container unchanged.

- [ ] Step 2: Add element references and state.

Extend the existing el object with all IDs above and add estado.frotaBalancePreview = null. Do not replace estado.frota; renderizarFrota() continues using the existing server response.

- [ ] Step 3: Implement preview/apply requests.

solicitarBalance() sends POST JSON {mode:'preview'}, sets the button to Calculando… with aria-busy, stores the returned plan, and calls renderizarBalancePreview(). aplicarBalance() sends only {mode:'apply', signature: estado.frotaBalancePreview.signature}, handles 409 by asking for a new preview, hides the preview after success, clears the state, and calls carregar().

- [ ] Step 4: Render safely.

renderizarBalancePreview() must use replaceChildren(), createElement(), and textContent for all API-provided values. It shows current/proposed closed counts, every move with source/destination/size, every waiting group in paid_at order, and disables Apply when no changes exist.

- [ ] Step 5: Render the waiting list.

renderizarSemOnibusConfirmado() renders code, group/contact, total, paid date, and a select containing current bus numbers. On change, call the existing moverParaOnibus(item.id, Number(value)), clear the select, and allow carregar() to refresh. Hide the section when the server returns an empty list.

- [ ] Step 6: Wire events and run syntax.

Register click handlers for optimize, cancel, and apply. Run:

    node --check assets/js/painel-onibus.js

Expected: exit 0.

- [ ] Step 7: Commit.

    git add painel-onibus.html assets/js/painel-onibus.js
    git commit -m "feat: add fleet distribution preview to panel"

### Task 6: Style the optimizer and waiting states

**Files:**
- Modify: assets/css/painel-onibus.css near the Frota header and responsive sections
- Test: browser screenshots and Impeccable detector

**Interfaces:**
- Use existing panel tokens: --p-fundo, --p-superficie, --p-linha, --p-acao, --p-ok, --p-espera, --p-falha, --p-raio, and --p-sombra.
- Use one component vocabulary; do not add gradients, decorative shadows, or a separate card system.

- [ ] Step 1: Style the action area.

The action area is a compact vertical group with a normal button, help copy, visible focus, and disabled/loading state.

- [ ] Step 2: Style the preview.

Use one bordered surface with a clear heading, summary row, compact move rows, explicit VIP notice, and action row. Use semantic colors only for status and conflict, not decoration.

- [ ] Step 3: Style the waiting list.

Use a separate neutral operational surface with a warm attention tone, not an error treatment. Each row must keep its select usable at mobile widths.

- [ ] Step 4: Add responsive and reduced-motion rules.

At the existing Frota breakpoints, stack the action, preview actions, move rows, and waiting selectors. Set min-width: 0, break long identifiers safely, and ensure no horizontal overflow below 768px. Under prefers-reduced-motion: reduce, remove optimizer transitions and retain state changes through text, borders, and color.

- [ ] Step 5: Commit.

    git add assets/css/painel-onibus.css
    git commit -m "style: add fleet optimizer states"

### Task 7: Run the full verification and visual review

**Files:**
- Verify all implementation files from Tasks 1–6.
- Review artifacts: .impeccable/review/frota-auto-balance-desktop.png and .impeccable/review/frota-auto-balance-mobile.png.

- [ ] Step 1: Run pure, syntax, and diff checks.

    php php/tests/bus-fleet-balance.test.php
    php -l php/lib/bus-fleet.php
    php -l php/mysql/bus-admin-data.php
    php -l php/mysql/bus-fleet-assign.php
    php -l php/mysql/bus-fleet-auto-balance.php
    node --check assets/js/painel-onibus.js
    git diff --check

Expected: every command exits 0; the pure test prints PASS: fleet balance pure-function tests.

- [ ] Step 2: Run existing project tests.

    npm run test:server

Expected: all existing server tests pass with zero failures.

- [ ] Step 3: Run the Impeccable detector once.

    node .agents/skills/impeccable/scripts/detect.mjs --json painel-onibus.html

Record degraded-mode warnings separately from actionable findings and fix mechanical findings before visual review.

- [ ] Step 4: Inspect desktop and mobile.

Serve the repository locally and inspect the Frota tab. Capture:
- .impeccable/review/frota-auto-balance-desktop.png with preview moves and the fixed VIP notice.
- .impeccable/review/frota-auto-balance-mobile.png with waiting list and stacked preview actions.

Verify normal render, preview, cancel, stale-preview error, apply success, waiting-list manual assignment, existing drag/drop, and existing manual selector.

- [ ] Step 5: Review final diff.

    git diff --stat
    git status --short
    git diff --check

Confirm no payment logic or VIP assignment data changed.

- [ ] Step 6: If a verification fix is required, apply it in the named implementation file, rerun the full verification command set from Step 1, and commit only the files shown by git status --short with a message naming the corrected behavior.
