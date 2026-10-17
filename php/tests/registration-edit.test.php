<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/registration-edit-schema.php';
require_once __DIR__ . '/../lib/registration-edit.php';
require_once __DIR__ . '/../lib/bus-boarding.php';
require_once __DIR__ . '/../lib/bus-fleet.php';
require_once __DIR__ . '/../lib/registration-edit-apply.php';
require_once __DIR__ . '/../lib/registration-edit-email.php';
require_once __DIR__ . '/../mysql/lib/confirmation-mailer.php';

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

// Regra 4: responsável adulto e ativo; contato obrigatório ao trocar de
// responsável ou se o campo já estava gravado.
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
edit_expect_error('Informe WhatsApp e e-mail do responsável.',
    fn () => bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['email' => '']]), [], NOW));
// VIP sem contato gravado (passageiro e reserva com valor vazio): editar o nome salva sem inventar contato.
$vip = edit_fixture(
    ['1' => ['whatsapp' => null, 'email' => null], '2' => ['withdrawn_at' => '2026-10-15 12:00:00'],
        '3' => ['withdrawn_at' => '2026-10-15 12:00:00']],
    ['email' => '', 'whatsapp' => '', 'passenger_count' => '1', 'children_count' => '0', 'is_vip' => '1']
);
$plan = bus_registration_edit_plan($vip, edit_request(['1' => ['full_name' => 'Pessoa Um Vip']], '1', $vip), [], NOW);
edit_expect([null, null], [edit_passenger($plan, '1')['whatsapp'], edit_passenger($plan, '1')['email']], 'VIP keeps no contact');
edit_expect('Pessoa Um Vip', $plan['registration']['primary_name'], 'VIP name saved');
edit_expect(false, array_key_exists('email', $plan['registration']) || array_key_exists('whatsapp', $plan['registration']),
    'VIP without contact does not overwrite the registration contact columns');
// Só um dos campos gravado: esse não pode ser apagado; o outro segue opcional.
$halfVip = edit_fixture(['1' => ['email' => null]], ['email' => '']);
bus_registration_edit_plan($halfVip, edit_request([], '1', $halfVip), [], NOW);
edit_expect_error('Informe WhatsApp e e-mail do responsável.',
    fn () => bus_registration_edit_plan($halfVip, edit_request(['1' => ['whatsapp' => '']], '1', $halfVip), [], NOW));
// Novo responsável precisa de contato completo, mesmo vindo de um VIP sem contato.
$vipPair = edit_fixture(['1' => ['whatsapp' => null, 'email' => null], '2' => ['email' => null]]);
edit_expect_error('Informe WhatsApp e e-mail do responsável.',
    fn () => bus_registration_edit_plan($vipPair, edit_request(['1' => ['withdrawn' => true]], '2', $vipPair), [], NOW));
$plan = bus_registration_edit_plan($vipPair, edit_request(['1' => ['withdrawn' => true], '2' => ['email' => 'dois@example.com']], '2', $vipPair), [], NOW);
edit_expect(['dois@example.com', '11976543210'], [$plan['registration']['email'], $plan['registration']['whatsapp']], 'New primary contact written');

// Regra 5: responsável desistiu e não foi trocado.
edit_expect_error('Escolha o novo responsável', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true]]), [], NOW));

// Regra 6: colo ≤ pagantes ativos. Os dois adultos saem e só a criança fica:
// a regra de colo vem antes da de responsável.
edit_expect_error('Há mais crianças de colo', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['withdrawn' => true], '2' => ['withdrawn' => true]]), [], NOW));
edit_expect_error('Há mais crianças de colo', fn () => bus_registration_edit_plan(edit_fixture(),
    edit_request(['1' => ['age_group' => 'lap'], '2' => ['age_group' => 'lap']], '2'), [], NOW));
