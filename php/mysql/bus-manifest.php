<?php

declare(strict_types=1);

/**
 * Lista de embarque para a organização.
 *
 * Expõe nome, telefone e código de reserva dos passageiros com pagamento
 * confirmado — dado pessoal, então exige o token guardado em bus-secrets.php
 * (fora do document root). Sem token, responde 404 em vez de 401: não confirma
 * a existência do endpoint para quem está sondando.
 *
 * Somente leitura. Formatos: `?format=csv` (padrão, para abrir no Excel) ou
 * `?format=json`.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/receipt-pdf.php';

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';
$tokenRecebido = (string) ($_GET['token'] ?? '');

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || $tokenRecebido === ''
    || !hash_equals($tokenEsperado, $tokenRecebido)
) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'not found']);
    exit;
}

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

try {
    $pdo = bus_pdo();

    // Só reservas pagas: uma lista de embarque com pendentes levaria a organização
    // a contar passageiro que talvez não apareça.
    $q = $pdo->query(
        'SELECT r.id, r.primary_name AS contato, r.email, r.whatsapp AS contato_whatsapp,
                r.passenger_count, r.children_count, r.amount_cents,
                r.mercadopago_order_id,
                DATE_FORMAT(CONVERT_TZ(r.paid_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS pago_em,
                p.`position`, p.full_name AS passageiro, p.whatsapp AS passageiro_whatsapp
           FROM bus_registrations r
           JOIN bus_passengers p ON p.registration_id = r.id
          WHERE r.status = "confirmed"
          ORDER BY r.paid_at, r.id, p.`position`'
    );
    $linhas = $q->fetchAll(PDO::FETCH_ASSOC);

    $formato = ($_GET['format'] ?? 'csv') === 'json' ? 'json' : 'csv';

    if ($formato === 'json') {
        header('Content-Type: application/json; charset=utf-8');

        $grupos = [];
        foreach ($linhas as $l) {
            $code = strtoupper(substr((string) $l['id'], 0, 8));
            if (!isset($grupos[$code])) {
                $grupos[$code] = [
                    'code' => $code,
                    'contato' => $l['contato'],
                    'email' => $l['email'],
                    'contato_whatsapp' => bus_format_phone((string) $l['contato_whatsapp']),
                    'pagantes' => (int) $l['passenger_count'],
                    'criancas' => (int) $l['children_count'],
                    'valor' => number_format(((int) $l['amount_cents']) / 100, 2, ',', '.'),
                    'pago_em' => $l['pago_em'],
                    'passageiros' => [],
                ];
            }
            $grupos[$code]['passageiros'][] = [
                'posicao' => (int) $l['position'],
                'nome' => $l['passageiro'],
                'whatsapp' => ($l['passageiro_whatsapp'] ?? '') !== ''
                    ? bus_format_phone((string) $l['passageiro_whatsapp'])
                    : null,
            ];
        }

        $totalPagantes = array_sum(array_column($grupos, 'pagantes'));
        $totalCriancas = array_sum(array_column($grupos, 'criancas'));

        echo json_encode([
            'gerado_em' => gmdate('c'),
            'resumo' => [
                'reservas' => count($grupos),
                'pagantes' => $totalPagantes,
                'criancas_no_colo' => $totalCriancas,
                'total_a_bordo' => $totalPagantes + $totalCriancas,
            ],
            'reservas' => array_values($grupos),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // CSV: uma linha por passageiro, que é o formato útil na porta do ônibus.
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="lista-embarque-kob2026.csv"');

    $saida = fopen('php://output', 'w');
    // BOM: sem ele o Excel no Windows exibe acentuação quebrada.
    fwrite($saida, "\xEF\xBB\xBF");
    fputcsv($saida, [
        'Reserva', 'Nº', 'Passageiro', 'WhatsApp do passageiro',
        'Contato principal', 'WhatsApp do contato', 'E-mail',
        'Pagantes', 'Crianças (colo)', 'Valor pago', 'Pago em', 'Transação',
    ], ';');

    foreach ($linhas as $l) {
        fputcsv($saida, [
            strtoupper(substr((string) $l['id'], 0, 8)),
            $l['position'],
            $l['passageiro'],
            ($l['passageiro_whatsapp'] ?? '') !== '' ? bus_format_phone((string) $l['passageiro_whatsapp']) : '',
            $l['contato'],
            bus_format_phone((string) $l['contato_whatsapp']),
            $l['email'],
            $l['passenger_count'],
            $l['children_count'],
            'R$ ' . number_format(((int) $l['amount_cents']) / 100, 2, ',', '.'),
            $l['pago_em'],
            $l['mercadopago_order_id'],
        ], ';');
    }
    fclose($saida);
} catch (Throwable $e) {
    log_failure('bus-manifest', $e);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Não foi possível gerar a lista agora.']);
}
