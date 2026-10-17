<?php

declare(strict_types=1);

/**
 * Nomes de grupo para o modal de edição: catálogo dividido entre livres e em uso.
 * O nome atual da própria reserva aparece em `em_uso`; o modal o oferece à parte.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/group-names.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
if (!bus_check_admin_token($config)) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

try {
    $inUse = bus_nomes_em_uso(bus_pdo());
    json_response(200, [
        'livres' => array_values(array_diff(bus_catalogo_grupos(), $inUse)),
        'em_uso' => array_values($inUse),
    ]);
} catch (Throwable $e) {
    log_failure('bus-group-names', $e);
    json_response(500, ['error' => 'Não foi possível carregar os nomes de grupo.']);
}
