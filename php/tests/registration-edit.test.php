<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/registration-edit-schema.php';
require_once __DIR__ . '/../lib/registration-edit.php';

function edit_expect($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': ' . var_export($actual, true));
    }
}

echo "PASS: registration edit schema file loads\n";

// ---------------------------------------------------------------------------
// Regras da edição (bus_registration_edit_plan), sem banco.
// ---------------------------------------------------------------------------

const NOW = '2026-10-16 19:00:00';

/**
 * Falha se $fn não lançar ValidationError/RegistrationEditConflict cuja
 * mensagem começa com $prefix. Com $conflictCode, exige o conflito com esse código.
 */
function edit_expect_error(string $prefix, callable $fn, ?string $conflictCode = null): void
{
    try {
        $fn();
    } catch (ValidationError | RegistrationEditConflict $e) {
        if (!str_starts_with($e->getMessage(), $prefix)) {
            throw new RuntimeException("Expected error starting with '{$prefix}', got: " . $e->getMessage());
        }
        if ($conflictCode !== null) {
            $actual = $e instanceof RegistrationEditConflict ? $e->conflictCode : get_class($e);
            if ($actual !== $conflictCode) {
                throw new RuntimeException("Expected conflict '{$conflictCode}', got: {$actual}");
            }
        }
        return;
    }
    throw new RuntimeException("Expected error starting with '{$prefix}', nothing thrown");
}

/**
 * Reserva confirmada no ônibus 3, como PDO::FETCH_ASSOC devolve (tudo string).
 * Passageiros: 1 adulto responsável, 2 adulto, 3 criança de colo.
 */
function edit_fixture(array $passengerOverrides = [], array $registrationOverrides = []): array
{
    $registration = array_merge([
        'id' => '0b6f1c1e-0000-4000-8000-000000000001',
        'primary_name' => 'Pessoa Um', 'primary_cpf' => '52998224725',
        'primary_birth_date' => '1990-05-20',
        'email' => 'um@example.com', 'whatsapp' => '11987654321',
        'passenger_count' => '2', 'children_count' => '1',
        'group_name' => 'Azul', 'is_vip' => '0', 'amount_cents' => '24000',
        'status' => 'confirmed', 'bus_number' => '3', 'fleet_assignment_status' => 'assigned',
        'updated_at' => '2026-10-16 18:00:00',
        'withdrawn_at' => null, 'withdrawn_bus_number' => null, 'withdrawn_fleet_status' => null,
    ], $registrationOverrides);
    $passengers = [
        ['id' => '1', 'position' => '1', 'full_name' => 'Pessoa Um', 'cpf' => '52998224725',
            'whatsapp' => '11987654321', 'email' => 'um@example.com',
            'is_primary' => '1', 'is_minor' => '0', 'is_child_lap' => '0',
            'withdrawn_at' => null, 'withdrawal_reason' => null],
        ['id' => '2', 'position' => '2', 'full_name' => 'Pessoa Dois', 'cpf' => '11144477735',
            'whatsapp' => '11976543210', 'email' => 'dois@example.com',
            'is_primary' => '0', 'is_minor' => '0', 'is_child_lap' => '0',
            'withdrawn_at' => null, 'withdrawal_reason' => null],
        ['id' => '3', 'position' => '3', 'full_name' => 'Criança Três', 'cpf' => '12345678909',
            'whatsapp' => null, 'email' => null,
            'is_primary' => '0', 'is_minor' => '1', 'is_child_lap' => '1',
            'withdrawn_at' => null, 'withdrawal_reason' => null],
    ];
    foreach ($passengers as $i => $p) {
        $passengers[$i] = array_merge($p, $passengerOverrides[$p['id']] ?? []);
    }
    return ['registration' => $registration, 'passengers' => $passengers];
}

