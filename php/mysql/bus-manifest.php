<?php

declare(strict_types=1);

/**
 * Lista de embarque em PDF para a organização.
 *
 * Expõe nome, CPF e telefone dos passageiros com pagamento aprovado, então exige
 * o token guardado em bus-secrets.php (fora do document root). Sem token,
 * responde 404 em vez de 401: não confirma a existência do endpoint a quem sonda.
 *
 * Somente leitura. `?format=csv` continua disponível para quem precisa dos dados
 * numa planilha rápida, mas o padrão é o PDF, que é o documento levado ao ônibus.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/receipt-pdf.php';
require_once dirname(__DIR__) . '/lib/boarding-pdf.php';

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

    // Só reservas pagas: uma lista de embarque com pendentes levaria a
    // organização a contar passageiro que talvez não apareça.
    $q = $pdo->query(
        'SELECT r.id, r.primary_name, r.email, r.whatsapp AS contato_whatsapp,
                r.passenger_count, r.children_count, r.group_name, r.amount_cents,
                r.mercadopago_order_id, r.bus_number,
                DATE_FORMAT(CONVERT_TZ(r.paid_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS pago_em,
                p.`position`, p.full_name AS passageiro, p.cpf AS passageiro_cpf,
                p.whatsapp AS passageiro_whatsapp, p.is_primary, p.is_minor, p.is_child_lap
           FROM bus_registrations r
           JOIN bus_passengers p ON p.registration_id = r.id
          WHERE r.status = "confirmed"
          ORDER BY r.bus_number, r.paid_at, r.id, p.`position`'
    );
    $linhas = $q->fetchAll(PDO::FETCH_ASSOC);

    $formato = ($_GET['format'] ?? 'pdf');

    // Agrupa por reserva: o PDF é organizado em blocos, não em linhas soltas.
    $grupos = [];
    foreach ($linhas as $l) {
        $code = strtoupper(substr((string) $l['id'], 0, 8));
        if (!isset($grupos[$code])) {
            $grupos[$code] = [
                'code' => $code,
                'group_name' => $l['group_name'] ?? null,
                'contato' => $l['primary_name'],
                'email' => $l['email'],
                'contato_whatsapp' => bus_format_phone((string) $l['contato_whatsapp']),
                'pagantes' => (int) $l['passenger_count'],
                'criancas' => (int) $l['children_count'],
                'valor' => number_format(((int) $l['amount_cents']) / 100, 2, ',', '.'),
                'pago_em' => $l['pago_em'],
                'order_id' => $l['mercadopago_order_id'],
                'bus_number' => $l['bus_number'] !== null ? (int) $l['bus_number'] : null,
                'passageiros' => [],
            ];
        }
        $grupos[$code]['passageiros'][] = [
            'posicao' => (int) $l['position'],
            'nome' => (string) $l['passageiro'],
            'cpf' => bus_format_cpf((string) $l['passageiro_cpf']),
            'whatsapp' => ($l['passageiro_whatsapp'] ?? '') !== ''
                ? bus_format_phone((string) $l['passageiro_whatsapp'])
                : null,
            'responsavel' => (int) $l['is_primary'] === 1,
            'menor' => (int) ($l['is_minor'] ?? 0) === 1,
            'crianca_colo' => (int) ($l['is_child_lap'] ?? 0) === 1,
        ];
    }
    $grupos = array_values($grupos);

    if ($formato === 'json') {
        header('Content-Type: application/json; charset=utf-8');
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
            'reservas' => $grupos,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($formato === 'csv') {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="lista-embarque-kob2026.csv"');

        $saida = fopen('php://output', 'w');
        // BOM: sem ele o Excel no Windows exibe acentuação quebrada.
        fwrite($saida, "\xEF\xBB\xBF");
        fputcsv($saida, [
            'Reserva', 'Nº', 'Passageiro', 'CPF', 'WhatsApp', 'Responsável',
            'Contato principal', 'E-mail', 'Pagantes', 'Crianças (colo)',
            'Valor pago', 'Pago em', 'Transação',
        ], ';');

        foreach ($grupos as $g) {
            foreach ($g['passageiros'] as $p) {
                fputcsv($saida, [
                    $g['code'], $p['posicao'], $p['nome'], $p['cpf'],
                    $p['whatsapp'] ?? '', $p['responsavel'] ? 'Sim' : '',
                    $g['contato'], $g['email'], $g['pagantes'], $g['criancas'],
                    'R$ ' . $g['valor'], $g['pago_em'], $g['order_id'],
                ], ';');
            }
        }
        fclose($saida);
        exit;
    }

    // Logo do cabeçalho. Se falhar (gd ausente, arquivo movido), o PDF sai com
    // o nome escrito: perder o logo não pode impedir a lista de ser gerada.
    $logo = pdf_carregar_imagem(dirname(__DIR__, 2) . '/assets/images/brand/kriativos-on-board-logo.webp');

    $pdf = bus_boarding_pdf($grupos, $logo);

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="lista-embarque-kob2026.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
} catch (Throwable $e) {
    log_failure('bus-manifest', $e);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Não foi possível gerar a lista agora.']);
}
