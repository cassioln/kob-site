<?php

declare(strict_types=1);

require_once __DIR__ . '/validation.php';

function vip_optional_email(mixed $value): string
{
    if ($value === null || (is_string($value) && trim($value) === '')) {
        return '';
    }
    return normalize_email($value);
}

function vip_optional_whatsapp(mixed $value): string
{
    if ($value === null || (is_string($value) && digits_only($value) === '')) {
        return '';
    }
    return normalize_whatsapp($value);
}

function vip_normalize_bus_number(mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
        throw new ValidationError('Selecione um ônibus válido.');
    }
    $number = (int) $value;
    if ($number < 1 || $number > 99) {
        throw new ValidationError('Selecione um ônibus válido.');
    }
    return $number;
}

/**
 * @return array{full_name:string, cpf:string, whatsapp:string, email:string, bus_number:?int}
 */
function vip_normalize_entry(mixed $raw, int $position): array
{
    if (!is_array($raw)) {
        throw new ValidationError("VIP {$position} inválido.");
    }

    $fullName = normalize_person_name($raw['full_name'] ?? $raw['name'] ?? null, "Nome do VIP {$position}", 3, 255);
    if (count(preg_split('/\s+/u', $fullName, -1, PREG_SPLIT_NO_EMPTY) ?: []) < 2) {
        throw new ValidationError("Informe o nome completo do VIP {$position}.");
    }

    return [
        'full_name' => $fullName,
        'cpf' => normalize_cpf($raw['cpf'] ?? null, "o VIP {$position}"),
        'whatsapp' => vip_optional_whatsapp($raw['whatsapp'] ?? null),
        'email' => vip_optional_email($raw['email'] ?? null),
        'bus_number' => vip_normalize_bus_number($raw['bus_number'] ?? null),
    ];
}

/**
 * @return list<array{full_name:string, cpf:string, whatsapp:string, email:string, bus_number:?int}>
 */
function vip_normalize_batch(mixed $raw): array
{
    if (!is_array($raw) || count($raw) < 1 || count($raw) > 50) {
        throw new ValidationError('Adicione entre 1 e 50 reservas VIP.');
    }

    $normalized = [];
    $seen = [];
    foreach (array_values($raw) as $index => $entry) {
        $vip = vip_normalize_entry($entry, $index + 1);
        if (isset($seen[$vip['cpf']])) {
            throw new ValidationError('Não repita o CPF entre as reservas VIP.');
        }
        $seen[$vip['cpf']] = true;
        $normalized[] = $vip;
    }

    return $normalized;
}