/** Pedido do painel a partir da fixture, aplicando $overrides[id] em cada passageiro. */
function edit_request(array $overrides = [], ?string $primaryId = '1', ?array $fixture = null): array
{
    $fixture ??= edit_fixture();
    $passengers = [];
    foreach ($fixture['passengers'] as $p) {
        $age = $p['is_child_lap'] === '1' ? 'lap' : ($p['is_minor'] === '1' ? 'minor' : 'adult');
        $passengers[] = array_merge([
            'id' => $p['id'], 'full_name' => $p['full_name'], 'cpf' => $p['cpf'],
            'whatsapp' => $p['whatsapp'] ?? '', 'email' => $p['email'] ?? '',
            'age_group' => $age, 'withdrawn' => $p['withdrawn_at'] !== null,
            'withdrawal_reason' => $p['withdrawal_reason'] ?? '',
        ], $overrides[$p['id']] ?? []);
    }
    return [
        'registration_id' => $fixture['registration']['id'],
        'expected_updated_at' => $fixture['registration']['updated_at'],
        'group_name' => $fixture['registration']['group_name'],
        'primary_passenger_id' => $primaryId,
        'passengers' => $passengers,
    ];
}

function edit_passenger(array $plan, string $id): array
{
    foreach ($plan['passengers'] as $p) {
        if ($p['id'] === $id) return $p;
    }
    throw new RuntimeException("Passenger {$id} missing from plan");
}

function edit_changes(array $plan, string $field): array
{
    return array_values(array_filter($plan['changes'], static fn (array $c): bool => $c['field'] === $field));
}

// Sem alteração: nada muda, nada notifica.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(), [], NOW);
edit_expect([], $plan['changes'], 'Unchanged request has no changes');
edit_expect(false, $plan['notify'], 'Unchanged request does not notify');
edit_expect([2, 2], [$plan['seats_before'], $plan['seats_after']], 'Unchanged seats');
edit_expect(false, $plan['fully_withdrawn'], 'Unchanged is not fully withdrawn');
edit_expect(false, $plan['reactivated_registration'], 'Unchanged is not reactivated');
edit_expect(false, array_key_exists('primary_birth_date', $plan['registration']), 'Birth date kept when primary unchanged');
edit_expect(
    ['id' => '3', 'full_name' => 'Criança Três', 'cpf' => '12345678909', 'whatsapp' => null, 'email' => null,
        'is_primary' => 0, 'is_minor' => 1, 'is_child_lap' => 1, 'withdrawn_at' => null, 'withdrawal_reason' => null],
    edit_passenger($plan, '3'),
    'Passenger row shape'
);

// Regra 1: mesmos ids, nem a mais nem a menos.
$missing = edit_request();
array_pop($missing['passengers']);
edit_expect_error('Os passageiros enviados não conferem', fn () => bus_registration_edit_plan(edit_fixture(), $missing, [], NOW));
$extra = edit_request();
$extra['passengers'][] = array_merge($extra['passengers'][1], ['id' => '99', 'cpf' => '39053344705']);
edit_expect_error('Os passageiros enviados não conferem', fn () => bus_registration_edit_plan(edit_fixture(), $extra, [], NOW));
$dup = edit_request();
$dup['passengers'][2]['id'] = '2';
edit_expect_error('Os passageiros enviados não conferem', fn () => bus_registration_edit_plan(edit_fixture(), $dup, [], NOW));

// Reserva legada sem linhas de passageiros não é editável (não vira desistente).
$empty = edit_fixture();
$empty['passengers'] = [];
$emptyRequest = array_merge(edit_request(), ['passengers' => [], 'group_name' => 'Catan']);
edit_expect_error('Esta reserva não tem passageiros cadastrados e não pode ser editada aqui.',
    fn () => bus_registration_edit_plan($empty, $emptyRequest, [], NOW));
// Contagem gravada divergente das linhas (sem desistência anterior) bloqueia.
$drift = edit_fixture([], ['passenger_count' => '3']);
edit_expect_error('Os passageiros desta reserva não conferem com a contagem gravada.',
    fn () => bus_registration_edit_plan($drift, edit_request([], '1', $drift), [], NOW));
$driftKids = edit_fixture([], ['children_count' => '0']);
edit_expect_error('Os passageiros desta reserva não conferem com a contagem gravada.',
    fn () => bus_registration_edit_plan($driftKids, edit_request([], '1', $driftKids), [], NOW));

