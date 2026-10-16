<?php

declare(strict_types=1);

require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/vip-reservations.php';
require_once __DIR__ . '/group-names.php';
require_once __DIR__ . '/bus-fleet.php';

/**
 * Conflito com o estado atual da reserva; o endpoint responde 409 com o código.
 * Códigos: stale (regra 2), capacity, locked, cpf_in_use (Task 4).
 * ValidationError é final, por isso esta classe estende RuntimeException.
 */
final class RegistrationEditConflict extends RuntimeException
{
    public string $conflictCode;

    public function __construct(string $message, string $conflictCode)
    {
        parent::__construct($message);
        $this->conflictCode = $conflictCode;
    }
}

const BUS_REGISTRATION_EDIT_REASON_MAX = 500;

/**
 * Plano de uma edição de reserva feita no painel: valida o pedido contra o
 * estado atual e devolve exatamente o que gravar. Função pura (sem PDO): o
 * endpoint a chama dentro da transação, depois de travar a reserva.
 *
 * `registration` traz as colunas que a edição controla: grupo, contato do
 * responsável e contagens de ativos em todo salvamento (exceto contagens com a
 * reserva inteira desistente, que o trigger exige >= 1); `primary_birth_date`
 * só quando o responsável muda; ônibus e `withdrawn_*` só ao desistir ou
 * reativar a reserva inteira.
 *
 * @param array $current  ['registration' => row de bus_registrations, 'passengers' => list<row de bus_passengers>]
 * @param array $request  corpo JSON do painel
 * @param list<string> $groupNamesInUse  nomes de grupo usados por OUTRAS reservas
 * @return array{registration: array, passengers: list<array>,
 *   changes: list<array{passenger_id:?string, field:string, before:mixed, after:mixed}>,
 *   seats_before: int, seats_after: int, notify: bool,
 *   fully_withdrawn: bool, reactivated_registration: bool}
 * @throws ValidationError|RegistrationEditConflict mensagem final em PT-BR
 */
