<?php

declare(strict_types=1);

/**
 * Notificação administrativa: reserva alterada no painel.
 *
 * Vai para administrativo@ quando alguém registra desistência, reativa um
 * passageiro ou troca o responsável (edições simples de dados não disparam).
 * Existe para a organização saber que lugares foram liberados ou ocupados sem
 * precisar abrir o painel, e quantas reservas na espera podem ser realocadas.
 */

require_once __DIR__ . '/email-parts.php';

function bus_registration_edit_email_subject(string $code): string
{
    return 'Reserva ' . $code . ' – alteração no painel';
}

/**
 * Monta o contexto do e-mail a partir do resultado de bus_registration_edit_apply.
 *
 * @param array $before  linha da reserva antes da edição
 * @param array $plan    plano gravado
 * @return array{code:string, group:?string, bus_number:?int, changes:list<array>,
 *   seats_freed:int, seats_taken:int, waiting:int, names:array<string,string>, reasons:array<string,?string>}
 */
function bus_registration_edit_email_context(array $before, array $plan, int $waiting): array
{
    // Reativação: o ônibus de destino está no plano. Desistência total: o
    // plano zera o ônibus, então vale o de antes.
    $bus = $plan['registration']['bus_number'] ?? $before['bus_number'] ?? null;
    $names = [];
    $reasons = [];
    foreach ($plan['passengers'] as $passenger) {
        $names[(string) $passenger['id']] = (string) $passenger['full_name'];
        $reasons[(string) $passenger['id']] = $passenger['withdrawal_reason'];
    }
    $group = array_key_exists('group_name', $plan['registration'])
        ? $plan['registration']['group_name']
        : ($before['group_name'] ?? null);

    return [
        'code' => strtoupper(substr((string) $before['id'], 0, 8)),
        'group' => $group === null || $group === '' ? null : (string) $group,
        'bus_number' => $bus === null ? null : (int) $bus,
        'changes' => $plan['changes'],
        'seats_freed' => max(0, $plan['seats_before'] - $plan['seats_after']),
        'seats_taken' => max(0, $plan['seats_after'] - $plan['seats_before']),
        'waiting' => $waiting,
        'names' => $names,
        'reasons' => $reasons,
    ];
}

/**
 * Frases do e-mail, compartilhadas pelo HTML e pelo texto puro.
 *
 * @return array{withdrawals: list<string>, reactivations: list<string>, primary: ?string,
 *   corrections: list<string>, seats: list<string>}
 */
function bus_registration_edit_email_lines(array $context): array
{
    $names = $context['names'] ?? [];
    $name = static fn (?string $id): string => $id === null ? '-' : ($names[$id] ?? ('Passageiro ' . $id));
    $labels = [
        'full_name' => 'nome', 'cpf' => 'CPF', 'whatsapp' => 'WhatsApp', 'email' => 'e-mail',
        'age_group' => 'faixa etária', 'withdrawal_reason' => 'motivo da desistência',
    ];

    $lines = ['withdrawals' => [], 'reactivations' => [], 'primary' => null, 'corrections' => [], 'seats' => []];
    $corrected = [];
    // O motivo já aparece junto da desistência (ou some na reativação).
    $withdrawalIds = [];
    foreach ($context['changes'] as $change) {
        if ($change['field'] === 'withdrawn') $withdrawalIds[(string) $change['passenger_id']] = true;
    }
    foreach ($context['changes'] as $change) {
        $id = $change['passenger_id'] === null ? null : (string) $change['passenger_id'];
        if ($change['field'] === 'withdrawn' && $change['after'] === true) {
            $reason = $context['reasons'][$id] ?? null;
            $lines['withdrawals'][] = $name($id) . ($reason !== null && $reason !== '' ? ' (motivo: ' . $reason . ')' : ' (sem motivo informado)');
        } elseif ($change['field'] === 'withdrawn') {
            $lines['reactivations'][] = $name($id);
        } elseif ($change['field'] === 'primary') {
            $lines['primary'] = $name($change['before'] === null ? null : (string) $change['before'])
                . ' → ' . $name($change['after'] === null ? null : (string) $change['after']);
        } elseif ($change['field'] === 'group_name') {
            $lines['corrections'][] = 'grupo: ' . ($change['before'] ?? 'sem grupo') . ' → ' . ($change['after'] ?? 'sem grupo');
        } elseif ($change['field'] === 'withdrawal_reason' && isset($withdrawalIds[(string) $id])) {
            continue;
        } elseif ($id !== null && isset($labels[$change['field']])) {
            $corrected[$id][] = $labels[$change['field']];
        }
    }
    foreach ($corrected as $id => $fields) {
        $lines['corrections'][] = $name((string) $id) . ': ' . implode(', ', $fields);
    }

    $bus = $context['bus_number'];
    $seatPhrase = static fn (int $n, string $verb): string => $n . ($n === 1 ? ' lugar ' . $verb : ' lugares ' . $verb . 's');
    if ($context['seats_freed'] > 0 && $bus !== null) {
        $lines['seats'][] = $seatPhrase($context['seats_freed'], 'liberado') . ' no Ônibus ' . $bus;
        if ($context['waiting'] > 0) {
            $lines['seats'][] = $context['waiting'] . ($context['waiting'] === 1 ? ' reserva aguardando ônibus' : ' reservas aguardando ônibus');
        }
    }
    if (($context['seats_taken'] ?? 0) > 0 && $bus !== null) {
        $lines['seats'][] = $seatPhrase($context['seats_taken'], 'ocupado') . ' a mais no Ônibus ' . $bus;
    }
    return $lines;
}