// Mensagens usam a posição gravada do passageiro.
$positioned = edit_fixture(['2' => ['position' => '5']]);
edit_expect_error('CPF inválido para o passageiro 5', fn () => bus_registration_edit_plan(
    $positioned, edit_request(['2' => ['cpf' => '000']], '1', $positioned), [], NOW));

// Regra 2: reserva mudou desde que o modal abriu → conflito 'stale'.
$stale = edit_request();
$stale['expected_updated_at'] = '2026-10-16 17:59:59';
edit_expect_error('A reserva mudou desde que você abriu.', fn () => bus_registration_edit_plan(edit_fixture(), $stale, [], NOW), 'stale');

// Regra 3: normalização de nome, CPF, WhatsApp e e-mail.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => [
    'full_name' => '  pessoa   dois   silva ', 'cpf' => '111.444.777-35',
    'whatsapp' => '(11) 97654-3210', 'email' => ' Dois@Example.COM ',
]]), [], NOW);
$p2 = edit_passenger($plan, '2');
edit_expect(['Pessoa Dois Silva', '11144477735', '11976543210', 'dois@example.com'],
    [$p2['full_name'], $p2['cpf'], $p2['whatsapp'], $p2['email']], 'Passenger fields normalized');
edit_expect([['passenger_id' => '2', 'field' => 'full_name', 'before' => 'Pessoa Dois', 'after' => 'Pessoa Dois Silva']],
    $plan['changes'], 'Only the real change is logged');
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['whatsapp' => '', 'email' => '']]), [], NOW);
edit_expect([null, null], [edit_passenger($plan, '2')['whatsapp'], edit_passenger($plan, '2')['email']], 'Optional contact empties to null');
edit_expect_error('Informe o nome completo', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['full_name' => 'Pessoa']]), [], NOW));
edit_expect_error('CPF inválido', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['cpf' => '111.111.111-11']]), [], NOW));
edit_expect_error('WhatsApp do passageiro 2 inválido.', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['whatsapp' => '123']]), [], NOW));
edit_expect_error('E-mail do passageiro 2 inválido.', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['email' => 'x@']]), [], NOW));
edit_expect_error('Não repita o CPF de um passageiro.', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['cpf' => '529.982.247-25']]), [], NOW));
edit_expect_error('Faixa etária inválida', fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['age_group' => 'senior']]), [], NOW));

// Regra 4: responsável adulto, ativo, com WhatsApp e e-mail.
edit_expect_error('O responsável precisa ser um adulto (18+) que continua na viagem.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request([], '3'), [], NOW));
edit_expect_error('O responsável precisa ser um adulto (18+) que continua na viagem.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['age_group' => 'minor']], '2'), [], NOW));
edit_expect_error('O responsável precisa ser um adulto (18+) que continua na viagem.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['withdrawn' => true]], '2'), [], NOW));
edit_expect_error('O responsável precisa ser um adulto (18+) que continua na viagem.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request([], '99'), [], NOW));
edit_expect_error('Informe WhatsApp e e-mail do responsável.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['email' => '']], '2'), [], NOW));
edit_expect_error('Informe WhatsApp e e-mail do responsável.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['whatsapp' => '']]), [], NOW));

// Regra 5: responsável desistiu e não foi trocado.
edit_expect_error('Escolha o novo responsável', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true]]), [], NOW));

// Regra 6: colo ≤ pagantes ativos. Os dois adultos saem e só a criança fica:
// a regra de colo vem antes da de responsável.
edit_expect_error('Há mais crianças de colo', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true], '2' => ['withdrawn' => true]]), [], NOW));
edit_expect_error('Há mais crianças de colo', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['age_group' => 'lap'], '2' => ['age_group' => 'lap']], '2'), [], NOW));
// Menor de 6 a 17 conta como pagante para o colo (regra do brief: adult+minor).
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['age_group' => 'minor']]), [], NOW);
edit_expect([['passenger_id' => '2', 'field' => 'age_group', 'before' => 'adult', 'after' => 'minor']],
    $plan['changes'], 'Age group change logged');