// Colo só com adulto 18+ (como no checkout): menor de 6 a 17 não conta.
$fourWithMinor = static function (array $extra = []): array {
    $f = edit_fixture([], ['passenger_count' => '2', 'children_count' => '2']);
    $f['passengers'][1]['is_minor'] = '1';
    $f['passengers'][] = ['id' => '4', 'position' => '4', 'full_name' => 'Criança Quatro', 'cpf' => '39053344705',
        'whatsapp' => null, 'email' => null, 'is_primary' => '0', 'is_minor' => '1', 'is_child_lap' => '1',
        'withdrawn_at' => null, 'withdrawal_reason' => null];
    foreach ($extra as $p) $f['passengers'][] = $p;
    return $f;
};
$oneAdult = $fourWithMinor(); // 1 adulto + 1 menor + 2 colo
edit_expect_error('Há mais crianças de colo do que adultos (18+) na viagem. Marque também a desistência da criança ou mantenha um adulto.',
    fn () => bus_registration_edit_plan($oneAdult, edit_request([], '1', $oneAdult), [], NOW));
$twoAdults = $fourWithMinor([['id' => '5', 'position' => '5', 'full_name' => 'Pessoa Cinco', 'cpf' => '10000000019',
    'whatsapp' => null, 'email' => null, 'is_primary' => '0', 'is_minor' => '0', 'is_child_lap' => '0',
    'withdrawn_at' => null, 'withdrawal_reason' => null]]);
$twoAdults['registration']['passenger_count'] = '3';
$plan = bus_registration_edit_plan($twoAdults, edit_request([], '1', $twoAdults), [], NOW); // 2 adultos + 1 menor + 2 colo
edit_expect([[], 3], [$plan['changes'], $plan['seats_after']], 'Two adults carry two lap children; minor still takes a seat');
// Menor de 6 a 17 com o colo coberto por adulto: troca de faixa permitida.
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

// Nome gravado fora do formato atual (cadastro antigo): salvar sem mexer não
// registra mudança falsa; mudar de verdade registra o valor gravado como antes.
$legacyName = edit_fixture(['2' => ['full_name' => 'pessoa  DOIS']]);
$plan = bus_registration_edit_plan($legacyName, edit_request(['2' => ['full_name' => 'Pessoa Dois']], '1', $legacyName), [], NOW);
edit_expect([], $plan['changes'], 'Legacy unnormalized name is not a change');
edit_expect('Pessoa Dois', edit_passenger($plan, '2')['full_name'], 'Legacy name is saved normalized');
$plan = bus_registration_edit_plan($legacyName, edit_request(['2' => ['full_name' => 'Pessoa Dois Silva']], '1', $legacyName), [], NOW);
edit_expect([['passenger_id' => '2', 'field' => 'full_name', 'before' => 'pessoa  DOIS', 'after' => 'Pessoa Dois Silva']],
    edit_changes($plan, 'full_name'), 'Real rename logs the stored name as before');

echo "PASS: registration edit rules\n";

// ---------------------------------------------------------------------------
// E-mail para a organização (só o template; nada é enviado).
// ---------------------------------------------------------------------------
$before = edit_fixture()['registration'];
edit_expect('Reserva 0B6F1C1E – alteração no painel', bus_registration_edit_email_subject('0B6F1C1E'), 'Email subject');

$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['2' => [
    'withdrawn' => true, 'withdrawal_reason' => 'Mudou de <planos>', 'email' => 'novo@example.com',
]]), [], NOW);
$context = bus_registration_edit_email_context($before, $plan, 2);
edit_expect(['0B6F1C1E', 'Azul', 3, 1], [$context['code'], $context['group'], $context['bus_number'], $context['seats_freed']], 'Email context');
$text = bus_registration_edit_email_text($context);
foreach ([
    'RESERVA 0B6F1C1E - ALTERAÇÃO NO PAINEL', 'Grupo: Azul', 'Ônibus: 3',
    "DESISTÊNCIAS\r\n- Pessoa Dois (motivo: Mudou de <planos>)",
    "DADOS CORRIGIDOS\r\n- Pessoa Dois: e-mail",
    "LUGARES\r\n- 1 lugar liberado no Ônibus 3\r\n- 2 reservas aguardando ônibus",
] as $needle) {
    edit_expect(true, str_contains($text, $needle), "Email text has '{$needle}'");
}
edit_expect(false, str_contains($text, 'motivo da desistência'), 'Reason is not repeated as a correction');
$html = bus_registration_edit_email_html($context);
edit_expect(true, str_contains($html, 'Pessoa Dois (motivo: Mudou de &lt;planos&gt;)'), 'Email html escapes the reason');
edit_expect(false, str_contains($html, '<planos>'), 'Email html has no raw reason markup');
edit_expect(true, str_contains($html, '1 lugar liberado no Ônibus 3'), 'Email html has seats freed');
edit_expect(true, str_contains($html, '2 reservas aguardando ônibus'), 'Email html has waiting count');
edit_expect(true, str_contains($html, 'Reserva 0B6F1C1E – alteração no painel'), 'Email html preheader is the subject');

