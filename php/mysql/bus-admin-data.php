<?php

declare(strict_types=1);

/**
 * API do painel da organização: dados agregados das reservas confirmadas.
 *
 * Separado de `bus-manifest.php` (que entrega CSV para download) porque o painel
 * precisa dos dados em JSON já agrupados e com resumo. Mesma proteção por token.
 *
 * Somente leitura. Nenhum endpoint do painel altera reserva: mudar status de
 * pagamento pela interface abriria caminho para confirmar vaga sem lastro.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/receipt-pdf.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';
$tokenRecebido = (string) ($_GET['token'] ?? '');

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || $tokenRecebido === ''
    || !hash_equals($tokenEsperado, $tokenRecebido)
) {
    // 404 em vez de 401: não confirma a existência do painel a quem sonda.
    http_response_code(404);
    echo json_encode(['error' => 'not found']);
    exit;
}

try {
    $pdo = bus_pdo();

    // Todas as reservas, com o status, para o painel mostrar também as pendentes
    // (a organização precisa saber quem começou e não concluiu).
    $q = $pdo->query(
        'SELECT r.id, r.primary_name, r.email, r.whatsapp, r.status, r.status_detail,
                r.passenger_count, r.children_count, r.amount_cents,
                r.mercadopago_order_id, r.confirmation_email_sent_at,
                DATE_FORMAT(CONVERT_TZ(r.created_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS criado_em,
                DATE_FORMAT(CONVERT_TZ(r.paid_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS pago_em
           FROM bus_registrations r
          ORDER BY r.created_at DESC'
    );
    $reservas = $q->fetchAll(PDO::FETCH_ASSOC);

    $qp = $pdo->query(
        'SELECT registration_id, `position`, full_name, whatsapp
           FROM bus_passengers ORDER BY registration_id, `position`'
    );
    $porReserva = [];
    foreach ($qp->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $porReserva[$p['registration_id']][] = [
            'posicao' => (int) $p['position'],
            'nome' => $p['full_name'],
            'whatsapp' => ($p['whatsapp'] ?? '') !== '' ? bus_format_phone((string) $p['whatsapp']) : null,
            'whatsapp_digitos' => $p['whatsapp'] ?? null,
        ];
    }

    $lista = [];
    $resumo = [
        'reservas_confirmadas' => 0,
        'reservas_pendentes' => 0,
        'pagantes' => 0,
        'criancas_no_colo' => 0,
        'total_a_bordo' => 0,
        'receita_centavos' => 0,
        'sem_telefone' => 0,
    ];

    foreach ($reservas as $r) {
        $confirmada = $r['status'] === 'confirmed';
        $passageiros = $porReserva[$r['id']] ?? [];

        if ($confirmada) {
            $resumo['reservas_confirmadas']++;
            $resumo['pagantes'] += (int) $r['passenger_count'];
            $resumo['criancas_no_colo'] += (int) $r['children_count'];
            $resumo['receita_centavos'] += (int) $r['amount_cents'];
            foreach ($passageiros as $p) {
                if ($p['whatsapp'] === null) {
                    $resumo['sem_telefone']++;
                }
            }
        } elseif ($r['status'] === 'payment_pending') {
            $resumo['reservas_pendentes']++;
        }

        $lista[] = [
            'code' => strtoupper(substr((string) $r['id'], 0, 8)),
            'id' => $r['id'],
            'status' => $r['status'],
            'status_detail' => $r['status_detail'],
            'contato' => $r['primary_name'],
            'email' => $r['email'],
            'contato_whatsapp' => bus_format_phone((string) $r['whatsapp']),
            'pagantes' => (int) $r['passenger_count'],
            'criancas' => (int) $r['children_count'],
            'valor' => number_format(((int) $r['amount_cents']) / 100, 2, ',', '.'),
            'valor_centavos' => (int) $r['amount_cents'],
            'criado_em' => $r['criado_em'],
            'pago_em' => $r['pago_em'],
            'order_id' => $r['mercadopago_order_id'],
            'email_enviado' => !empty($r['confirmation_email_sent_at']),
            'passageiros' => $passageiros,
        ];
    }

    $resumo['total_a_bordo'] = $resumo['pagantes'] + $resumo['criancas_no_colo'];
    $resumo['receita'] = number_format($resumo['receita_centavos'] / 100, 2, ',', '.');

    echo json_encode([
        'gerado_em' => gmdate('c'),
        'resumo' => $resumo,
        'reservas' => $lista,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    log_failure('bus-admin-data', $e);
    http_response_code(503);
    echo json_encode(['error' => 'Não foi possível carregar os dados agora.']);
}
