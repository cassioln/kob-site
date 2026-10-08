<?php

declare(strict_types=1);

/**
 * Formulário de contato congelado pelo mantenedor em 08/10/2026.
 * Mantém a rota legada sem coletar, registrar ou encaminhar dados pessoais.
 * A reativação exige uma nova implementação e configuração de atendimento.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
header('Allow: POST, OPTIONS');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

http_response_code(503);
echo json_encode([
    'ok' => false,
    'error' => 'service_disabled',
    'contact_url' => 'https://api.whatsapp.com/send?phone=5513981580498',
], JSON_UNESCAPED_SLASHES);
