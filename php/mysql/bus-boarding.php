<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/bus-boarding.php';

header('X-Robots-Tag: noindex, nofollow');

try {
    if (!bus_check_admin_token(bus_config())) {
        json_response(404, ['error' => 'not_found']);
        exit;
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        json_response(405, ['error' => 'method_not_allowed']);
        exit;
    }
    // Validate before connecting or creating the additive table.
    $body = $method === 'POST' ? bus_boarding_validate(read_json_body()) : null;
    $pdo = bus_pdo();
    bus_boarding_ensure_schema($pdo);
    if ($method === 'GET') {
        json_response(200, bus_boarding_manifest($pdo));
    } else {
        $result = bus_boarding_save($pdo, $body);
        $status = $result['status'];
        unset($result['status']);
        json_response($status, $result);
    }
} catch (ValidationError $e) {
    json_response(400, ['error' => 'invalid_checkin']);
} catch (Throwable $e) {
    log_failure('bus-boarding', $e);
    json_response(503, ['error' => 'boarding_unavailable']);
}