edit_expect([0, 1, 0], [edit_passenger($plan, '2')['is_primary'], edit_passenger($plan, '2')['is_minor'], edit_passenger($plan, '2')['is_child_lap']],
    'Minor flags');

// Desistência da criança de colo: pagantes ficam, assento não muda.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['3' => ['withdrawn' => true]]), [], NOW);
edit_expect(2, $plan['registration']['passenger_count'], 'Lap child withdrawal keeps payers');
edit_expect(0, $plan['registration']['children_count'], 'Lap child no longer counted');
edit_expect([2, 2], [$plan['seats_before'], $plan['seats_after']], 'Lap child frees no seat');
edit_expect(NOW, edit_passenger($plan, '3')['withdrawn_at'], 'Withdrawal stamped with now');

// Troca de responsável junto da desistência do atual (regras 5 e 12).
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['withdrawn' => true]], '2'), [], NOW);
edit_expect('Pessoa Dois', $plan['registration']['primary_name'], 'New primary becomes contact');
edit_expect('11144477735', $plan['registration']['primary_cpf'], 'New primary CPF');
edit_expect('dois@example.com', $plan['registration']['email'], 'New primary e-mail');
edit_expect('11976543210', $plan['registration']['whatsapp'], 'New primary WhatsApp');
edit_expect(true, array_key_exists('primary_birth_date', $plan['registration']), 'Birth date column written');
edit_expect(null, $plan['registration']['primary_birth_date'], 'Birth date cleared on primary change');
edit_expect([0, 1], [edit_passenger($plan, '1')['is_primary'], edit_passenger($plan, '2')['is_primary']], 'is_primary moves');
edit_expect([1, 1], [$plan['registration']['passenger_count'], $plan['registration']['children_count']], 'Counts follow actives');
edit_expect([2, 1], [$plan['seats_before'], $plan['seats_after']], 'Adult withdrawal frees a seat');
edit_expect(true, $plan['notify'], 'Withdrawal notifies');
edit_expect([['passenger_id' => null, 'field' => 'primary', 'before' => '1', 'after' => '2']],
    edit_changes($plan, 'primary'), 'Primary change logged');
edit_expect([['passenger_id' => '1', 'field' => 'withdrawn', 'before' => false, 'after' => true]],
    edit_changes($plan, 'withdrawn'), 'Withdrawn change logged');

// Só troca de responsável (sem desistência) também notifica.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request([], '2'), [], NOW);
edit_expect(true, $plan['notify'], 'Primary change notifies');
edit_expect(1, count($plan['changes']), 'Only primary changed');

// Regra 7: desistência só em reserva confirmada (VIP também é confirmed).
$pending = edit_fixture([], ['status' => 'payment_pending']);
edit_expect_error('Só reservas confirmadas podem registrar desistência.', fn () => bus_registration_edit_plan(
    $pending, edit_request(['2' => ['withdrawn' => true]], '1', $pending), [], NOW));
$plan = bus_registration_edit_plan($pending, edit_request(['2' => ['full_name' => 'Pessoa Dois Souza']], '1', $pending), [], NOW);
edit_expect('Pessoa Dois Souza', edit_passenger($plan, '2')['full_name'], 'Pending reservation still editable');
// Ordem: erro de dados (regra 3) de qualquer passageiro vem antes da regra 7.
edit_expect_error('CPF inválido para o passageiro 2', fn () => bus_registration_edit_plan(
    $pending, edit_request(['1' => ['withdrawn' => true], '2' => ['cpf' => '000']], '2', $pending), [], NOW));
// Desistente anterior a um estorno continua editável.
$refunded = edit_fixture(['2' => ['withdrawn_at' => '2026-10-10 10:00:00']], ['status' => 'refunded', 'passenger_count' => '1']);
$plan = bus_registration_edit_plan($refunded, edit_request(['2' => ['full_name' => 'Pessoa Dois Souza']], '1', $refunded), [], NOW);
edit_expect('2026-10-10 10:00:00', edit_passenger($plan, '2')['withdrawn_at'], 'Existing withdrawal survives non-confirmed status');
$vip = edit_fixture([], ['is_vip' => '1', 'status' => 'confirmed']);
$plan = bus_registration_edit_plan($vip, edit_request(['2' => ['withdrawn' => true]], '1', $vip), [], NOW);
edit_expect(NOW, edit_passenger($plan, '2')['withdrawn_at'], 'VIP reservation accepts withdrawal');

