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

/**
 * Canonicalizes a person's name for persistence and transactional messages.
 * The public forms may present the value in uppercase, but the stored value
 * follows the human-readable title-case format used by the panel and e-mails.
 */
function normalize_person_name(mixed $value, string $label, int $min = 2, int $max = 160): string
{
    $normalized = normalize_text($value, $label, $min, $max);
    $lower = mb_strtolower($normalized, 'UTF-8');
    $tokens = explode(' ', $lower);
    $connectors = ['de' => true, 'da' => true, 'do' => true, 'das' => true, 'dos' => true, 'e' => true];

    foreach ($tokens as $index => $token) {
        if ($index > 0 && isset($connectors[$token])) {
            continue;
        }

        $parts = preg_split('/([\-\'])/u', $token, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$token];
        foreach ($parts as $partIndex => $part) {
            if ($part === '-' || $part === "'") {
                continue;
            }
            $parts[$partIndex] = mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8')
                . mb_substr($part, 1, null, 'UTF-8');
        }
        $tokens[$index] = implode('', $parts);
    }

    return implode(' ', $tokens);
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

function is_valid_brazilian_phone_digits(string $national): bool
{
    static $ddds = [
        '11', '12', '13', '14', '15', '16', '17', '18', '19',
        '21', '22', '24', '27', '28',
        '31', '32', '33', '34', '35', '37', '38',
        '41', '42', '43', '44', '45', '46', '47', '48', '49',
        '51', '53', '54', '55',
        '61', '62', '63', '64', '65', '66', '67', '68', '69',
        '71', '73', '74', '75', '77', '79',
        '81', '82', '83', '84', '85', '86', '87', '88', '89',
        '91', '92', '93', '94', '95', '96', '97', '98', '99',
    ];

    if (!preg_match('/^\d+$/', $national) || !in_array(substr($national, 0, 2), $ddds, true)) {
        return false;
    }

    $subscriber = substr($national, 2);
    if (preg_match('/^(\d)\1+$/', $subscriber)) {
        return false;
    }

    if (strlen($national) === 10) {
        return preg_match('/^[2-59]\d{7}$/', $subscriber) === 1;
    }

    if (strlen($national) === 11) {
        return preg_match('/^9\d{8}$/', $subscriber) === 1;
    }

    return false;
}

function normalize_whatsapp(mixed $value): string
{
    $all = digits_only($value);
    $national = str_starts_with($all, '55') && in_array(strlen($all), [12, 13], true)
        ? substr($all, 2)
        : $all;
    if (!is_valid_brazilian_phone_digits($national)) {
        throw new ValidationError('WhatsApp inválido. Informe um número brasileiro com DDD.');
    }

    return $national;
}

function normalize_birth_date(mixed $value, string $label = 'Data de nascimento do contato principal'): string
{
    if (!is_string($value) || trim($value) === '') {
        throw new ValidationError("{$label} é obrigatória.");
    }
    $raw = trim($value);
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $raw, $matches)) {
        $day = (int) $matches[1];
        $month = (int) $matches[2];
        $year = (int) $matches[3];
    } elseif (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $matches)) {
        $year = (int) $matches[1];
        $month = (int) $matches[2];
        $day = (int) $matches[3];
    } else {
        throw new ValidationError("{$label} inválida.");
    }

    if (!checkdate($month, $day, $year) || $year < 1900 || $year > (int) date('Y')) {
        throw new ValidationError("{$label} inválida.");
    }

    $birth = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, $day));
    $today = new DateTimeImmutable('today');
    $age = $birth->diff($today)->y;

    if ($age < 18) {
        throw new ValidationError('O contato principal / responsável financeiro deve ter 18 anos ou mais.');
    }

    return $birth->format('Y-m-d');
}