$noWaiting = bus_registration_edit_email_text(bus_registration_edit_email_context($before, $plan, 0));
edit_expect(false, str_contains($noWaiting, 'aguardando'), 'No waiting line when nobody waits');
edit_expect(true, str_contains(bus_registration_edit_email_text(bus_registration_edit_email_context($before, $plan, 1)),
    '1 reserva aguardando ônibus'), 'Singular waiting line');

// Troca de responsável + desistência do antigo, sem motivo.
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(['1' => ['withdrawn' => true]], '2'), [], NOW);
$text = bus_registration_edit_email_text(bus_registration_edit_email_context($before, $plan, 0));
edit_expect(true, str_contains($text, "NOVO RESPONSÁVEL\r\n- Pessoa Um → Pessoa Dois"), 'Email lists new primary');
edit_expect(true, str_contains($text, 'Pessoa Um (sem motivo informado)'), 'Email marks missing reason');

// Desistência total: o ônibus do e-mail é o de antes (o plano zera bus_number).
$plan = bus_registration_edit_plan(edit_fixture(), edit_request(
    ['1' => ['withdrawn' => true], '2' => ['withdrawn' => true], '3' => ['withdrawn' => true]]), [], NOW);
$context = bus_registration_edit_email_context($before, $plan, 0);
edit_expect([3, 2], [$context['bus_number'], $context['seats_freed']], 'Full withdrawal email keeps old bus');
edit_expect(true, str_contains(bus_registration_edit_email_text($context), '2 lugares liberados no Ônibus 3'), 'Plural seats freed');

// Reativação da reserva inteira: volta para o ônibus guardado.
$gone = edit_fixture(
    ['1' => ['withdrawn_at' => '2026-10-16 10:00:00'], '2' => ['withdrawn_at' => '2026-10-16 10:00:00'],
        '3' => ['withdrawn_at' => '2026-10-16 10:00:00']],
    ['bus_number' => null, 'withdrawn_at' => '2026-10-16 10:00:00', 'withdrawn_bus_number' => '3', 'withdrawn_fleet_status' => 'assigned']
);
$plan = bus_registration_edit_plan($gone, edit_request(['1' => ['withdrawn' => false]], '1', $gone), [], NOW);
$text = bus_registration_edit_email_text(bus_registration_edit_email_context($gone['registration'], $plan, 0));
edit_expect(true, str_contains($text, "VOLTARAM PARA A VIAGEM\r\n- Pessoa Um"), 'Email lists reactivation');
edit_expect(true, str_contains($text, '1 lugar ocupado a mais no Ônibus 3'), 'Email lists seats taken');
echo "PASS: registration edit email\n";

// Repetição em deadlock / lock wait timeout.
$pdoError = static function (int $driverCode): PDOException {
    $e = new PDOException('simulado');
    $e->errorInfo = ['40001', $driverCode, 'simulado'];
    return $e;
};
edit_expect(true, bus_registration_edit_is_retryable($pdoError(1213)), 'Deadlock is retryable');
edit_expect(true, bus_registration_edit_is_retryable($pdoError(1205)), 'Lock wait timeout is retryable');
edit_expect(false, bus_registration_edit_is_retryable($pdoError(1062)), 'Duplicate key is not retryable');
edit_expect(false, bus_registration_edit_is_retryable(new PDOException('sem errorInfo')), 'PDOException without errorInfo is not retryable');
edit_expect(false, bus_registration_edit_is_retryable(new RuntimeException('x')), 'Other exceptions are not retryable');
echo "PASS: registration edit retry\n";

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
    mercadopago_order_id VARCHAR(191) NULL, mercadopago_payment_id VARCHAR(191) NULL,
    confirmation_email_sent_at DATETIME NULL, admin_email_sent_at DATETIME NULL,
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
    confirmation_email_sent_at DATETIME NULL,
    FOREIGN KEY (registration_id) REFERENCES bus_registrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