// Regra 8: motivo, preservação da data e desmarcação.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['withdrawn' => true, 'withdrawal_reason' => "  Ficou doente \n"]]), [], NOW);
edit_expect('Ficou doente', edit_passenger($plan, '2')['withdrawal_reason'], 'Reason trimmed');
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['withdrawn' => true, 'withdrawal_reason' => '   ']]), [], NOW);
edit_expect(null, edit_passenger($plan, '2')['withdrawal_reason'], 'Empty reason becomes null');
edit_expect_error('O motivo da desistência', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['2' => ['withdrawn' => true, 'withdrawal_reason' => str_repeat('á', 501)]]), [], NOW));
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => ['withdrawn' => true, 'withdrawal_reason' => str_repeat('á', 500)]]), [], NOW);
edit_expect(500, mb_strlen((string) edit_passenger($plan, '2')['withdrawal_reason'], 'UTF-8'), 'Reason of 500 chars accepted');
$withdrawn2 = edit_fixture(['2' => ['withdrawn_at' => '2026-10-10 10:00:00', 'withdrawal_reason' => 'Viagem']], ['passenger_count' => '1']);
$plan = bus_registration_edit_plan($withdrawn2, edit_request(['2' => ['withdrawal_reason' => 'Viagem a trabalho']], '1', $withdrawn2), [], NOW);
edit_expect('2026-10-10 10:00:00', edit_passenger($plan, '2')['withdrawn_at'], 'withdrawn_at preserved on new save');
edit_expect(false, $plan['notify'], 'Reason-only edit does not notify');
edit_expect([['passenger_id' => '2', 'field' => 'withdrawal_reason', 'before' => 'Viagem', 'after' => 'Viagem a trabalho']],
    $plan['changes'], 'Reason change logged');
$plan = bus_registration_edit_plan($withdrawn2, edit_request(['2' => ['withdrawn' => false]], '1', $withdrawn2), [], NOW);
edit_expect([null, null], [edit_passenger($plan, '2')['withdrawn_at'], edit_passenger($plan, '2')['withdrawal_reason']], 'Unmark clears withdrawal');
edit_expect([1, 2], [$plan['seats_before'], $plan['seats_after']], 'Passenger reactivation takes a seat');
edit_expect(true, $plan['notify'], 'Passenger reactivation notifies');
edit_expect(false, $plan['reactivated_registration'], 'Passenger reactivation is not registration reactivation');

// Regra 9: grupo.
$plan = bus_registration_edit_plan(edit_fixture(), array_merge(edit_request(), ['group_name' => 'Catan']), ['Wingspan'], NOW);
edit_expect('Catan', $plan['registration']['group_name'], 'Free catalog group accepted');
edit_expect([['passenger_id' => null, 'field' => 'group_name', 'before' => 'Azul', 'after' => 'Catan']], $plan['changes'], 'Group change logged');
edit_expect(false, $plan['notify'], 'Group change does not notify');
$plan = bus_registration_edit_plan(edit_fixture(), array_merge(edit_request(), ['group_name' => null]), [], NOW);
edit_expect(null, $plan['registration']['group_name'], 'Null group allowed');
$noKey = edit_request();
unset($noKey['group_name']);
$plan = bus_registration_edit_plan(edit_fixture(), $noKey, [], NOW);
edit_expect('Azul', $plan['registration']['group_name'], 'Missing group key keeps current group');
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(), ['Azul'], NOW);
edit_expect('Azul', $plan['registration']['group_name'], 'Own current group allowed');
edit_expect_error('Escolha um nome de grupo disponível.', fn () => bus_registration_edit_plan(edit_fixture(),
    array_merge(edit_request(), ['group_name' => 'Wingspan']), ['Wingspan'], NOW));
