<?php

declare(strict_types=1);

/**
 * Exporta a relação de passageiros em .xlsx, com a identidade visual do site.
 *
 * Gerado no servidor, não no navegador: .xlsx é um ZIP com vários XMLs, e o
 * servidor já tem `ZipArchive` (medido). Fazer no cliente exigiria embutir uma
 * biblioteca de ZIP num site que não usa bundler.
 *
 * Somente leitura. Respeita o filtro e a busca que estavam na tela, para o
 * arquivo bater com o que a pessoa está vendo.
 *
 * Desistentes continuam na planilha (conferência e financeiro), com a coluna
 * "Desistência" preenchida e a linha em cinza tachado. Na reserva inteira
 * desistente o Status segue mostrando o pagamento; o filtro `desistente` lista
 * só essas reservas, como o filtro "Desistentes" do painel.
 */

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once dirname(__DIR__) . '/lib/contact-display.php';
require_once dirname(__DIR__) . '/lib/registration-edit-schema.php';
require_once dirname(__DIR__) . '/lib/registration-withdrawal-display.php';
require_once __DIR__ . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/receipt-pdf.php';
require_once dirname(__DIR__) . '/lib/xlsx.php';

$config = bus_config();

if (!bus_check_admin_token($config)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'not found']);
    exit;
}

/** Mesma tradução de status usada pelo painel, para os dois não divergirem. */
function bus_status_xlsx(string $status): array
{
    switch ($status) {
        case 'confirmed':
            return ['chave' => 'pago', 'rotulo' => 'Pagamento aprovado', 'estilo' => 'status_ok'];
        case 'paid_awaiting_proof':
            return ['chave' => 'pendente', 'rotulo' => 'Em análise', 'estilo' => 'status_espera'];
        case 'payment_pending':
            return ['chave' => 'pendente', 'rotulo' => 'Aguardando pagamento', 'estilo' => 'status_espera'];
        case 'payment_failed':
            return ['chave' => 'falha', 'rotulo' => 'Falha no pagamento', 'estilo' => 'status_falha'];
        case 'cancelled':
            return ['chave' => 'falha', 'rotulo' => 'Pagamento cancelado', 'estilo' => 'status_falha'];
        case 'refunded':
            return ['chave' => 'falha', 'rotulo' => 'Reembolsado', 'estilo' => 'status_falha'];
        default:
            return ['chave' => 'pendente', 'rotulo' => $status, 'estilo' => 'status_espera'];
    }
}

