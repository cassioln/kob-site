<?php

declare(strict_types=1);

/**
 * Normaliza nomes e e-mails já gravados no banco MySQL.
 *
 * Uso controlado, somente via CLI:
 *   php php/db/008_normalize_contact_data.php
 *
 * A migração não toca em CPF, telefones, ônibus, status, grupos ou valores.
 * Toda a operação acontece em uma única transação para que uma falha não
 * deixe somente parte dos contatos atualizada.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/mysql/lib/db.php';

function normalize_existing_email(mixed $value): mixed
{
    if ($value === null || trim((string) $value) === '') {
        return $value;
    }

    return normalize_email((string) $value);
}

function migration_same(mixed $left, mixed $right): bool
{
    return $left === $right;
}

$pdo = null;

try {
    $pdo = bus_pdo();
    $pdo->beginTransaction();

    $registrationRows = $pdo->query(
        'SELECT id, primary_name, email FROM bus_registrations'
    )->fetchAll(PDO::FETCH_ASSOC);
    $passengerRows = $pdo->query(
        'SELECT id, full_name, email FROM bus_passengers'
    )->fetchAll(PDO::FETCH_ASSOC);

    $updateRegistration = $pdo->prepare(
        'UPDATE bus_registrations
            SET primary_name = ?, email = ?, updated_at = UTC_TIMESTAMP()
          WHERE id = ?'
    );
    $updatePassenger = $pdo->prepare(
        'UPDATE bus_passengers
            SET full_name = ?, email = ?
          WHERE id = ?'
    );

    $registrationNames = 0;
    $registrationEmails = 0;
    foreach ($registrationRows as $row) {
        $name = normalize_person_name((string) $row['primary_name'], 'Nome principal', 3, 255);
        $email = normalize_existing_email($row['email']);
        if (!migration_same($name, $row['primary_name'])) {
            $registrationNames++;
        }
        if (!migration_same($email, $row['email'])) {
            $registrationEmails++;
        }
        if (!migration_same($name, $row['primary_name']) || !migration_same($email, $row['email'])) {
            $updateRegistration->execute([$name, $email, $row['id']]);
        }
    }

    $passengerNames = 0;
    $passengerEmails = 0;
    foreach ($passengerRows as $row) {
        $name = normalize_person_name((string) $row['full_name'], 'Nome do passageiro', 3, 255);
        $email = normalize_existing_email($row['email']);
        if (!migration_same($name, $row['full_name'])) {
            $passengerNames++;
        }
        if (!migration_same($email, $row['email'])) {
            $passengerEmails++;
        }
        if (!migration_same($name, $row['full_name']) || !migration_same($email, $row['email'])) {
            $updatePassenger->execute([$name, $email, $row['id']]);
        }
    }

    $pdo->commit();

    echo "Migração concluída com sucesso.\n";
    echo 'bus_registrations: ' . $registrationNames . ' nome(s), ' . $registrationEmails . " e-mail(s) atualizado(s).\n";
    echo 'bus_passengers: ' . $passengerNames . ' nome(s), ' . $passengerEmails . " e-mail(s) atualizado(s).\n";
    echo "Telefones alterados: 0.\n";
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Migração revertida: ' . $error->getMessage() . "\n");
    exit(1);
}
