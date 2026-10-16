<?php

declare(strict_types=1);

require_once __DIR__ . '/xlsx.php';
require_once __DIR__ . '/boarding-rollcall-pdf.php';

function bus_rollcall_xlsx(array $manifest, string $lang = 'pt'): string
{
    $w = bus_rollcall_words($lang);
    $labels = [
        'pt' => ['group' => 'Grupo', 'time' => 'Horário', 'solo' => 'Reservas solo', 'all' => 'Todos os ônibus'],
        'en' => ['group' => 'Group', 'time' => 'Time', 'solo' => 'Solo bookings', 'all' => 'All buses'],
        'es' => ['group' => 'Grupo', 'time' => 'Hora', 'solo' => 'Reservas individuales', 'all' => 'Todos los autobuses'],
    ][$lang] ?? ['group' => 'Grupo', 'time' => 'Horário', 'solo' => 'Reservas solo', 'all' => 'Todos os ônibus'];
    $sizes = array_count_values(array_column($manifest['people'], 'registration_id'));
    $rows = [];
    foreach ($manifest['people'] as $person) {
        $cells = [(string) $person['bus_number'], !empty($person['vip']) ? $w['vip'] : ($sizes[$person['registration_id']] === 1 ? $labels['solo'] : ($person['group'] ?: $person['contact'])),
            $person['code'], $person['name']];
        foreach (['outbound', 'return'] as $leg) {
            $present = !empty($person[$leg]['present']);
            $cells[] = ['v' => $w[$present ? 'yes' : 'no'], 'estilo' => $present ? 'status_ok' : 'status_espera'];
            $stamp = $person[$leg]['checked_at'] ?? null;
            $cells[] = $present && $stamp ? (new DateTimeImmutable($stamp))->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format($lang === 'en' ? 'm/d/Y H:i:s' : 'd/m/Y H:i:s') : '';
        }
        $rows[] = ['estilo' => !empty($person['vip']) ? 'vip' : 'normal', 'celulas' => $cells];
    }
    $columns = [];
    foreach ([[$w['bus'], 10], [$labels['group'], 28], [$w['booking'], 14], [$w['passenger'], 42],
        [$w['outbound'], 16], [$labels['time'] . ' · ' . $w['outbound'], 23],
        [$w['return'], 16], [$labels['time'] . ' · ' . $w['return'], 23]] as [$title, $width]) {
        $columns[] = ['titulo' => $title, 'largura' => $width];
    }
    $stamp = (new DateTimeImmutable($manifest['generated_at'] ?? 'now'))->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format($lang === 'en' ? 'm/d/Y H:i:s' : 'd/m/Y H:i:s');
    return xlsx_build(['nome' => $w['title'], 'titulo' => 'Kriativos On Board 2026 · ' . $w['title'],
        'subtitulo' => $labels['all'] . ' · ' . $w['expected'] . ': ' . count($rows) . ' · ' . $w['generated'] . ' ' . $stamp . ' (UTC-3)',
        'colunas' => $columns, 'linhas' => $rows ?: [['estilo' => 'normal', 'celulas' => [$w['empty']]]]]);
}