function bus_registration_edit_plan(array $current, array $request, array $groupNamesInUse, string $nowUtc): array
{
    $registration = $current['registration'];
    $rows = bus_registration_edit_index_rows($current['passengers']);
    $rawById = bus_registration_edit_match_request($rows, $request['passengers'] ?? null); // regra 1

    if ((string) ($request['expected_updated_at'] ?? '') !== (string) ($registration['updated_at'] ?? '')) { // regra 2
        throw new RegistrationEditConflict(
            'A reserva mudou desde que você abriu. Feche e abra de novo para ver os dados atuais.',
            'stale'
        );
    }

    $after = [];
    $seenCpf = [];
    $position = 0;
    foreach (array_keys($rows) as $id) { // regra 3
        $position++;
        $passenger = bus_registration_edit_normalize_fields($rawById[$id], $position);
        if (isset($seenCpf[$passenger['cpf']])) {
            throw new ValidationError('Não repita o CPF de um passageiro.');
        }
        $seenCpf[$passenger['cpf']] = true;
        $after[$id] = $passenger;
    }
    $canWithdraw = ($registration['status'] ?? '') === 'confirmed';
    foreach ($rows as $id => $row) { // regras 7 e 8
        $after[$id] += bus_registration_edit_normalize_withdrawal($row, $rawById[$id], $canWithdraw, $nowUtc);
    }

    // Regra 9. Chave ausente no pedido mantém o grupo atual; null remove.
    $groupName = bus_registration_edit_group(
        $registration['group_name'] ?? null,
        array_key_exists('group_name', $request) ? $request['group_name'] : ($registration['group_name'] ?? null),
        $groupNamesInUse
    );

    $currentPrimaryId = null;
    foreach ($rows as $id => $row) {
        if ((int) ($row['is_primary'] ?? 0) === 1) {
            $currentPrimaryId = (string) $id;
            break;
        }
    }
    $requestedPrimary = $request['primary_passenger_id'] ?? null;
    $requestedPrimaryId = is_scalar($requestedPrimary) && (string) $requestedPrimary !== ''
        ? (string) $requestedPrimary
        : $currentPrimaryId;

    [$payersAfter, $lapsAfter] = bus_registration_edit_count_active($after);
    $fullyWithdrawn = $payersAfter + $lapsAfter === 0;
    $wasWithdrawn = ($registration['withdrawn_at'] ?? null) !== null;

    if ($fullyWithdrawn) { // regra 10: não pede responsável
        $primaryId = $currentPrimaryId;
    } else {
        if ($lapsAfter > $payersAfter) { // regra 6
            throw new ValidationError('Há mais crianças de colo do que adultos pagantes na viagem. '
                . 'Marque também a desistência da criança ou mantenha um adulto.');
        }
        $primaryId = bus_registration_edit_check_primary($after, $requestedPrimaryId, $currentPrimaryId); // regras 5 e 4
    }

    foreach ($after as $id => $passenger) {
        $after[$id]['is_primary'] = (string) $id === $primaryId ? 1 : 0;
    }

    $columns = ['group_name' => $groupName];
    if ($primaryId !== null) { // regra 12
        $primary = $after[$primaryId];
        $columns['primary_name'] = $primary['full_name'];
        $columns['primary_cpf'] = $primary['cpf'];
        // As colunas da reserva são NOT NULL: só sobrescreve contato preenchido.
        if ($primary['email'] !== null) $columns['email'] = $primary['email'];
        if ($primary['whatsapp'] !== null) $columns['whatsapp'] = $primary['whatsapp'];
        if ($primaryId !== $currentPrimaryId) $columns['primary_birth_date'] = null;
    }

    $reactivated = !$fullyWithdrawn && $wasWithdrawn;
    $columns += bus_registration_edit_fleet_columns($registration, $fullyWithdrawn, $payersAfter, $lapsAfter, $nowUtc);

    // Regra 13: assentos ativos antes e depois.
    $before = [];
    foreach ($rows as $id => $row) {
        $before[$id] = [
            'age_group' => bus_registration_edit_age_group($row),
            'withdrawn' => ($row['withdrawn_at'] ?? null) !== null,
        ];
    }
    [$payersBefore, $lapsBefore] = bus_registration_edit_count_active($before);
    $seatsBefore = $wasWithdrawn ? 0 : bus_fleet_seat_count($payersBefore, $lapsBefore);
    $seatsAfter = $fullyWithdrawn ? 0 : bus_fleet_seat_count($payersAfter, $lapsAfter);

    // Regra 14.
    $changes = bus_registration_edit_diff($rows, $after);
    if ($primaryId !== $currentPrimaryId) {
        $changes[] = ['passenger_id' => null, 'field' => 'primary', 'before' => $currentPrimaryId, 'after' => $primaryId];
    }
    $currentGroup = bus_registration_edit_nullable_string($registration['group_name'] ?? null);
    if ($groupName !== $currentGroup) {
        $changes[] = ['passenger_id' => null, 'field' => 'group_name', 'before' => $currentGroup, 'after' => $groupName];
    }
    $notify = (bool) array_filter(
        $changes,
        static fn (array $change): bool => in_array($change['field'], ['withdrawn', 'primary'], true)
    );

    $passengers = [];
    foreach ($after as $id => $passenger) {
        $passengers[] = [
            'id' => (string) $id,
            'full_name' => $passenger['full_name'],
            'cpf' => $passenger['cpf'],
            'whatsapp' => $passenger['whatsapp'],
            'email' => $passenger['email'],
            'is_primary' => $passenger['is_primary'],
            'is_minor' => $passenger['age_group'] === 'adult' ? 0 : 1,
            'is_child_lap' => $passenger['age_group'] === 'lap' ? 1 : 0,
            'withdrawn_at' => $passenger['withdrawn_at'],
            'withdrawal_reason' => $passenger['withdrawal_reason'],
        ];
    }

    return [
        'registration' => $columns,
        'passengers' => $passengers,
        'changes' => $changes,
        'seats_before' => $seatsBefore,
        'seats_after' => $seatsAfter,
        'notify' => $notify,
        'fully_withdrawn' => $fullyWithdrawn,
        'reactivated_registration' => $reactivated,
    ];
}

/**
 * Linhas de bus_passengers por id, na ordem recebida. Chaves numéricas viram
 * int no PHP: quem precisa do id como texto faz (string) $id.
 *
 * @return array<int|string, array>
 */
function bus_registration_edit_index_rows(array $rows): array
{
    $indexed = [];
    foreach ($rows as $row) {
        $indexed[(string) $row['id']] = $row;
    }
    return $indexed;
}

