<?php

// TEMPORÁRIO — le o log de diagnóstico do webhook.
// Existe apenas enquanto validamos a simulação do painel do Mercado Pago.
// Não expõe segredo: o log guarda só metadados (presença de headers, motivo).

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

if (($_GET['probe'] ?? '') !== 'kob-2026-diagnostico') {
    http_response_code(404);
    echo json_encode(['error' => 'not found']);
    exit;
}

$caminho = sys_get_temp_dir() . '/kob-webhook.log';

if (isset($_GET['limpar'])) {
    @unlink($caminho);
    echo json_encode(['limpo' => true]);
    exit;
}

$conteudo = is_readable($caminho) ? (string) file_get_contents($caminho) : '';
$linhas = $conteudo === '' ? [] : array_values(array_filter(explode("\n", trim($conteudo))));

echo json_encode([
    'total' => count($linhas),
    'registros' => array_map(
        static fn(string $l): mixed => json_decode($l, true) ?? $l,
        array_slice($linhas, -25)
    ),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