edit_expect_error('Escolha um nome de grupo disponível.', fn () => bus_registration_edit_plan(edit_fixture(),
    array_merge(edit_request(), ['group_name' => 'Banco Imobiliário']), [], NOW));
foreach ([123, true, ['Azul']] as $badGroup) {
    edit_expect_error('Escolha um nome de grupo disponível.', fn () => bus_registration_edit_plan(edit_fixture(),
        array_merge(edit_request(), ['group_name' => $badGroup]), [], NOW));
}

// Regra 10: todos desistiram.
$all = edit_request(['1' => ['withdrawn' => true], '2' => ['withdrawn' => true], '3' => ['withdrawn' => true]]);
$plan = bus_registration_edit_plan(edit_fixture(), $all, [], NOW);
edit_expect(true, $plan['fully_withdrawn'], 'All withdrawn');
edit_expect(null, $plan['registration']['bus_number'], 'Leaves the bus');
edit_expect(3, $plan['registration']['withdrawn_bus_number'], 'Remembers the bus');
edit_expect('assigned', $plan['registration']['withdrawn_fleet_status'], 'Remembers the fleet status');
edit_expect(NOW, $plan['registration']['withdrawn_at'], 'Registration withdrawal stamped');
edit_expect(false, array_key_exists('passenger_count', $plan['registration']), 'Counts untouched (trigger needs >= 1)');
edit_expect(false, array_key_exists('children_count', $plan['registration']), 'Children count untouched');
edit_expect([2, 0], [$plan['seats_before'], $plan['seats_after']], 'Seats freed');
edit_expect(true, $plan['notify'], 'Full withdrawal notifies');
edit_expect(1, edit_passenger($plan, '1')['is_primary'], 'Primary kept when everyone withdrew');
// Reserva já desistente salva de novo: nada do ônibus guardado se perde.
$gone = edit_fixture(
    ['1' => ['withdrawn_at' => '2026-10-15 12:00:00'], '2' => ['withdrawn_at' => '2026-10-15 12:00:00'], '3' => ['withdrawn_at' => '2026-10-15 12:00:00']],
    ['bus_number' => null, 'withdrawn_at' => '2026-10-15 12:00:00', 'withdrawn_bus_number' => '3', 'withdrawn_fleet_status' => 'assigned']
);
$plan = bus_registration_edit_plan($gone, edit_request(['2' => ['withdrawal_reason' => 'Desistiu']], '1', $gone), [], NOW);
edit_expect(true, $plan['fully_withdrawn'], 'Still fully withdrawn');
edit_expect(false, array_key_exists('withdrawn_bus_number', $plan['registration']), 'Stored bus not overwritten');
edit_expect(false, array_key_exists('withdrawn_at', $plan['registration']), 'Registration withdrawal date not overwritten');
edit_expect([0, 0], [$plan['seats_before'], $plan['seats_after']], 'No seats either way');
edit_expect('2026-10-15 12:00:00', edit_passenger($plan, '2')['withdrawn_at'], 'Passenger date preserved');

// Regra 11: reativação da reserva inteira volta ao ônibus guardado.
$plan = bus_registration_edit_plan($gone, edit_request(['1' => ['withdrawn' => false], '2' => ['withdrawn' => false], '3' => ['withdrawn' => false]], '1', $gone), [], NOW);
edit_expect(true, $plan['reactivated_registration'], 'Registration reactivated');
edit_expect(false, $plan['fully_withdrawn'], 'Reactivated is not fully withdrawn');
edit_expect(3, $plan['registration']['bus_number'], 'Back to the stored bus');
edit_expect('assigned', $plan['registration']['fleet_assignment_status'], 'Back to stored fleet status');
edit_expect([null, null, null], [$plan['registration']['withdrawn_at'], $plan['registration']['withdrawn_bus_number'], $plan['registration']['withdrawn_fleet_status']],
    'Withdrawal columns cleared');