// Trigger bus_registrations_bu da 001 (Seção B), corpo idêntico, numa query só
// sem DELIMITER: prova que as contagens gravadas pela edição passam por ele.
$pdo->exec("CREATE TRIGGER bus_registrations_bu
BEFORE UPDATE ON bus_registrations
FOR EACH ROW
BEGIN
  IF NEW.passenger_count < 1 OR NEW.passenger_count > 100 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: passenger_count deve estar entre 1 e 100';
  END IF;

  IF NEW.children_count < 0 OR NEW.children_count > NEW.passenger_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: children_count nao pode passar de passenger_count (cada crianca vai no colo de um pagante)';
  END IF;

  IF NEW.amount_cents < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: amount_cents nao pode ser negativo';
  END IF;

  IF NEW.status NOT IN ('payment_pending','paid_awaiting_proof','confirmed',
                        'payment_failed','cancelled','refunded') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bus_registrations: status invalido';
  END IF;
END");

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

// ---------------------------------------------------------------------------
// Leituras operacionais ignoram desistentes (frota, chamada, balanceamento).
// ---------------------------------------------------------------------------
bus_boarding_ensure_schema($pdo);
$pdo->exec('CREATE TABLE IF NOT EXISTS bus_settings (
    setting_key VARCHAR(64) PRIMARY KEY, setting_value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
// passenger_count/children_count já refletem só os ativos, como o endpoint gravaria.
$pdo->exec("INSERT INTO bus_registrations
    (id, primary_name, status, bus_number, passenger_count, children_count, paid_at, withdrawn_at, withdrawn_bus_number, withdrawn_fleet_status) VALUES
    ('partial-registration', 'Contato Parcial', 'confirmed', 1, 1, 1, '2026-10-16 10:00:00', NULL, NULL, NULL),
    ('withdrawn-registration', 'Contato Desistente', 'confirmed', NULL, 1, 0, '2026-10-16 11:00:00', '2026-10-16 18:00:00', 1, 'assigned')");
// O trigger da 001 está ativo: contagem zero é recusada.
try {
    $pdo->exec("UPDATE bus_registrations SET passenger_count = 0 WHERE id = 'withdrawn-registration'");
    throw new RuntimeException('Trigger should reject passenger_count = 0');
} catch (PDOException $e) {
    edit_expect('45000', $e->getCode(), 'Trigger rejects passenger_count = 0');
}
$pdo->exec("INSERT INTO bus_passengers
    (registration_id, `position`, full_name, cpf, is_primary, is_child_lap, withdrawn_at) VALUES
    ('partial-registration', 1, 'Desistente Adulto', '11111111111', 0, 0, '2026-10-16 18:00:00'),
    ('partial-registration', 2, 'Ativo Adulto', '22222222222', 1, 0, NULL),
    ('partial-registration', 3, 'Ativo Colo', '33333333333', 0, 1, NULL),
    ('withdrawn-registration', 1, 'Reserva Desistente', '44444444444', 1, 0, '2026-10-16 18:00:00')");
$passengerId = static fn (string $name): string => (string) $pdo->query(
    'SELECT id FROM bus_passengers WHERE full_name = ' . $pdo->quote($name)
)->fetchColumn();

edit_expect(1, bus_fleet_bus_occupancy($pdo, 1), 'Withdrawn passenger frees seat (counts already updated)');
$manifest = bus_boarding_manifest($pdo);
$people = array_column($manifest['people'], 'name');
edit_expect(['Ativo Adulto', 'Ativo Colo'], $people, 'Roll call lists only active passengers');
edit_expect(false, in_array('Desistente Adulto', $people, true), 'Withdrawn passenger leaves roll call');
edit_expect(0, $manifest['waiting'], 'Fully withdrawn registration is not waiting');

$checkin = static fn (string $name): array => [
    'passenger_id' => $passengerId($name), 'leg' => 'outbound', 'present' => true,
    'expected_revision' => 0, 'bus_number' => 1,
];
edit_expect('manifest_changed', bus_boarding_save($pdo, $checkin('Desistente Adulto'))['error'], 'Offline queue for withdrawn person is rejected');
edit_expect('manifest_changed', bus_boarding_save($pdo, $checkin('Reserva Desistente'))['error'], 'Offline queue for fully withdrawn registration is rejected');
edit_expect(200, bus_boarding_save($pdo, $checkin('Ativo Adulto'))['status'], 'Active passenger still checks in');

bus_assign_fleet($pdo, 'withdrawn-registration');
edit_expect(null, $pdo->query("SELECT bus_number FROM bus_registrations WHERE id='withdrawn-registration'")->fetchColumn(), 'Webhook replay does not re-seat a withdrawn registration');
$groupIds = array_column(bus_fleet_load_balance_snapshot($pdo)['groups'], 'id');
edit_expect(false, in_array('withdrawn-registration', $groupIds, true), 'Balance ignores withdrawn registration');
edit_expect(true, in_array('partial-registration', $groupIds, true), 'Balance keeps the partially withdrawn registration');
echo "PASS: withdrawn readers\n";

// ---------------------------------------------------------------------------
// Gravação da edição (bus_registration_edit_apply) com locks e conflitos.
// ---------------------------------------------------------------------------
$pdo->exec('DELETE FROM bus_boarding_checkins');
$pdo->exec('DELETE FROM bus_registration_edits');
$pdo->exec('DELETE FROM bus_passengers');
$pdo->exec('DELETE FROM bus_registrations');
$pdo->exec('DELETE FROM bus_settings');
// Mesmo UNIQUE da produção (001): a troca de CPF entre passageiros precisa passar por ele.
$pdo->exec('ALTER TABLE bus_passengers ADD UNIQUE KEY bus_passengers_registration_cpf_key (registration_id, cpf)');

$mainId = 'aaaaaaaa-0000-4000-8000-000000000001';
$otherId = 'bbbbbbbb-0000-4000-8000-000000000002';
$ghostId = 'cccccccc-0000-4000-8000-000000000003';
$fillerId = 'dddddddd-0000-4000-8000-000000000004';
$pdo->exec("INSERT INTO bus_registrations
    (id, primary_name, primary_cpf, primary_birth_date, email, whatsapp, passenger_count, children_count,
     group_name, status, bus_number, fleet_assignment_status, updated_at) VALUES
    ('$mainId', 'Pessoa Um', '52998224725', '1990-05-20', 'um@example.com', '11987654321', 2, 1,
     'Azul', 'confirmed', 1, 'assigned', '2026-10-16 18:00:00'),
    ('$otherId', 'Outra Pessoa', '39053344705', NULL, 'outra@example.com', '11987654322', 1, 0,
     NULL, 'confirmed', 3, 'assigned', '2026-10-16 18:00:00'),
    ('$ghostId', 'Fica Junto', '10000000019', NULL, 'fica@example.com', '11987654323', 1, 0,
     'Catan', 'confirmed', 3, 'assigned', '2026-10-16 18:00:00')");
$pdo->exec("INSERT INTO bus_passengers
    (registration_id, `position`, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap, withdrawn_at) VALUES
    ('$mainId', 1, 'Pessoa Um', '52998224725', '11987654321', 'um@example.com', 1, 0, 0, NULL),
    ('$mainId', 2, 'Pessoa Dois', '11144477735', '11976543210', 'dois@example.com', 0, 0, 0, NULL),
    ('$mainId', 3, 'Criança Três', '12345678909', NULL, NULL, 0, 1, 1, NULL),
    ('$otherId', 1, 'Outra Pessoa', '39053344705', '11987654322', 'outra@example.com', 1, 0, 0, NULL),
    ('$ghostId', 1, 'Fica Junto', '10000000019', '11987654323', 'fica@example.com', 1, 0, 0, NULL),
    ('$ghostId', 2, 'Desistiu Antes', '10000791989', NULL, NULL, 0, 0, 0, '2026-10-15 12:00:00')");

$mainPassengerId = static fn (int $position): string => (string) $pdo->query(
    "SELECT id FROM bus_passengers WHERE registration_id = '$mainId' AND `position` = $position"
)->fetchColumn();
[$p1, $p2, $p3] = [$mainPassengerId(1), $mainPassengerId(2), $mainPassengerId(3)];

/** Pedido do painel montado do estado atual do banco, como o modal faria. */
$dbRequest = static function (array $overrides = [], ?string $primaryId = null) use ($pdo, $mainId): array {
    $registration = $pdo->query("SELECT group_name, updated_at FROM bus_registrations WHERE id = '$mainId'")->fetch(PDO::FETCH_ASSOC);
    $passengers = [];
    $primary = null;
    foreach ($pdo->query("SELECT * FROM bus_passengers WHERE registration_id = '$mainId' ORDER BY `position`")->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $id = (string) $p['id'];
        if ((int) $p['is_primary'] === 1) $primary = $id;
        $passengers[] = array_merge([
            'id' => $id, 'full_name' => $p['full_name'], 'cpf' => $p['cpf'],
            'whatsapp' => $p['whatsapp'] ?? '', 'email' => $p['email'] ?? '',
            'age_group' => (int) $p['is_child_lap'] === 1 ? 'lap' : ((int) $p['is_minor'] === 1 ? 'minor' : 'adult'),
            'withdrawn' => $p['withdrawn_at'] !== null, 'withdrawal_reason' => $p['withdrawal_reason'] ?? '',
        ], $overrides[$id] ?? []);
    }
    return [
        'registration_id' => $mainId, 'expected_updated_at' => (string) $registration['updated_at'],
        'group_name' => $registration['group_name'], 'primary_passenger_id' => $primaryId ?? $primary,
        'passengers' => $passengers,
    ];
};
/** Mesma sequência do endpoint: BEGIN, apply, COMMIT; rollBack se lançar. */
$apply = static function (array $request) use ($pdo): array {
    $pdo->beginTransaction();
    try {
        $result = bus_registration_edit_apply($pdo, $request, NOW);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
};
$snapshot = static fn (): string => json_encode([
    $pdo->query("SELECT * FROM bus_registrations WHERE id = '$mainId'")->fetch(PDO::FETCH_ASSOC),
    $pdo->query("SELECT * FROM bus_passengers WHERE registration_id = '$mainId' ORDER BY id")->fetchAll(PDO::FETCH_ASSOC),
    $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(),
]);
$mainRow = static fn (): array => $pdo->query("SELECT * FROM bus_registrations WHERE id = '$mainId'")->fetch(PDO::FETCH_ASSOC);
$passengerRow = static fn (string $id): array => $pdo->query("SELECT * FROM bus_passengers WHERE id = $id")->fetch(PDO::FETCH_ASSOC);

// Desistência do adulto 2.
$result = $apply($dbRequest([$p2 => ['withdrawn' => true, 'withdrawal_reason' => 'Mudou de planos']]));
edit_expect([NOW, 'Mudou de planos'], [$passengerRow($p2)['withdrawn_at'], $passengerRow($p2)['withdrawal_reason']], 'Withdrawal stored');
$row = $mainRow();
edit_expect(['1', '1', '1'], [(string) $row['passenger_count'], (string) $row['children_count'], (string) $row['bus_number']], 'Counts recalculated, bus kept');
edit_expect(true, $row['updated_at'] !== '2026-10-16 18:00:00', 'updated_at bumped on save');
edit_expect((string) $row['updated_at'], $result['updated_at'], 'apply returns the new updated_at');
edit_expect([true, 0, 1, 2], [$result['plan']['notify'], $result['waiting'], $result['plan']['seats_after'], $result['plan']['seats_before']], 'apply result');
$log = $pdo->query("SELECT registration_id, edited_at, changes FROM bus_registration_edits")->fetchAll(PDO::FETCH_ASSOC);
edit_expect(1, count($log), 'One edit log row');
edit_expect([$mainId, NOW], [$log[0]['registration_id'], $log[0]['edited_at']], 'Edit log row keys');
edit_expect(true, in_array(['passenger_id' => $p2, 'field' => 'withdrawn', 'before' => false, 'after' => true],
    json_decode($log[0]['changes'], true), true), 'Edit log has the withdrawal');
edit_expect(true, str_contains($log[0]['changes'], '"field":"withdrawn","before":false,"after":true'), 'Edit log JSON shape');

// Reativar com o ônibus 1 cheio (45 de outra reserva + 1 desta) → capacity; nada muda.
$pdo->exec("INSERT INTO bus_registrations (id, primary_name, passenger_count, children_count, status, bus_number)
    VALUES ('$fillerId', 'Enche Ônibus', 45, 0, 'confirmed', 1)");
$before = $snapshot();
edit_expect_error('O Ônibus 1 não tem vagas suficientes (1 livres; são necessárias 2).',
    fn () => $apply($dbRequest([$p2 => ['withdrawn' => false]])), 'capacity');
edit_expect($before, $snapshot(), 'Capacity conflict leaves the database untouched');
$pdo->exec("DELETE FROM bus_registrations WHERE id = '$fillerId'");

// Ônibus travado: aumento de assento bloqueia; edição sem mudar assentos passa.
bus_fleet_save_locked_buses($pdo, [1]);
edit_expect_error('O Ônibus 1 está bloqueado para alterações.',
    fn () => $apply($dbRequest([$p2 => ['withdrawn' => false]])), 'locked');
$apply($dbRequest([$p3 => ['full_name' => 'Criança Três Silva']]));
edit_expect('Criança Três Silva', $passengerRow($p3)['full_name'], 'Seat-neutral edit allowed on locked bus');
bus_fleet_save_locked_buses($pdo, []);

// Reativação com vaga.
$result = $apply($dbRequest([$p2 => ['withdrawn' => false]]));
edit_expect([null, null], [$passengerRow($p2)['withdrawn_at'], $passengerRow($p2)['withdrawal_reason']], 'Passenger reactivated');
edit_expect('2', (string) $mainRow()['passenger_count'], 'Reactivation restores the count');

// CPF ativo em outra reserva bloqueia; CPF de desistente de outra reserva não.
edit_expect_error('Este CPF já está na reserva #BBBBBBBB.',
    fn () => $apply($dbRequest([$p2 => ['cpf' => '390.533.447-05']])), 'cpf_in_use');
$apply($dbRequest([$p2 => ['cpf' => '10000791989']]));
edit_expect('10000791989', $passengerRow($p2)['cpf'], 'CPF of a withdrawn passenger elsewhere is allowed');
// Troca de CPF entre dois passageiros da mesma reserva não esbarra no UNIQUE.
$apply($dbRequest([$p1 => ['cpf' => '10000791989'], $p2 => ['cpf' => '52998224725']]));
edit_expect(['10000791989', '52998224725', '10000791989'],
    [$passengerRow($p1)['cpf'], $passengerRow($p2)['cpf'], $mainRow()['primary_cpf']], 'CPF swap inside the reservation');

// Modal aberto antes do último salvamento → stale.
$old = $dbRequest([$p3 => ['full_name' => 'Criança Três Souza']]);
$old['expected_updated_at'] = '2026-10-16 18:00:00';
edit_expect_error('A reserva mudou desde que você abriu.', fn () => $apply($old), 'stale');

// Reserva inteira desiste e depois volta para o ônibus guardado.
$all = static fn (bool $withdrawn): array => [
    $p1 => ['withdrawn' => $withdrawn], $p2 => ['withdrawn' => $withdrawn], $p3 => ['withdrawn' => $withdrawn],
];
$result = $apply($dbRequest($all(true)));
$row = $mainRow();
edit_expect([NOW, '1', 'assigned', null, '2', '1'],
    [$row['withdrawn_at'], (string) $row['withdrawn_bus_number'], $row['withdrawn_fleet_status'], $row['bus_number'],
        (string) $row['passenger_count'], (string) $row['children_count']], 'Full withdrawal stored');
edit_expect([true, 0], [$result['plan']['fully_withdrawn'], $result['plan']['seats_after']], 'Full withdrawal plan');
edit_expect(0, bus_fleet_bus_occupancy($pdo, 1), 'Fully withdrawn registration frees the bus');
// Nenhum e-mail de confirmação futuro (contato, passageiros, organização).
edit_expect(['ok' => false, 'motivo' => 'desistente'], bus_confirmation_payload($pdo, $mainId),
    'Fully withdrawn registration gets no confirmation e-mail');

$pdo->exec("UPDATE bus_registrations SET status = 'refunded' WHERE id = '$mainId'");
edit_expect_error('Só reservas confirmadas podem voltar para um ônibus.', fn () => $apply($dbRequest($all(false))));
$pdo->exec("UPDATE bus_registrations SET status = 'confirmed' WHERE id = '$mainId'");

$result = $apply($dbRequest($all(false)));
$row = $mainRow();
edit_expect(['1', 'assigned', null, null, null],
    [(string) $row['bus_number'], $row['fleet_assignment_status'], $row['withdrawn_at'], $row['withdrawn_bus_number'], $row['withdrawn_fleet_status']],
    'Reactivated registration returns to its stored bus');
edit_expect(true, $result['plan']['reactivated_registration'], 'Reactivation flagged');
edit_expect(2, bus_fleet_bus_occupancy($pdo, 1), 'Reactivated registration occupies its seats again');
$payload = bus_confirmation_payload($pdo, $mainId);
edit_expect([true, 3], [$payload['ok'], count($payload['passageiros'])], 'Reactivated registration gets confirmation e-mails again');
edit_expect(7, (int) $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(), 'One log row per successful save');

// Salvar sem mudanças: nada é gravado e updated_at fica igual (outro modal aberto não recebe stale).
$before = $snapshot();
$updatedBefore = (string) $mainRow()['updated_at'];
$result = $apply($dbRequest());
edit_expect([], $result['plan']['changes'], 'No-op save has no changes');
edit_expect($updatedBefore, (string) $mainRow()['updated_at'], 'No-op save keeps updated_at');
edit_expect($updatedBefore, $result['updated_at'], 'No-op save returns the current updated_at');
edit_expect($before, $snapshot(), 'No-op save leaves the database untouched');
edit_expect(7, (int) $pdo->query('SELECT COUNT(*) FROM bus_registration_edits')->fetchColumn(), 'No-op save writes no log row');

// CPF provisório da troca cabe em VARCHAR(14) até o maior BIGINT (unsigned).
edit_expect(13, (int) $pdo->query("SELECT LENGTH(CONV('18446744073709551615', 10, 36))")->fetchColumn(), 'Max BIGINT is 13 chars in base 36');
// Ids enormes (fim do teste: depois deles o AUTO_INCREMENT não tem para onde ir).
$bigId = 'eeeeeeee-0000-4000-8000-000000000005';
$pdo->exec("INSERT INTO bus_registrations (id, primary_name, passenger_count, children_count, status, bus_number)
    VALUES ('$bigId', 'Id Grande', 2, 0, 'confirmed', 2)");
$pdo->exec("INSERT INTO bus_passengers (id, registration_id, `position`, full_name, cpf, is_primary) VALUES
    (9223372036854775806, '$bigId', 1, 'Id Grande', '52998224725', 1),
    (9223372036854775807, '$bigId', 2, 'Id Maior', '11144477735', 0)");
$bigRows = [];
foreach ($pdo->query("SELECT * FROM bus_passengers WHERE registration_id = '$bigId'")->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $bigRows[(string) $r['id']] = $r;
}
$swap = static fn (string $id, string $cpf): array => [
    'id' => $id, 'full_name' => $bigRows[$id]['full_name'], 'cpf' => $cpf, 'whatsapp' => null, 'email' => null,
    'is_primary' => (int) $bigRows[$id]['is_primary'], 'is_minor' => 0, 'is_child_lap' => 0,
    'withdrawn_at' => null, 'withdrawal_reason' => null,
];
bus_registration_edit_write_passengers($pdo, $bigId, $bigRows, [
    $swap('9223372036854775806', '11144477735'), $swap('9223372036854775807', '52998224725'),
]);
edit_expect(['11144477735', '52998224725'],
    $pdo->query("SELECT cpf FROM bus_passengers WHERE registration_id = '$bigId' ORDER BY id")->fetchAll(PDO::FETCH_COLUMN),
    'CPF swap works with 19-digit passenger ids');
echo "PASS: registration edit apply\n";