/** Regra 1: o pedido traz exatamente os passageiros da reserva. @return array<string, array> */
function bus_registration_edit_match_request(array $rows, mixed $rawPassengers): array
{
    $mismatch = new ValidationError('Os passageiros enviados não conferem com a reserva.');
    if (!is_array($rawPassengers) || count($rawPassengers) !== count($rows)) {
        throw $mismatch;
    }
    $byId = [];
    foreach ($rawPassengers as $raw) {
        $id = is_array($raw) && is_scalar($raw['id'] ?? null) ? (string) $raw['id'] : null;
        if ($id === null || !isset($rows[$id]) || isset($byId[$id])) {
            throw $mismatch;
        }
        $byId[$id] = $raw;
    }
    return $byId;
}

/** Regras 10, 11 e contagens da regra 12: ônibus, desistência da reserva e contagens de ativos. */
function bus_registration_edit_fleet_columns(array $registration, bool $fullyWithdrawn, int $payers, int $laps, string $nowUtc): array
{
    $wasWithdrawn = ($registration['withdrawn_at'] ?? null) !== null;
    if ($fullyWithdrawn) {
        if ($wasWithdrawn) return []; // já desistente: preserva o ônibus guardado
        $busNumber = $registration['bus_number'] ?? null;
        // Contagens ficam como estão: o trigger exige passenger_count >= 1.
        return [
            'withdrawn_at' => $nowUtc,
            'withdrawn_bus_number' => $busNumber === null ? null : (int) $busNumber,
            'withdrawn_fleet_status' => $registration['fleet_assignment_status'] ?? 'assigned',
            'bus_number' => null,
        ];
    }
    $columns = ['passenger_count' => $payers, 'children_count' => $laps];
    if ($wasWithdrawn) {
        $storedBus = $registration['withdrawn_bus_number'] ?? null;
        $columns += [
            'bus_number' => $storedBus === null ? null : (int) $storedBus,
            'fleet_assignment_status' => $registration['withdrawn_fleet_status'] ?? 'assigned',
            'withdrawn_at' => null,
            'withdrawn_bus_number' => null,
            'withdrawn_fleet_status' => null,
        ];
    }
    return $columns;
}

/** 'adult' | 'minor' | 'lap' a partir das flags gravadas. */
function bus_registration_edit_age_group(array $row): string
{
    if ((int) ($row['is_child_lap'] ?? 0) === 1) return 'lap';
    return (int) ($row['is_minor'] ?? 0) === 1 ? 'minor' : 'adult';
}

/** Regra 3 para um passageiro: nome, CPF, contato opcional e faixa etária. */
function bus_registration_edit_normalize_fields(array $raw, int $position): array
{
    $fullName = normalize_person_name($raw['full_name'] ?? null, "Nome do passageiro {$position}", 3, 255);
    if (count(preg_split('/\s+/u', $fullName, -1, PREG_SPLIT_NO_EMPTY) ?: []) < 2) {
        throw new ValidationError("Informe o nome completo do passageiro {$position}.");
    }
    $cpf = normalize_cpf($raw['cpf'] ?? null, "o passageiro {$position}");
    try {
        $whatsapp = vip_optional_whatsapp($raw['whatsapp'] ?? null);
    } catch (ValidationError) {
        throw new ValidationError("WhatsApp do passageiro {$position} inválido.");
    }
    try {
        $email = vip_optional_email($raw['email'] ?? null);
    } catch (ValidationError) {
        throw new ValidationError("E-mail do passageiro {$position} inválido.");
    }
    $ageGroup = $raw['age_group'] ?? null;
    if (!in_array($ageGroup, ['adult', 'minor', 'lap'], true)) {
        throw new ValidationError("Faixa etária inválida para o passageiro {$position}.");
    }

    return [
        'full_name' => $fullName,
        'cpf' => $cpf,
        'whatsapp' => $whatsapp === '' ? null : $whatsapp,
        'email' => $email === '' ? null : $email,
        'age_group' => $ageGroup,
    ];
}

/**
 * Regras 7 e 8 para um passageiro. Quem já estava desistente continua editável
 * mesmo se o status de pagamento mudou depois (estorno): a regra 7 barra só
 * desistências novas.
 */