edit_expect([2, 1], [$plan['registration']['passenger_count'], $plan['registration']['children_count']], 'Counts restored');
edit_expect([0, 2], [$plan['seats_before'], $plan['seats_after']], 'Reactivation takes seats');
edit_expect(true, $plan['notify'], 'Reactivation notifies');
$waiting = edit_fixture(
    ['1' => ['withdrawn_at' => '2026-10-15 12:00:00'], '2' => ['withdrawn_at' => '2026-10-15 12:00:00'], '3' => ['withdrawn_at' => '2026-10-15 12:00:00']],
    ['bus_number' => null, 'withdrawn_at' => '2026-10-15 12:00:00', 'withdrawn_bus_number' => null, 'withdrawn_fleet_status' => null]
);
$plan = bus_registration_edit_plan($waiting, edit_request(['1' => ['withdrawn' => false]], '1', $waiting), [], NOW);
edit_expect([null, 'waiting'], [$plan['registration']['bus_number'], $plan['registration']['fleet_assignment_status']],
    'No stored bus goes back to waiting');
$noStatus = edit_fixture(
    ['1' => ['withdrawn_at' => '2026-10-15 12:00:00'], '2' => ['withdrawn_at' => '2026-10-15 12:00:00'], '3' => ['withdrawn_at' => '2026-10-15 12:00:00']],
    ['bus_number' => null, 'withdrawn_at' => '2026-10-15 12:00:00', 'withdrawn_bus_number' => '4', 'withdrawn_fleet_status' => null]
);
$plan = bus_registration_edit_plan($noStatus, edit_request(['1' => ['withdrawn' => false]], '1', $noStatus), [], NOW);
edit_expect([4, 'assigned'], [$plan['registration']['bus_number'], $plan['registration']['fleet_assignment_status']],
    'Stored bus without stored status defaults to assigned');
edit_expect([1, 0], [$plan['registration']['passenger_count'], $plan['registration']['children_count']], 'Partial reactivation counts');

// Regras 12 e 13: colo → adulto passa a ocupar assento.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['3' => ['age_group' => 'adult']]), [], NOW);
edit_expect([3, 0], [$plan['registration']['passenger_count'], $plan['registration']['children_count']], 'Lap to adult counts');
edit_expect([2, 3], [$plan['seats_before'], $plan['seats_after']], 'Lap to adult takes a seat');
edit_expect([0, 0], [edit_passenger($plan, '3')['is_minor'], edit_passenger($plan, '3')['is_child_lap']], 'Adult flags');
edit_expect(['Pessoa Um', '52998224725', 'um@example.com', '11987654321'],
    [$plan['registration']['primary_name'], $plan['registration']['primary_cpf'], $plan['registration']['email'], $plan['registration']['whatsapp']],
    'Contact synced with primary');
// Correção dos dados do responsável chega à reserva.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['full_name' => 'Pessoa Um Lima', 'email' => 'novo@example.com']]), [], NOW);
edit_expect(['Pessoa Um Lima', 'novo@example.com'], [$plan['registration']['primary_name'], $plan['registration']['email']], 'Primary edit syncs registration');
edit_expect(false, array_key_exists('primary_birth_date', $plan['registration']), 'Same primary keeps birth date');

// Tipos crus do PDO com inteiros nativos também funcionam.
$native = edit_fixture(['1' => ['id' => 1, 'is_primary' => 1]], ['bus_number' => 3]);
$nativeRequest = edit_request([], '1', edit_fixture());
$plan = bus_registration_edit_plan($native, $nativeRequest, [], NOW);
edit_expect('1', edit_passenger($plan, '1')['id'], 'Integer ids normalized to string');
$nativeAll = edit_fixture(
    ['1' => ['id' => 1, 'position' => 1, 'is_primary' => 1, 'is_minor' => 0, 'is_child_lap' => 0],
        '2' => ['id' => 2, 'position' => 2, 'is_primary' => 0, 'is_minor' => 0, 'is_child_lap' => 0],
        '3' => ['id' => 3, 'position' => 3, 'is_primary' => 0, 'is_minor' => 1, 'is_child_lap' => 1]],
    ['bus_number' => 3, 'passenger_count' => 2, 'children_count' => 1, 'is_vip' => 0]
);
$plan = bus_registration_edit_plan($nativeAll, edit_request(['2' => ['withdrawn' => true]], '1', edit_fixture()), [], NOW);
edit_expect([2, 1], [$plan['seats_before'], $plan['seats_after']], 'Native ints: seats');
edit_expect([1, 1], [$plan['registration']['passenger_count'], $plan['registration']['children_count']], 'Native ints: counts');
$plan = bus_registration_edit_plan($nativeAll, $all, [], NOW);
edit_expect(3, $plan['registration']['withdrawn_bus_number'], 'Native ints: stored bus is int 3');
edit_expect([2, 0], [$plan['seats_before'], $plan['seats_after']], 'Native ints: full withdrawal seats');

