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
        $manifest = bus_boarding_manifest($pdo);
        $format = $_GET['format'] ?? '';
        if (in_array($format, ['pdf', 'xlsx'], true)) {
            $lang = $_GET['lang'] ?? 'pt';
            if (!is_string($lang) || !in_array($lang, ['pt', 'en', 'es'], true)) {
                json_response(400, ['error' => 'invalid_export']);
                exit;
            }
            require_once dirname(__DIR__) . '/lib/boarding-rollcall-xlsx.php';
            $file = $format === 'xlsx' ? bus_rollcall_xlsx($manifest, $lang) : bus_rollcall_pdf($manifest, $lang);
            header('Cache-Control: no-store');
            header('Content-Type: ' . ($format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'));
            header('Content-Disposition: attachment; filename="chamada-embarque-kob2026.' . $format . '"');
            header('Content-Length: ' . strlen($file));
            echo $file;
        } else {
            json_response(200, $manifest);
        }
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
