<?php

declare(strict_types=1);

/**
 * Regras de negócio do ônibus fretado — Kriativos OnBoard 2026.
 *
 * Espelha server/bus-payment.mjs. O valor cobrado é SEMPRE calculado aqui,
 * nunca aceito do navegador.
 */

const BUS_PRICE_CENTS = 12000;
const BUS_MAX_PASSENGERS = 100;

final class ValidationError extends RuntimeException
{
}

function digits_only(mixed $value): string
{
    return preg_replace('/\D/', '', (string) $value) ?? '';
}

function normalize_text(mixed $value, string $label, int $min = 2, int $max = 160): string
{
    if (!is_string($value)) {
        throw new ValidationError("{$label} é obrigatório.");
    }
    $normalized = preg_replace('/\s+/u', ' ', trim($value)) ?? '';
    $length = mb_strlen($normalized, 'UTF-8');
    if ($length < $min || $length > $max) {
        throw new ValidationError("{$label} inválido.");
    }

    return $normalized;
}

function is_valid_cpf(mixed $value): bool
{
    $cpf = digits_only($value);
    if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 9; $i++) {
        $sum += (int) $cpf[$i] * (10 - $i);
    }
    $remainder = ($sum * 10) % 11;
    if ($remainder === 10) {
        $remainder = 0;
    }
    if ($remainder !== (int) $cpf[9]) {
        return false;
    }

    $sum = 0;
    for ($i = 0; $i < 10; $i++) {
        $sum += (int) $cpf[$i] * (11 - $i);
    }
    $remainder = ($sum * 10) % 11;
    if ($remainder === 10) {
        $remainder = 0;
    }

    return $remainder === (int) $cpf[10];
}

function normalize_cpf(mixed $value, string $subject): string
{
    $cpf = digits_only($value);
    if (!is_valid_cpf($cpf)) {
        throw new ValidationError("CPF inválido para {$subject}.");
    }

    return $cpf;
}

function normalize_email(mixed $value): string
{
    if (!is_string($value)) {
        throw new ValidationError('E-mail é obrigatório.');
    }
    $email = strtolower(trim($value));
    if (mb_strlen($email, 'UTF-8') > 200 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new ValidationError('E-mail inválido.');
    }

    return $email;
}

function normalize_whatsapp(mixed $value): string
{
    $all = digits_only($value);
    $national = $all;
    if (str_starts_with($all, '55') && (strlen($all) === 12 || strlen($all) === 13)) {
        $national = substr($all, 2);
    }
    if (!in_array(strlen($national), [10, 11], true)) {
        throw new ValidationError('WhatsApp inválido.');
    }

    return $national;
}

/**
 * Valida o payload inteiro e devolve dados já normalizados.
 *
 * @return array{contact: array{fullName: string, cpf: string, email: string, whatsapp: string}, passengerCount: int, childrenCount: int, passengers: list<array{position: int, fullName: string, cpf: string}>, amountCents: int}
 */
function validate_bus_payload(mixed $payload): array
{
    if (!is_array($payload)) {
        throw new ValidationError('Cadastro inválido.');
    }
    $contact = $payload['contact'] ?? null;
    if (!is_array($contact)) {
        throw new ValidationError('Contato principal inválido.');
    }

    $rawCount = $payload['passenger_count'] ?? null;
    $rawChildren = $payload['children_count'] ?? 0;
    if (!is_int($rawCount) && !(is_string($rawCount) && ctype_digit($rawCount))) {
        throw new ValidationError('Informe entre 1 e ' . BUS_MAX_PASSENGERS . ' passageiros.');
    }
    if (!is_int($rawChildren) && !(is_string($rawChildren) && ctype_digit($rawChildren))) {
        throw new ValidationError('Quantidade de crianças inválida.');
    }
    $passengerCount = (int) $rawCount;
    $childrenCount = (int) $rawChildren;

    if ($passengerCount < 1 || $passengerCount > BUS_MAX_PASSENGERS) {
        throw new ValidationError('Informe entre 1 e ' . BUS_MAX_PASSENGERS . ' passageiros.');
    }
    // Cada criança viaja no colo de um responsável, então precisa de um pagante
    // para si: crianças <= pagantes (pagantes = total - crianças).
    if ($childrenCount < 0 || $childrenCount > $passengerCount - $childrenCount) {
        throw new ValidationError('Cada criança precisa de um passageiro pagante como responsável.');
    }

    $primaryName = normalize_text($contact['full_name'] ?? null, 'Nome completo do contato principal', 3);
    if (count(explode(' ', $primaryName)) < 2) {
        throw new ValidationError('Informe o nome completo do contato principal.');
    }
    $primaryCpf = normalize_cpf($contact['cpf'] ?? null, 'o contato principal');
    $email = normalize_email($contact['email'] ?? null);
    $whatsapp = normalize_whatsapp($contact['whatsapp'] ?? null);

    $rawPassengers = $payload['passengers'] ?? null;
    if (!is_array($rawPassengers) || count($rawPassengers) !== $passengerCount) {
        throw new ValidationError('Informe os dados de todos os passageiros.');
    }

    $passengers = [];
    $seen = [];
    $position = 0;
    foreach ($rawPassengers as $entry) {
        $position++;
        if (!is_array($entry)) {
            throw new ValidationError("Passageiro {$position} inválido.");
        }
        $fullName = normalize_text($entry['full_name'] ?? null, "Nome completo do passageiro {$position}", 3);
        if (count(explode(' ', $fullName)) < 2) {
            throw new ValidationError("Informe o nome completo do passageiro {$position}.");
        }
        $cpf = normalize_cpf($entry['cpf'] ?? null, "o passageiro {$position}");
        if (isset($seen[$cpf])) {
            throw new ValidationError('Não repita o CPF de um passageiro.');
        }
        $seen[$cpf] = true;
        $passengers[] = ['position' => $position, 'fullName' => $fullName, 'cpf' => $cpf];
    }

    if ($passengers[0]['fullName'] !== $primaryName || $passengers[0]['cpf'] !== $primaryCpf) {
        throw new ValidationError('O passageiro 1 deve ser o contato principal.');
    }

    return [
        'contact' => [
            'fullName' => $primaryName,
            'cpf' => $primaryCpf,
            'email' => $email,
            'whatsapp' => $whatsapp,
        ],
        'passengerCount' => $passengerCount,
        'childrenCount' => $childrenCount,
        'passengers' => $passengers,
        'amountCents' => ($passengerCount - $childrenCount) * BUS_PRICE_CENTS,
    ];
}

function format_amount(int $cents): string
{
    return number_format($cents / 100, 2, '.', '');
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function is_uuid(mixed $value): bool
{
    return is_string($value) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) === 1;
}
