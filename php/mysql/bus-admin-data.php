<?php

declare(strict_types=1);

/**
 * API do painel da organização: dados agregados das reservas.
 *
 * Separado de `bus-manifest.php` (que entrega a lista de embarque para download)
 * porque o painel precisa dos dados em JSON já agrupados e com resumo.
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

/**
 * Traduz o status do banco para o vocabulário do painel.
 *
 * O banco guarda o estado técnico; a organização precisa de uma frase que diga
 * o que fazer. `cancelled` cobre tanto cancelamento manual quanto expiração do
 * Pix no Mercado Pago, e para quem confere a lista os dois significam a mesma
 * coisa: a vaga não está paga.
 */
function bus_status_painel(string $status): array
{
    switch ($status) {
        case 'confirmed':
            return ['chave' => 'pago', 'rotulo' => 'Pagamento aprovado', 'tom' => 'ok'];
        case 'paid_awaiting_proof':
            return ['chave' => 'pendente', 'rotulo' => 'Em análise', 'tom' => 'espera'];
        case 'payment_pending':
            return ['chave' => 'pendente', 'rotulo' => 'Aguardando pagamento', 'tom' => 'espera'];
        case 'payment_failed':
            return ['chave' => 'falha', 'rotulo' => 'Falha no pagamento', 'tom' => 'falha'];
        case 'cancelled':
            return ['chave' => 'falha', 'rotulo' => 'Pagamento cancelado', 'tom' => 'falha'];
        case 'refunded':
            return ['chave' => 'falha', 'rotulo' => 'Reembolsado', 'tom' => 'falha'];
        default:
            return ['chave' => 'pendente', 'rotulo' => $status, 'tom' => 'espera'];
    }
}

