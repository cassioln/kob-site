<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/pending-reconciliation.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$config = bus_config();
if (!bus_check_admin_token($config)) {
    json_response(404, ['error' => 'not found']);
    exit;
}

try {
    $result = bus_reconcile_pending_batch(bus_pdo());
    json_response(200, $result);
} catch (Throwable $error) {
    log_failure('bus-admin-reconcile', $error);
    json_response(503, ['error' => 'Não foi possível sincronizar os pagamentos pendentes.']);
}