/** @param array $context ver bus_registration_edit_email_context */
function bus_registration_edit_email_html(array $context): string
{
    $lines = bus_registration_edit_email_lines($context);
    $code = (string) $context['code'];

    $html = bus_email_abertura(bus_registration_edit_email_subject($code));
    $html .= bus_email_cabecalho('Reserva alterada no painel', 'Reserva ' . $code . ' · Transporte fretado');

    $html .= '
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        . bus_email_linha('Reserva', $code, true)
        . bus_email_linha('Grupo', $context['group'])
        . bus_email_linha('Ônibus', $context['bus_number'] === null ? 'Sem ônibus' : 'Ônibus ' . $context['bus_number'])
        . '
              </table>
            </td>
          </tr>';

    $sections = [
        'Desistências' => $lines['withdrawals'],
        'Voltaram para a viagem' => $lines['reactivations'],
        'Novo responsável' => $lines['primary'] === null ? [] : [$lines['primary']],
        'Dados corrigidos' => $lines['corrections'],
        'Lugares' => $lines['seats'],
    ];
    foreach ($sections as $title => $items) {
        if ($items === []) continue;
        $html .= '
          <tr>
            <td style="padding:0 0 6px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
              ' . bus_email_e($title) . '
            </td>
          </tr>';
        foreach ($items as $item) {
            $html .= '
          <tr>
            <td style="padding:0 0 6px 12px;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.85);">
              &bull; ' . bus_email_e($item) . '
            </td>
          </tr>';
        }
        $html .= '
          <tr><td style="padding:0 0 14px;"></td></tr>';
    }

    $html .= bus_email_fechamento('Mensagem automática do painel &middot; Kriativos On Board 2026');
    return $html;
}

/** @param array $context ver bus_registration_edit_email_context */
function bus_registration_edit_email_text(array $context): string
{
    $lines = bus_registration_edit_email_lines($context);
    $out = [];
    $out[] = 'RESERVA ' . $context['code'] . ' - ALTERAÇÃO NO PAINEL';
    $out[] = str_repeat('=', 52);
    $out[] = '';
    $out[] = 'Reserva: ' . $context['code'];
    if ($context['group'] !== null) {
        $out[] = 'Grupo: ' . $context['group'];
    }
    $out[] = 'Ônibus: ' . ($context['bus_number'] === null ? 'sem ônibus' : $context['bus_number']);

    $sections = [
        'DESISTÊNCIAS' => $lines['withdrawals'],
        'VOLTARAM PARA A VIAGEM' => $lines['reactivations'],
        'NOVO RESPONSÁVEL' => $lines['primary'] === null ? [] : [$lines['primary']],
        'DADOS CORRIGIDOS' => $lines['corrections'],
        'LUGARES' => $lines['seats'],
    ];
    foreach ($sections as $title => $items) {
        if ($items === []) continue;
        $out[] = '';
        $out[] = $title;
        foreach ($items as $item) {
            $out[] = '- ' . $item;
        }
    }
    $out[] = '';
    $out[] = 'Mensagem automática do painel.';
    return implode("\r\n", $out);
}