function bus_registration_edit_normalize_withdrawal(array $row, array $raw, bool $canWithdraw, string $nowUtc): array
{
    $wasWithdrawn = ($row['withdrawn_at'] ?? null) !== null;
    $withdrawn = in_array($raw['withdrawn'] ?? false, [true, 1, '1', 'true'], true);
    if ($withdrawn && !$wasWithdrawn && !$canWithdraw) {
        throw new ValidationError('Só reservas confirmadas podem registrar desistência.');
    }
    if (!$withdrawn) {
        return ['withdrawn' => false, 'withdrawn_at' => null, 'withdrawal_reason' => null];
    }

    $reason = is_string($raw['withdrawal_reason'] ?? null) ? trim($raw['withdrawal_reason']) : '';
    if (mb_strlen($reason, 'UTF-8') > BUS_REGISTRATION_EDIT_REASON_MAX) {
        throw new ValidationError('O motivo da desistência pode ter no máximo '
            . BUS_REGISTRATION_EDIT_REASON_MAX . ' caracteres.');
    }
    return [
        'withdrawn' => true,
        // Novo salvamento não muda a data da desistência.
        'withdrawn_at' => $wasWithdrawn ? (string) $row['withdrawn_at'] : $nowUtc,
        'withdrawal_reason' => $reason === '' ? null : $reason,
    ];
}

/** Regra 9: null, o grupo atual ou um nome livre do catálogo. */
function bus_registration_edit_group(mixed $currentGroup, mixed $requested, array $groupNamesInUse): ?string
{
    $current = bus_registration_edit_nullable_string($currentGroup);
    $name = is_string($requested) ? trim($requested) : null;
    if ($name === null || $name === '') return null;
    if ($name === $current) return $name;
    if (!in_array($name, bus_catalogo_grupos(), true) || in_array($name, $groupNamesInUse, true)) {
        throw new ValidationError('Escolha um nome de grupo disponível.');
    }
    return $name;
}

/** Regras 5 e 4. Retorna o id do responsável. */
function bus_registration_edit_check_primary(array $after, ?string $requestedId, ?string $currentId): string
{
    if ($requestedId !== null && $requestedId === $currentId && ($after[$currentId]['withdrawn'] ?? false)) {
        throw new ValidationError('Escolha o novo responsável da reserva.');
    }
    $primary = $requestedId === null ? null : ($after[$requestedId] ?? null);
    if ($primary === null || $primary['withdrawn'] || $primary['age_group'] !== 'adult') {
        throw new ValidationError('O responsável precisa ser um adulto (18+) que continua na viagem.');
    }
    if ($primary['whatsapp'] === null || $primary['email'] === null) {
        throw new ValidationError('Informe WhatsApp e e-mail do responsável.');
    }
    return $requestedId;
}

/** @return array{0:int, 1:int} [pagantes ativos (adult+minor), colo ativos] */
function bus_registration_edit_count_active(array $passengers): array
{
    $payers = 0;
    $laps = 0;
    foreach ($passengers as $passenger) {
        if ($passenger['withdrawn']) continue;
        if ($passenger['age_group'] === 'lap') {
            $laps++;
        } else {
            $payers++;
        }
    }
    return [$payers, $laps];
}

/** Regra 14: uma entrada por campo alterado de cada passageiro. */
function bus_registration_edit_diff(array $rows, array $after): array
{
    $changes = [];
    foreach ($rows as $id => $row) {
        $before = [
            'full_name' => (string) ($row['full_name'] ?? ''),
            'cpf' => (string) ($row['cpf'] ?? ''),
            'whatsapp' => bus_registration_edit_nullable_string($row['whatsapp'] ?? null),
            'email' => bus_registration_edit_nullable_string($row['email'] ?? null),
            'age_group' => bus_registration_edit_age_group($row),
            'withdrawn' => ($row['withdrawn_at'] ?? null) !== null,
            'withdrawal_reason' => bus_registration_edit_nullable_string($row['withdrawal_reason'] ?? null),
        ];
        foreach ($before as $field => $value) {
            if ($value !== $after[$id][$field]) {
                $changes[] = ['passenger_id' => (string) $id, 'field' => $field, 'before' => $value, 'after' => $after[$id][$field]];
            }
        }
    }
    return $changes;
}

function bus_registration_edit_nullable_string(mixed $value): ?string
{
    return $value === null || (string) $value === '' ? null : (string) $value;
}
