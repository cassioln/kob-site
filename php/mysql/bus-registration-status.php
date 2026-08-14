<?php

declare(strict_types=1);

// validation.php é agnóstica de banco: reaproveitamos a lib existente.
require dirname(__DIR__) . '/lib/validation.php';
require __DIR__ . '/lib/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

try {
    $id = $_GET['id'] ?? null;
    if (!is_uuid($id)) {
        json_response(400, ['error' => 'Cadastro inválido.']);
        exit;
    }

    $pdo = bus_pdo();
    $query = $pdo->prepare('SELECT status, status_detail FROM bus_registrations WHERE id = :id LIMIT 1');
    $query->execute([':id' => $id]);
    $registration = $query->fetch();

    if (!$registration) {
        json_response(404, ['error' => 'Cadastro não encontrado.']);
        exit;
    }

    // Só o estado operacional. Nunca CPF, nome, e-mail ou WhatsApp.
    json_response(200, [
        'status' => $registration['status'],
        'statusDetail' => $registration['status_detail'] ?: null,
    ]);
} catch (Throwable $error) {
    log_failure('bus-registration-status', $error);
    json_response(503, ['error' => 'Consulta temporariamente indisponível.']);
}