/**
 * Valida o payload inteiro e devolve dados já normalizados.
 *
 * @return array{contact: array{fullName: string, cpf: string, birthDate: string, email: string, whatsapp: string, isMinor: bool}, passengerCount: int, childrenCount: int, adultCount: int, passengers: list<array{position: int, fullName: string, cpf: string, whatsapp: ?string, email: ?string, isMinor: bool}>, children: list<array{position: int, fullName: string, cpf: string}>, amountCents: int}
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
    // Crianças de até 5 anos são ADICIONAIS e não pagam: viajam no colo de um
    // pagante, então cada uma precisa de um colo: crianças <= pagantes.
    if ($childrenCount < 0 || $childrenCount > $passengerCount) {
        throw new ValidationError('As crianças de até 5 anos não podem passar do número de passageiros pagantes.');
    }

    $primaryName = normalize_person_name($contact['full_name'] ?? null, 'Nome completo do contato principal', 3);
    if (count(explode(' ', $primaryName)) < 2) {
        throw new ValidationError('Informe o nome completo do contato principal.');
    }
    $primaryCpf = normalize_cpf($contact['cpf'] ?? null, 'o contato principal');
    $primaryBirthDate = normalize_birth_date(
        $contact['birth_date'] ?? $contact['primary_birth_date'] ?? $payload['birth_date'] ?? $payload['primary_birth_date'] ?? null
    );
    $email = normalize_email($contact['email'] ?? null);
    $whatsapp = normalize_whatsapp($contact['whatsapp'] ?? null);

    $rawPassengers = $payload['passengers'] ?? null;
    if (!is_array($rawPassengers) || count($rawPassengers) !== $passengerCount) {
        throw new ValidationError('Informe os dados de todos os passageiros.');
    }

    $passengers = [];
    $seen = [];
    $position = 0;
    $adultCount = 0;

    foreach ($rawPassengers as $entry) {
        $position++;
        if (!is_array($entry)) {
            throw new ValidationError("Passageiro {$position} inválido.");
        }
        $fullName = normalize_person_name($entry['full_name'] ?? null, "Nome completo do passageiro {$position}", 3);
        if (count(explode(' ', $fullName)) < 2) {
            throw new ValidationError("Informe o nome completo do passageiro {$position}.");
        }
        $cpf = normalize_cpf($entry['cpf'] ?? null, "o passageiro {$position}");
        if (isset($seen[$cpf])) {
            throw new ValidationError('Não repita o CPF de um passageiro.');
        }
        $seen[$cpf] = true;

        // Faixa etária do pagante: o contato principal é sempre maior de 18 anos (comprovado pela data de nascimento).
        // Demais passageiros: 6 a 17 anos (is_minor = true) vs 18+ anos (is_minor = false).
        // Pagantes de 6 a 17 anos NÃO podem levar criança de colo.
        $isMinor = ($position === 1)
            ? false
            : (!empty($entry['is_minor'])
                || ($entry['age_group'] ?? '') === 'minor'
                || ($entry['age_group'] ?? '') === 'youth'
                || ($entry['age_group'] ?? '') === '6_to_17');

        if (!$isMinor) {
            $adultCount++;
        }

        // WhatsApp do passageiro é OPCIONAL: serve para a organização falar
        // direto com quem embarca, quando a pessoa quiser informar. Vazio passa
        // como null; preenchido é validado com o mesmo rigor do contato
        // principal — aceitar um número malformado seria pior que não ter número.
        $rawWhatsapp = $entry['whatsapp'] ?? null;
        $whatsappPassenger = null;
        if (is_string($rawWhatsapp) && digits_only($rawWhatsapp) !== '') {
            try {
                $whatsappPassenger = normalize_whatsapp($rawWhatsapp);
            } catch (ValidationError) {
                throw new ValidationError("WhatsApp do passageiro {$position} inválido.");
            }
        }

        // E-mail do passageiro é OPCIONAL: só o contato principal é obrigado a
        // informar. Quem informa recebe confirmação própria (sem QR Code nem
        // código de pagamento, que vão apenas para quem pagou). Vazio vira null;
        // preenchido é validado, porque guardar e-mail malformado faria o envio
        // falhar depois, longe de onde o erro foi cometido.
        $rawEmailPassenger = $entry['email'] ?? null;
        $emailPassenger = null;
        if (is_string($rawEmailPassenger) && trim($rawEmailPassenger) !== '') {
            $candidato = trim($rawEmailPassenger);
            if (!filter_var($candidato, FILTER_VALIDATE_EMAIL) || mb_strlen($candidato) > 255) {
                throw new ValidationError("E-mail do passageiro {$position} inválido.");
            }
            $emailPassenger = mb_strtolower($candidato);
        }

        $passengers[] = [
            'position' => $position,
            'fullName' => $fullName,
            'cpf' => $cpf,
            'whatsapp' => $whatsappPassenger,
            'email' => $emailPassenger,
            'isMinor' => $isMinor,
        ];
    }

    if ($passengers[0]['fullName'] !== $primaryName || $passengers[0]['cpf'] !== $primaryCpf) {
        throw new ValidationError('O passageiro 1 deve ser o contato principal.');
    }

    // Regra de crianças de colo (0 a 5 anos):
    // Crianças viajam no colo de um pagante de 18 anos ou mais. Pagantes de 6 a 17 anos
    // não podem levar criança no colo. Logo, crianças <= adultos pagantes.
    if ($childrenCount > 0) {
        if ($adultCount === 0) {
            throw new ValidationError('Crianças de colo só podem viajar acompanhadas por um pagante de 18 anos ou mais.');
        }
        if ($childrenCount > $adultCount) {
            throw new ValidationError('As crianças de até 5 anos não podem passar do número de pagantes maiores de 18 anos.');
        }
    }

    // Validação dos dados obrigatórios das crianças de colo (nome completo e CPF).
    $rawChildrenList = $payload['children'] ?? [];
    if (!is_array($rawChildrenList) || count($rawChildrenList) !== $childrenCount) {
        throw new ValidationError('Informe os dados de todas as crianças de colo.');
    }

    $children = [];
    $childPos = $passengerCount;
    foreach ($rawChildrenList as $entry) {
        $childPos++;
        if (!is_array($entry)) {
            throw new ValidationError("Criança {$childPos} inválida.");
        }
        $childName = normalize_person_name($entry['full_name'] ?? null, "Nome completo da criança", 3);
        if (count(explode(' ', $childName)) < 2) {
            throw new ValidationError("Informe o nome completo da criança.");
        }
        $childCpf = normalize_cpf($entry['cpf'] ?? null, "a criança");
        if (isset($seen[$childCpf])) {
            throw new ValidationError('Não repita o CPF de um passageiro ou criança.');
        }
        $seen[$childCpf] = true;

        $children[] = [
            'position' => $childPos,
            'fullName' => $childName,
            'cpf' => $childCpf,
            'isMinor' => true,
            'isChildLap' => true,
        ];
    }

    return [
        'contact' => [
            'fullName' => $primaryName,
            'cpf' => $primaryCpf,
            'birthDate' => $primaryBirthDate,
            'email' => $email,
            'whatsapp' => $whatsapp,
            'isMinor' => false,
        ],
        'passengerCount' => $passengerCount,
        'childrenCount' => $childrenCount,
        'adultCount' => $adultCount,
        'passengers' => $passengers,
        'children' => $children,
        // Crianças de até 5 anos são adicionais e NÃO pagam: o valor cobre
        // exatamente o grupo informado em passenger_count.
        'amountCents' => $passengerCount * BUS_PRICE_CENTS,
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