try {
    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);
    bus_registration_edit_ensure_schema($pdo);
    $filtro = (string) ($_GET['filtro'] ?? 'pago');
    $onibusFiltro = trim((string) ($_GET['onibus'] ?? 'todos'));
    $busca = mb_strtolower(trim((string) ($_GET['busca'] ?? '')), 'UTF-8');

    $q = $pdo->query(
        'SELECT r.id, r.primary_name, r.email, r.whatsapp, r.status,
                r.passenger_count, r.children_count, r.group_name, r.is_vip, r.amount_cents,
                r.mercadopago_order_id, r.bus_number, r.withdrawn_at,
                DATE_FORMAT(CONVERT_TZ(r.paid_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS pago_em,
                DATE_FORMAT(CONVERT_TZ(r.created_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS criado_em
           FROM bus_registrations r
          ORDER BY r.bus_number ASC, r.created_at DESC'
    );
    $reservas = $q->fetchAll(PDO::FETCH_ASSOC);

    $qp = $pdo->query(
        'SELECT registration_id, `position`, full_name, cpf, whatsapp, email, is_primary, is_minor, is_child_lap,
                withdrawn_at, withdrawal_reason,
                DATE_FORMAT(CONVERT_TZ(withdrawn_at, "+00:00", "-03:00"), "%d/%m/%Y %H:%i") AS desistiu_em
           FROM bus_passengers ORDER BY registration_id, `position`'
    );
    $porReserva = [];
    foreach ($qp->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $porReserva[$p['registration_id']][] = $p;
    }

    $colunas = [
        ['titulo' => 'Reserva', 'largura' => 13],
        ['titulo' => 'Grupo', 'largura' => 22],
        ['titulo' => 'Nº', 'largura' => 5],
        ['titulo' => 'Passageiro', 'largura' => 30],
        ['titulo' => 'CPF', 'largura' => 16],
        ['titulo' => 'Faixa Etária', 'largura' => 18],
        ['titulo' => 'WhatsApp', 'largura' => 17],
        ['titulo' => 'E-mail', 'largura' => 30],
        ['titulo' => 'Responsável', 'largura' => 30],
        ['titulo' => 'Ônibus', 'largura' => 12],
        ['titulo' => 'Qtd Pessoas', 'largura' => 13],
        ['titulo' => 'Valor pago', 'largura' => 13],
        ['titulo' => 'Status', 'largura' => 22],
        ['titulo' => 'Desistência', 'largura' => 26],
        ['titulo' => 'Pago em', 'largura' => 17],
        ['titulo' => 'Transação', 'largura' => 34],
    ];

    $linhas = [];
    foreach ($reservas as $r) {
        // Reserva inteira desistente também fica com bus_number NULL, mas não
        // está aguardando lugar: não entra em "sem ônibus confirmado".
        $semOnibus = $r['bus_number'] === null && $r['withdrawn_at'] === null;
        if ($onibusFiltro === 'sem-onibus' && !$semOnibus) {
            continue;
        }
        if (ctype_digit($onibusFiltro) && (int) $onibusFiltro > 0
            && (int) ($r['bus_number'] ?? 0) !== (int) $onibusFiltro) {
            continue;
        }
        $isVip = (int) ($r['is_vip'] ?? 0) === 1;
        $reservaDesistente = $r['withdrawn_at'] !== null;
        $st = $isVip
            ? ['chave' => 'vip', 'rotulo' => 'Reserva VIP', 'estilo' => 'status_vip']
            : bus_status_xlsx((string) $r['status']);
        // Mesmo critério do `status_chave` do painel: a desistência da reserva
        // inteira sobrepõe o status de pagamento e o VIP (que já vem em $st).
        $chaveFiltro = bus_admin_reserva_status(
            ['chave' => $st['chave'], 'rotulo' => $st['rotulo'], 'tom' => ''],
            false,
            $reservaDesistente
        )['chave'];
        if ($filtro !== 'todas' && $chaveFiltro !== $filtro) {
            continue;
        }

        $passageiros = $porReserva[$r['id']] ?? [];
        if (!$passageiros) {
            // Reserva sem passageiro gravado: leva o contato, para a linha não
            // desaparecer da conferência.
            $passageiros = [[
                'position' => 1,
                'full_name' => $r['primary_name'],
                'cpf' => '',
                'whatsapp' => $r['whatsapp'],
                'email' => $r['email'],
                'is_primary' => 1,
                'is_minor' => 0,
                'is_child_lap' => 0,
                'withdrawn_at' => null,
                'withdrawal_reason' => null,
                'desistiu_em' => null,
            ]];
        }

        $code = strtoupper(substr((string) $r['id'], 0, 8));
        // Contagens gravadas já são só de ativos; a reserva inteira desistente
        // guarda as de antes (o banco exige >= 1), então aqui vira 0.
        $grupo = $isVip ? '' : ($reservaDesistente ? '0' : $r['passenger_count'] . ((int) $r['children_count'] > 0
            ? ' + ' . $r['children_count'] . ' colo' : ''));
        $valor = $isVip ? '' : 'R$ ' . number_format(((int) $r['amount_cents']) / 100, 2, ',', '.');
        $isFalha = !$isVip && ($st['chave'] ?? '') === 'falha';

        foreach ($passageiros as $i => $p) {
            $primeiro = $i === 0;
            $responsavel = (int) ($p['is_primary'] ?? 0) === 1;
            $desistiu = ($p['withdrawn_at'] ?? null) !== null;
            $textoDesistencia = bus_withdrawal_cell_text(
                $desistiu,
                $desistiu ? (string) ($p['desistiu_em'] ?? '') : null,
                $p['withdrawal_reason'] ?? null
            );

            if ($busca !== '') {
                $alvo = mb_strtolower(implode(' ', [
                    $code, $p['full_name'], $p['cpf'] ?? '', $p['whatsapp'] ?? '',
                    $p['email'] ?? '', $r['primary_name'], $r['email'], $r['whatsapp'],
                    $r['group_name'] ?? '', $r['mercadopago_order_id'] ?? '', $st['rotulo'],
                    $textoDesistencia,
                ]), 'UTF-8');
                if (mb_strpos($alvo, $busca) === false) {
                    continue;
                }
            }

            $isChildLap = !empty($p['is_child_lap']);

            $faixaEtaria = '18 anos ou mais';
            if ($isChildLap) {
                $faixaEtaria = '0 a 5 anos (colo)';
            } elseif (!empty($p['is_minor'])) {
                $faixaEtaria = '6 a 17 anos';
            }

            $whatsappPassageiro = $isVip ? '' : bus_missing_contact_label($p['whatsapp'] ?? null, $isChildLap);
            if (!$isChildLap && ($p['whatsapp'] ?? '') !== '') {
                $whatsappPassageiro = bus_format_phone((string) $p['whatsapp']);
            }

            $emailPassageiro = $isVip ? '' : bus_missing_contact_label($p['email'] ?? null, $isChildLap);
            if (!$isChildLap && (string) ($p['email'] ?? '') !== '') {
                $emailPassageiro = (string) $p['email'];
            } elseif (!$isChildLap && $responsavel) {
                $emailPassageiro = bus_missing_contact_label($r['email'] ?? null, false);
            }

            if ($isVip) {
                $estiloBase = 'vip';
            } elseif ($isFalha) {
                $estiloBase = $responsavel ? 'falha_responsavel' : ($primeiro ? 'falha_grupo' : 'falha');
            } elseif ($responsavel) {
                $estiloBase = 'responsavel';
            } elseif ($primeiro) {
                $estiloBase = 'grupo';
            } else {
                $estiloBase = 'normal';
            }
            $estiloLinha = $estiloBase;
            // Células da reserva (Responsável, Ônibus, Qtd, Valor, Status, Pago
            // em, Transação) com o estilo da reserva quando só o passageiro
            // desistiu: a reserva não mudou, então não aparece riscada.
            $estiloReserva = null;
            if ($desistiu) {
                // Esmaecida e tachada: a pessoa segue na planilha, mas não viaja.
                // A borda superior que separa os grupos continua.
                $estiloLinha = in_array($estiloBase, ['grupo', 'falha_grupo'], true)
                    ? 'desistente_grupo'
                    : 'desistente';
                if (!$reservaDesistente) {
                    $estiloReserva = $estiloBase;
                }
            }
            $celulaReserva = static function (string $valor) use ($estiloReserva) {
                return $estiloReserva === null ? $valor : ['v' => $valor, 'estilo' => $estiloReserva];
            };

            // Reserva, Responsável e Grupo repetem em todas as linhas do grupo,
            // facilitando ordenação e conferência no Excel.
            $linhas[] = [
                // Linha do responsável ganha destaque; canceladas/falhas ganham fundo vermelho claro;
                // a primeira linha de cada grupo ganha a borda superior que separa os blocos.
                'estilo' => $estiloLinha,
                'celulas' => [
                    $code,
                    (string) ($r['group_name'] ?? ''),
                    [
                        'tipo' => 'numero',
                        'v' => $p['position'] ?? 1,
                        'estilo' => 'centralizado',
                    ],
                    (string) $p['full_name'],
                    bus_format_cpf((string) ($p['cpf'] ?? '')),
                    $faixaEtaria,
                    $whatsappPassageiro,
                    $emailPassageiro,
                    $celulaReserva((string) $r['primary_name']),
                    $celulaReserva(
                        $r['bus_number'] !== null ? 'Ônibus ' . $r['bus_number'] : ($isVip ? 'Sem ônibus confirmado' : '—')
                    ),
                    $celulaReserva($primeiro ? $grupo : ''),
                    $celulaReserva($primeiro ? $valor : ''),
                    $primeiro
                        ? ['v' => $st['rotulo'], 'estilo' => $st['estilo']]
                        : $celulaReserva(''),
                    $textoDesistencia,
                    $celulaReserva($primeiro && !$isVip ? (string) ($r['pago_em'] ?? '') : ''),
                    $celulaReserva($primeiro && !$isVip ? (string) ($r['mercadopago_order_id'] ?? '') : ''),
                ],
            ];
        }
    }

    $rotuloFiltro = [
        'pago' => 'pagamentos aprovados',
        'pendente' => 'aguardando pagamento',
        'falha' => 'cancelados e falhas',
        'desistente' => 'desistentes',
        'vip' => 'reservas VIP',
        'todas' => 'todas as reservas',
    ][$filtro] ?? $filtro;
    $rotuloOnibus = $onibusFiltro === 'sem-onibus'
        ? 'sem ônibus confirmado'
        : (ctype_digit($onibusFiltro) && (int) $onibusFiltro > 0 ? 'Ônibus ' . (int) $onibusFiltro : 'todos os ônibus');

    // Estado vazio: uma planilha só com cabeçalho parece exportação que falhou.
    // Uma linha dizendo o que aconteceu evita a dúvida "quebrou ou está vazio?".
    if (!$linhas) {
        $linhas[] = [
            'estilo' => 'normal',
            'celulas' => [
                $busca !== ''
                    ? 'Nenhum passageiro corresponde ao filtro e a busca aplicados.'
                    : 'Nenhuma reserva neste filtro ainda.',
            ],
        ];
    }

    $bytes = xlsx_build([
        'nome' => 'Passageiros',
        'titulo' => 'Kriativos On Board 2026 · Transporte fretado · Passageiros',
        'subtitulo' => 'Filtro: ' . $rotuloFiltro
            . ' · ônibus: ' . $rotuloOnibus
            . ($busca !== '' ? ' · busca: "' . $busca . '"' : '')
            . ' · ' . count($linhas) . ' passageiro(s) · gerado em '
            . gmdate('d/m/Y H:i', time() - 3 * 3600),
        'colunas' => $colunas,
        'linhas' => $linhas,
    ]);

    $nomeArquivo = 'passageiros-kob2026-' . gmdate('Y-m-d') . '.xlsx';

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $nomeArquivo . '"');
    header('Content-Length: ' . strlen($bytes));
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    echo $bytes;
} catch (Throwable $e) {
    log_failure('bus-admin-xlsx', $e);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Não foi possível gerar a planilha agora.']);
}
