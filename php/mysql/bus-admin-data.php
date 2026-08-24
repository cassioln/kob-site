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
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/receipt-pdf.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$config = bus_config();

if (!bus_check_admin_token($config)) {
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
    bus_fleet_ensure_assignment_status($pdo);

    $q = $pdo->query(
        'SELECT r.id, r.primary_name, r.primary_cpf, r.email, r.whatsapp, r.status,
                r.status_detail, r.passenger_count, r.children_count, r.group_name, r.is_vip, r.amount_cents,
                r.mercadopago_order_id, r.confirmation_email_sent_at, r.created_at, r.paid_at, r.bus_number,
                r.fleet_assignment_status,
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
        'reservas_vip' => 0,
        'reservas_pendentes' => 0,
        'reservas_falha' => 0,
        'pagantes' => 0,
        'criancas_no_colo' => 0,
        'total_a_bordo' => 0,
        'receita_centavos' => 0,
        'receita_liquida_centavos' => 0,
        'sem_telefone' => 0,
        'vip_seats' => 0,
    ];

    // Garantir que a tabela bus_settings e a coluna bus_number existam
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS bus_settings (
                setting_key VARCHAR(64) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        $pdo->exec("INSERT IGNORE INTO bus_settings (setting_key, setting_value) VALUES ('vip_seats', '0')");
    } catch (Throwable $e) {
        // ignora
    }

    try {
        $pdo->exec("ALTER TABLE bus_registrations ADD COLUMN bus_number INT NULL AFTER confirmation_email_sent_at");
    } catch (Throwable $e) {
        // coluna já existe
    }

    $vipCount = 0;
    $vipAssignments = [];
    try {
        // Remove a configuração antiga assim que o painel autenticado é
        // aberto. VIPs reais (is_vip=1) ficam preservados.
        bus_fleet_clear_legacy_vip_settings($pdo);
        $legacyVip = bus_fleet_load_legacy_vip_settings($pdo);
        $vipCount = $legacyVip['count'];
        $vipAssignments = $legacyVip['assignments'];
    } catch (Throwable $e) {
        // ignora
    }
    $resumo['vip_seats'] = $vipCount;

    $porOnibus = [];
    $maxBusNum = 1; // start with at least 1
    $vipsSemFixo = [];

    // 1. Inicializa $porOnibus com VIPs que JÁ têm onibus fixo
    for ($i = 1; $i <= $vipCount; $i++) {
        $vipId = 'vip_' . $i;
        if (isset($vipAssignments[$vipId])) {
            $bNum = (int) $vipAssignments[$vipId];
            if ($bNum < 1) $bNum = 1;
            if ($bNum > $maxBusNum) $maxBusNum = $bNum;
            
            if (!isset($porOnibus[$bNum])) {
                $porOnibus[$bNum] = [ 'numero' => $bNum, 'pagantes' => 0, 'criancas' => 0, 'total' => 0, 'assentos' => 0, 'reservas' => [] ];
            }
            $porOnibus[$bNum]['total'] += 1;
            $porOnibus[$bNum]['assentos'] += 1;
            $porOnibus[$bNum]['reservas'][] = [ 'id' => $vipId, 'code' => 'VIP ' . $i, 'grupo' => 'Lugar VIP', 'responsavel' => 'Reserva VIP', 'pagantes' => 1, 'criancas' => 0, 'total' => 1, 'assentos' => 1, 'is_vip' => true ];
        } else {
            $vipsSemFixo[] = $i;
        }
    }

    // 2. Primeira passagem nas reservas para identificar fixos e separar sem fixo
    $reservasSemFixoIndices = [];
    foreach ($reservas as $idx => $r) {
        $st = bus_status_painel((string) $r['status']);
        if ($st['chave'] === 'pago') {
            $fleetStatus = ($r['fleet_assignment_status'] ?? 'assigned') === 'waiting'
                ? 'waiting'
                : 'assigned';

            if ($r['bus_number'] === null && $fleetStatus !== 'waiting') {
                $reservasSemFixoIndices[] = $idx;
            } elseif ($r['bus_number'] !== null) {
                $bNum = (int) $r['bus_number'];
                if ($bNum < 1) $bNum = 1;
                if ($bNum > $maxBusNum) $maxBusNum = $bNum;
                
                if (!isset($porOnibus[$bNum])) {
                    $porOnibus[$bNum] = [ 'numero' => $bNum, 'pagantes' => 0, 'criancas' => 0, 'total' => 0, 'assentos' => 0, 'reservas' => [] ];
                }
                
                $paxCount = (int) $r['passenger_count'];
                $childCount = (int) $r['children_count'];
                $grupoTotal = $paxCount + $childCount;
                $assentosGrupo = bus_fleet_seat_count($paxCount, $childCount);

                $porOnibus[$bNum]['pagantes'] += $paxCount;
                $porOnibus[$bNum]['criancas'] += $childCount;
                $porOnibus[$bNum]['total'] += $grupoTotal;
                $porOnibus[$bNum]['assentos'] += $assentosGrupo;
                $porOnibus[$bNum]['reservas'][] = [
                    'id' => $r['id'],
                    'code' => strtoupper(substr((string) $r['id'], 0, 8)),
                    'grupo' => ($r['group_name'] ?? '') !== '' ? $r['group_name'] : null,
                    'responsavel' => $r['primary_name'],
                    'pagantes' => $paxCount,
                    'criancas' => $childCount,
                    'total' => $grupoTotal,
                    'assentos' => $assentosGrupo,
                    'is_vip' => (bool) $r['is_vip'],
                    'pago_em' => $r['pago_em'] ?? $r['criado_em'] ?? null,
                    'passageiros' => array_map(static fn ($p) => [
                        'posicao' => (int) $p['posicao'],
                        'nome' => $p['nome'],
                        'responsavel' => (bool) $p['responsavel'],
                        'menor' => (bool) $p['menor'],
                        'crianca_colo' => (bool) $p['crianca_colo'],
                        'faixa' => $p['crianca_colo'] ? '0 a 5 anos' : ($p['menor'] ? '6 a 17 anos' : '18 anos ou mais'),
                    ], $porReserva[$r['id']] ?? []),
                ];
            }
        }
    }

    // 3. Processa reservas pagas sem ônibus fixo (ordem cronológica)
    usort($reservasSemFixoIndices, function($a, $b) use ($reservas) {
        return strcmp($reservas[$a]['created_at'], $reservas[$b]['created_at']);
    });

    foreach ($reservasSemFixoIndices as $idx) {
        $r = $reservas[$idx];
        $paxCount = (int) $r['passenger_count'];
        $childCount = (int) $r['children_count'];
        $grupoTotal = $paxCount + $childCount;
        $assentosGrupo = bus_fleet_seat_count($paxCount, $childCount);
        
        $bNum = 1;
        while (true) {
            $ocupadosBusAtual = isset($porOnibus[$bNum]) ? $porOnibus[$bNum]['assentos'] : 0;
            if ($ocupadosBusAtual + $assentosGrupo <= 46) {
                break;
            }
            $bNum++;
        }
        
        // Fixa no banco de dados
        $pdo->prepare("UPDATE bus_registrations SET bus_number = ? WHERE id = ?")->execute([$bNum, $r['id']]);
        $reservas[$idx]['bus_number'] = $bNum; // atualiza na memória
        
        if ($bNum > $maxBusNum) $maxBusNum = $bNum;
        
        if (!isset($porOnibus[$bNum])) {
            $porOnibus[$bNum] = [ 'numero' => $bNum, 'pagantes' => 0, 'criancas' => 0, 'total' => 0, 'assentos' => 0, 'reservas' => [] ];
        }
        $porOnibus[$bNum]['pagantes'] += $paxCount;
        $porOnibus[$bNum]['criancas'] += $childCount;
        $porOnibus[$bNum]['total'] += $grupoTotal;
        $porOnibus[$bNum]['assentos'] += $assentosGrupo;
        $porOnibus[$bNum]['reservas'][] = [
            'id' => $r['id'],
            'code' => strtoupper(substr((string) $r['id'], 0, 8)),
            'grupo' => ($r['group_name'] ?? '') !== '' ? $r['group_name'] : null,
            'responsavel' => $r['primary_name'],
            'pagantes' => $paxCount,
            'criancas' => $childCount,
            'total' => $grupoTotal,
            'assentos' => $assentosGrupo,
            'is_vip' => (bool) $r['is_vip'],
            'pago_em' => $r['pago_em'] ?? $r['criado_em'] ?? null,
            'passageiros' => array_map(static fn ($p) => [
                'posicao' => (int) $p['posicao'],
                'nome' => $p['nome'],
                'responsavel' => (bool) $p['responsavel'],
                'menor' => (bool) $p['menor'],
                'crianca_colo' => (bool) $p['crianca_colo'],
                'faixa' => $p['crianca_colo'] ? '0 a 5 anos' : ($p['menor'] ? '6 a 17 anos' : '18 anos ou mais'),
            ], $porReserva[$r['id']] ?? []),
        ];
    }

    // 4. Injeta VIPs sem posição fixa nos ônibus com vaga
    foreach ($vipsSemFixo as $i) {
        $vipId = 'vip_' . $i;
        $bNum = 1;
        while (true) {
            $ocupadosBusAtual = isset($porOnibus[$bNum]) ? $porOnibus[$bNum]['assentos'] : 0;
            if ($ocupadosBusAtual + 1 <= 46) {
                break;
            }
            $bNum++;
        }
        
        if ($bNum > $maxBusNum) $maxBusNum = $bNum;
        
        if (!isset($porOnibus[$bNum])) {
            $porOnibus[$bNum] = [ 'numero' => $bNum, 'pagantes' => 0, 'criancas' => 0, 'total' => 0, 'assentos' => 0, 'reservas' => [] ];
        }
        $porOnibus[$bNum]['total'] += 1;
        $porOnibus[$bNum]['assentos'] += 1;
        $porOnibus[$bNum]['reservas'][] = [
            'id' => $vipId,
            'code' => 'VIP ' . $i,
            'grupo' => 'Lugar VIP',
            'responsavel' => 'Reserva VIP',
            'pagantes' => 1,
            'criancas' => 0,
            'total' => 1,
            'assentos' => 1,
            'is_vip' => true
        ];
    }

    // 5. Segunda passagem para montar $lista com as métricas globais
    foreach ($reservas as $r) {
        $st = bus_status_painel((string) $r['status']);
        $passageiros = $porReserva[$r['id']] ?? [];

        if ($st['chave'] === 'pago') {
            if (!empty($r['is_vip'])) {
                // VIP confirmado não é pagamento aprovado: permanece visível
                // no filtro próprio sem inflar o indicador financeiro.
                $resumo['reservas_vip']++;
            } else {
                $resumo['reservas_pagas']++;
            }
            $resumo['pagantes'] += (int) $r['passenger_count'];
            $resumo['criancas_no_colo'] += (int) $r['children_count'];
            $resumo['total_a_bordo'] += (int) $r['passenger_count'] + (int) $r['children_count'];
            if (empty($r['is_vip'])) {
                $valorCentavos = (int) $r['amount_cents'];
                $resumo['receita_centavos'] += $valorCentavos;
                // A taxa é arredondada por pagamento, como no crédito do Mercado Pago.
                $taxaCentavos = intdiv($valorCentavos * 99 + 5000, 10000);
                $resumo['receita_liquida_centavos'] += $valorCentavos - $taxaCentavos;
            }
            foreach ($passageiros as $p) {
                if ($p['whatsapp'] === null) {
                    $resumo['sem_telefone']++;
                }
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

        $statusReserva = !empty($r['is_vip'])
            ? ['chave' => 'vip', 'rotulo' => 'Reserva VIP', 'tom' => 'vip']
            : $st;

        $lista[] = [
            'code' => strtoupper(substr((string) $r['id'], 0, 8)),
            'id' => $r['id'],
            'status' => $r['status'],
            'status_chave' => $statusReserva['chave'],
            'status_rotulo' => $statusReserva['rotulo'],
            'status_tom' => $statusReserva['tom'],
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
            'fleet_assignment_status' => ($r['fleet_assignment_status'] ?? 'assigned') === 'waiting' ? 'waiting' : 'assigned',
            'is_vip' => (bool) $r['is_vip'],
            'passageiros' => $passageiros,
        ];
    }

    $resumo['receita'] = number_format($resumo['receita_centavos'] / 100, 2, ',', '.');
    $resumo['receita_liquida'] = number_format($resumo['receita_liquida_centavos'] / 100, 2, ',', '.');

    $semOnibusConfirmado = [];
    foreach ($reservas as $r) {
        $fleetStatus = ($r['fleet_assignment_status'] ?? 'assigned') === 'waiting'
            ? 'waiting'
            : 'assigned';
        if (bus_status_painel((string) $r['status'])['chave'] !== 'pago'
            || $fleetStatus !== 'waiting'
            || $r['bus_number'] !== null) {
            continue;
        }

        $semOnibusConfirmado[] = [
            'id' => $r['id'],
            'code' => strtoupper(substr((string) $r['id'], 0, 8)),
            'contato' => $r['primary_name'],
            'grupo' => ($r['group_name'] ?? '') !== '' ? $r['group_name'] : null,
            'pagantes' => (int) $r['passenger_count'],
            'criancas' => (int) $r['children_count'],
            'total' => (int) $r['passenger_count'] + (int) $r['children_count'],
            'is_vip' => (bool) $r['is_vip'],
            'pago_em' => $r['pago_em'] ?? $r['criado_em'] ?? null,
            'passageiros' => array_map(static fn ($p) => [
                'posicao' => (int) $p['posicao'],
                'nome' => $p['nome'],
                'responsavel' => (bool) $p['responsavel'],
                'menor' => (bool) $p['menor'],
                'crianca_colo' => (bool) $p['crianca_colo'],
                'faixa' => $p['crianca_colo'] ? '0 a 5 anos' : ($p['menor'] ? '6 a 17 anos' : '18 anos ou mais'),
            ], $porReserva[$r['id']] ?? []),
            '_paid_at' => (string) ($r['paid_at'] ?? ''),
            '_created_at' => (string) ($r['created_at'] ?? ''),
        ];
    }
    usort($semOnibusConfirmado, static function (array $a, array $b): int {
        return [$a['_paid_at'], $a['_created_at'], $a['id']] <=> [$b['_paid_at'], $b['_created_at'], $b['id']];
    });
    foreach ($semOnibusConfirmado as &$item) {
        unset($item['_paid_at'], $item['_created_at']);
    }
    unset($item);


    // Constrói a lista de ônibus
    $listaOnibus = [];

    $lockedBuses = [];
    try {
        $lockedBuses = bus_fleet_load_locked_buses($pdo);
    } catch (Throwable $e) {
        // ignora
    }

    $totalBusesToShow = $maxBusNum;
    if (!empty($lockedBuses)) {
        $totalBusesToShow = max($totalBusesToShow, max($lockedBuses));
    }

    for ($i = 1; $i <= $totalBusesToShow; $i++) {
        $busData = $porOnibus[$i] ?? [
            'numero' => $i,
            'pagantes' => 0,
            'criancas' => 0,
            'total' => 0,
            'assentos' => 0,
            'reservas' => [],
        ];

        // `total` representa pessoas; `ocupados` representa assentos físicos.
        $vipsNoOnibus = 0;
        foreach ($busData['reservas'] as $r) {
            if (!empty($r['is_vip'])) {
                $vipsNoOnibus++;
            }
        }

        $ocupados = (int) ($busData['assentos'] ?? $busData['pagantes'] ?? 0);
        $busData['ocupados'] = $ocupados;
        $busData['assentos_ocupados'] = $ocupados;
        $busData['capacidade'] = 46;
        $busData['vagas_livres'] = max(0, 46 - $ocupados);
        $busData['assentos_de_colos'] = (int) ($busData['criancas'] ?? 0);
        $busData['vip_inclusos'] = $vipsNoOnibus;
        $busData['vagas_vip'] = $vipsNoOnibus;
        $busData['fechado'] = $ocupados >= 40;
        $busData['bloqueado'] = in_array($i, $lockedBuses, true);
        $listaOnibus[] = $busData;
    }

    $frota = [
        'capacidade' => 46,
        'minimo' => 40,
        'vip_seats' => $vipCount,
        'locked_buses' => $lockedBuses,
        'onibus' => $listaOnibus,
        'sem_onibus_confirmado' => $semOnibusConfirmado,
    ];

    echo json_encode([
        'gerado_em' => gmdate('c'),
        'resumo' => $resumo,
        'frota' => $frota,
        'reservas' => $lista,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    log_failure('bus-admin-data', $e);
    http_response_code(503);
    echo json_encode(['error' => 'Não foi possível carregar os dados agora: ' . $e->getMessage()]);
}