echo "PASS: registration edit rules\n";

$dsn = getenv('KOB_BOARDING_TEST_DSN');
if (!$dsn) {
    echo "SKIP: MySQL integration (set KOB_BOARDING_TEST_DSN for isolated kob_boarding_test database)\n";
    exit;
}
$pdo = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
edit_expect('kob_boarding_test', $pdo->query('SELECT DATABASE()')->fetchColumn(), 'Must use isolated test database');
// Reset determinístico: o banco pode ter sobras de outra suíte ou de execução interrompida.
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
try {
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $pdo->exec('DROP TABLE `' . str_replace('`', '``', $table) . '`');
    }
} finally {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}
// Tabelas de base com as colunas reais usadas pelas tarefas de edição/desistência.
$pdo->exec("CREATE TABLE bus_registrations (
    id CHAR(36) PRIMARY KEY,
    primary_name VARCHAR(255), primary_cpf VARCHAR(14), primary_birth_date DATE NULL,
    email VARCHAR(255), whatsapp VARCHAR(32),
    passenger_count INT NOT NULL DEFAULT 1, children_count INT NOT NULL DEFAULT 0,
    group_name VARCHAR(64) NULL, is_vip TINYINT(1) NOT NULL DEFAULT 0,
    amount_cents INT NOT NULL DEFAULT 0, status VARCHAR(32),
    bus_number INT NULL,
    fleet_assignment_status ENUM('assigned', 'waiting') NOT NULL DEFAULT 'assigned',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$pdo->exec('CREATE TABLE bus_passengers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    registration_id CHAR(36) NOT NULL, `position` SMALLINT NOT NULL,
    full_name VARCHAR(255), cpf VARCHAR(14), whatsapp VARCHAR(11) NULL, email VARCHAR(255) NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0, is_minor TINYINT(1) NOT NULL DEFAULT 0,
    is_child_lap TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (registration_id) REFERENCES bus_registrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

bus_registration_edit_ensure_schema($pdo);
bus_registration_edit_ensure_schema($pdo); // idempotente
$cols = $pdo->query("SHOW COLUMNS FROM bus_passengers LIKE 'withdraw%'")->fetchAll(PDO::FETCH_COLUMN);
sort($cols);
edit_expect(['withdrawal_reason', 'withdrawn_at'], $cols, 'Passenger withdrawal columns');
foreach (['withdrawn_at', 'withdrawn_bus_number', 'withdrawn_fleet_status'] as $c) {
    edit_expect(1, $pdo->query("SHOW COLUMNS FROM bus_registrations LIKE '$c'")->rowCount(), "Registration $c");
}
edit_expect(0, (int) $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(), 'Edit log table exists');

// Usuário sem CREATE/ALTER (mesmo GRANT de bus-boarding.test.php) não quebra.
$pdo->exec("CREATE USER IF NOT EXISTS 'kob_boarding_runtime'@'%' IDENTIFIED BY ''");
$pdo->exec("GRANT SELECT, INSERT, UPDATE ON kob_boarding_test.* TO 'kob_boarding_runtime'@'%'");
$runtime = new PDO($dsn, 'kob_boarding_runtime', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
bus_registration_edit_ensure_schema($runtime);
echo "PASS: edit schema\n";