try {
    $pdo = bus_pdo();

    $q = $pdo->query(
        'SELECT r.id, r.primary_name, r.primary_cpf, r.email, r.whatsapp, r.status,
                r.status_detail, r.passenger_count, r.children_count, r.group_name, r.amount_cents,
                r.mercadopago_order_id, r.confirmation_email_sent_at, r.created_at, r.bus_number,
                DATE_FORMAT(CONVERT_TZ(r.created_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS criado_em,
                DATE_FORMAT(CONVERT_TZ(r.paid_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS pago_em
           FROM bus_registrations r
          ORDER BY r.created_at DESC'
    );
    $reservas = $q->fetchAll(PDO::FETCH_ASSOC);

    $qp = $pdo->query(
        'SELECT registration_id, `position`, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap
           FROM bus_passengers ORDER BY registration_id, `position`'
    );
    $porReserva = [];
    foreach ($qp->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $porReserva[$p['registration_id']][] = [
            'posicao' => (int) $p['position'],
            'nome' => $p['full_name'],
            'cpf' => bus_format_cpf((string) $p['cpf']),
            'cpf_digitos' => preg_replace('/\D/', '', (string) $p['cpf']),
            'whatsapp' => ($p['whatsapp'] ?? '') !== '' ? bus_format_phone((string) $p['whatsapp']) : null,
            'email' => ($p['email'] ?? '') !== '' ? (string) $p['email'] : null,
            'responsavel' => (int) $p['is_primary'] === 1,
            'menor' => (int) ($p['is_minor'] ?? 0) === 1,
            'crianca_colo' => (int) ($p['is_child_lap'] ?? 0) === 1,
        ];
    }

    // ---- Índice de "onde mais esse CPF aparece" -------------------------------
    //
    // Quando um pagamento cancela ou falha, a pessoa costuma refazer o cadastro.
    // Sem cruzar isso, o painel mostra a reserva morta e a nova como se fossem
    // grupos diferentes, e a organização cobra alguém que já pagou.
    //
    // O cruzamento é por CPF porque é o único identificador estável: o nome pode
    // vir escrito diferente e o telefone pode nem ter sido informado.
    $ondeAparece = [];
    foreach ($reservas as $r) {
        foreach ($porReserva[$r['id']] ?? [] as $p) {
            $cpf = $p['cpf_digitos'];
            if ($cpf === '') {
                continue;
            }
            $ondeAparece[$cpf][] = [
                'registro' => $r['id'],
                'code' => strtoupper(substr((string) $r['id'], 0, 8)),
                'status' => $r['status'],
                'criado_em_bruto' => (string) $r['created_at'],
            ];
        }
    }

    $lista = [];
    $resumo = [
        'reservas_pagas' => 0,
        'reservas_pendentes' => 0,
        'reservas_falha' => 0,
        'pagantes' => 0,
        'criancas_no_colo' => 0,
        'total_a_bordo' => 0,
        'receita_centavos' => 0,
        'sem_telefone' => 0,
        'vip_seats' => 0,
    ];

    $q_settings = $pdo->query("SELECT setting_value FROM bus_settings WHERE setting_key = 'vip_seats'");
    $setting_vip = $q_settings->fetch(PDO::FETCH_ASSOC);
    if ($setting_vip) {
        $resumo['vip_seats'] = (int) $setting_vip['setting_value'];
    }

    $frota = [
        'capacidade' => 46,
        'minimo' => 40,
        'vip_seats' => $resumo['vip_seats'],
        'onibus' => [],
    ];
    $ocupacaoPorOnibus = [];

    foreach ($reservas as $r) {
        $st = bus_status_painel((string) $r['status']);
        $passageiros = $porReserva[$r['id']] ?? [];

        if ($st['chave'] === 'pago') {
            $resumo['reservas_pagas']++;
            $resumo['pagantes'] += (int) $r['passenger_count'];
            $resumo['criancas_no_colo'] += (int) $r['children_count'];
            $resumo['receita_centavos'] += (int) $r['amount_cents'];
            foreach ($passageiros as $p) {
                if ($p['whatsapp'] === null) {
                    $resumo['sem_telefone']++;
                }
            }
            if ($r['bus_number'] !== null) {
                $bNum = (int) $r['bus_number'];
                if (!isset($ocupacaoPorOnibus[$bNum])) {
                    $ocupacaoPorOnibus[$bNum] = ['numero' => $bNum, 'pagantes' => 0, 'criancas' => 0, 'total' => 0];
                }
                $ocupacaoPorOnibus[$bNum]['pagantes'] += (int) $r['passenger_count'];
                $ocupacaoPorOnibus[$bNum]['criancas'] += (int) $r['children_count'];
                $ocupacaoPorOnibus[$bNum]['total'] += ((int) $r['passenger_count'] + (int) $r['children_count']);
            }
        } elseif ($st['chave'] === 'pendente') {
            $resumo['reservas_pendentes']++;
        } else {
            $resumo['reservas_falha']++;
        }

        // Só reservas encerradas sem pagamento ganham o aviso de "tentou de
        // novo". Numa reserva paga o dado seria ruído: ela já está resolvida.
        $avisarNovaReserva = in_array($st['chave'], ['falha'], true);

        foreach ($passageiros as $i => $p) {
            $passageiros[$i]['nova_reserva'] = null;
            if (!$avisarNovaReserva || $p['cpf_digitos'] === '') {
                continue;
            }

            // Entre as outras reservas do mesmo CPF, pega a MAIS RECENTE que
            // veio depois desta. "Depois" importa: uma reserva anterior também
            // cancelada não é a tentativa nova.
            $candidatas = [];
            foreach ($ondeAparece[$p['cpf_digitos']] ?? [] as $outra) {
                if ($outra['registro'] === $r['id']) {
                    continue;
                }
                if ($outra['criado_em_bruto'] <= (string) $r['created_at']) {
                    continue;
                }
                $candidatas[] = $outra;
            }
            if (!$candidatas) {
                continue;
            }
            usort($candidatas, static fn ($a, $b) => strcmp($b['criado_em_bruto'], $a['criado_em_bruto']));
            $nova = $candidatas[0];
            $stNova = bus_status_painel($nova['status']);

            $passageiros[$i]['nova_reserva'] = [
                'code' => $nova['code'],
                'rotulo' => $stNova['rotulo'],
                'tom' => $stNova['tom'],
            ];
        }

        $lista[] = [
            'code' => strtoupper(substr((string) $r['id'], 0, 8)),
            'id' => $r['id'],
            'status' => $r['status'],
            'status_chave' => $st['chave'],
            'status_rotulo' => $st['rotulo'],
            'status_tom' => $st['tom'],
            'contato' => $r['primary_name'],
            'contato_cpf' => bus_format_cpf((string) $r['primary_cpf']),
            'email' => $r['email'],
            'contato_whatsapp' => bus_format_phone((string) $r['whatsapp']),
            'pagantes' => (int) $r['passenger_count'],
            'criancas' => (int) $r['children_count'],
            'grupo' => ($r['group_name'] ?? '') !== '' ? $r['group_name'] : null,
            'valor' => number_format(((int) $r['amount_cents']) / 100, 2, ',', '.'),
            'valor_centavos' => (int) $r['amount_cents'],
            'criado_em' => $r['criado_em'],
            'pago_em' => $r['pago_em'],
            'order_id' => $r['mercadopago_order_id'],
            'email_enviado' => !empty($r['confirmation_email_sent_at']),
            'bus_number' => $r['bus_number'] !== null ? (int) $r['bus_number'] : null,
            'passageiros' => $passageiros,
        ];
    }

    $resumo['total_a_bordo'] = $resumo['pagantes'] + $resumo['criancas_no_colo'] + $resumo['vip_seats'];
    $resumo['receita'] = number_format($resumo['receita_centavos'] / 100, 2, ',', '.');

    ksort($ocupacaoPorOnibus);
    $frota['onibus'] = array_values($ocupacaoPorOnibus);

    echo json_encode([
        'gerado_em' => gmdate('c'),
        'resumo' => $resumo,
        'frota' => $frota,
        'reservas' => $lista,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    log_failure('bus-admin-data', $e);
    http_response_code(503);
    echo json_encode(['error' => 'Não foi possível carregar os dados agora.']);
}
