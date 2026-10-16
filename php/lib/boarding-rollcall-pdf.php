<?php

declare(strict_types=1);

require_once __DIR__ . '/pdf.php';

function bus_rollcall_words(string $lang): array
{
    $words = [
        'pt' => ['title' => 'Chamada de embarque', 'bus' => 'Ônibus', 'outbound' => 'Ida', 'return' => 'Volta',
            'expected' => 'Esperados', 'missing' => 'Faltando', 'generated' => 'Gerado em', 'page' => 'Página',
            'vip' => 'Reservas VIP', 'solo' => 'Reservas solo', 'booking' => 'Reserva', 'passenger' => 'Passageiro', 'continued' => 'continuação',
            'yes' => 'A bordo', 'no' => 'Pendente', 'empty' => 'Nenhum passageiro neste ônibus.',
            'primary' => 'Responsável', 'lap' => 'Criança de colo'],
        'en' => ['title' => 'Boarding roll call', 'bus' => 'Bus', 'outbound' => 'Outbound', 'return' => 'Return',
            'expected' => 'Expected', 'missing' => 'Missing', 'generated' => 'Generated', 'page' => 'Page',
            'vip' => 'VIP bookings', 'solo' => 'Solo bookings', 'booking' => 'Booking', 'passenger' => 'Passenger', 'continued' => 'continued',
            'yes' => 'On board', 'no' => 'Pending', 'empty' => 'No passengers on this bus.',
            'primary' => 'Group lead', 'lap' => 'Lap child'],
        'es' => ['title' => 'Control de embarque', 'bus' => 'Autobús', 'outbound' => 'Ida', 'return' => 'Vuelta',
            'expected' => 'Esperados', 'missing' => 'Faltan', 'generated' => 'Generado', 'page' => 'Página',
            'vip' => 'Reservas VIP', 'solo' => 'Reservas individuales', 'booking' => 'Reserva', 'passenger' => 'Pasajero', 'continued' => 'continuación',
            'yes' => 'A bordo', 'no' => 'Pendiente', 'empty' => 'No hay pasajeros en este autobús.',
            'primary' => 'Responsable', 'lap' => 'Niño en brazos'],
    ];
    return $words[$lang] ?? $words['pt'];
}

/** Conservative width in base Helvetica, including long unbroken names. */
function bus_rollcall_wrap(string $text, float $width, float $size): array
{
    $limit = max(1, (int) floor($width / ($size * .65)));
    $chars = preg_split('//u', preg_replace('/\s+/u', ' ', trim($text)) ?? '', -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $lines = [];
    while (count($chars) > $limit) {
        $end = $limit;
        for ($i = $limit; $i > (int) ($limit / 2); $i--) {
            if ($chars[$i] === ' ') { $end = $i; break; }
        }
        $lines[] = trim(implode('', array_splice($chars, 0, $end)));
        while (($chars[0] ?? '') === ' ') array_shift($chars);
    }
    $lines[] = implode('', $chars);
    return $lines;
}

/** Each passenger is one indivisible measured block; group context repeats on continuation. */
function bus_rollcall_pages(array $manifest, string $lang = 'pt'): array
{
    $w = bus_rollcall_words($lang);
    $left = 42.5;
    $right = PDF_A4_LARGURA - $left;
    $bottom = 76.0;
    $pages = [];
    $sizes = array_count_values(array_column($manifest['people'], 'registration_id'));
    $buses = [];
    foreach ($manifest['people'] as $person) {
        $buses[(int) $person['bus_number']][] = $person;
    }
    ksort($buses);
    if (!$buses) $buses[0] = [];
    $generated = new DateTimeImmutable($manifest['generated_at'] ?? 'now');
    $stamp = $generated->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format($lang === 'en' ? 'm/d/Y H:i:s' : 'd/m/Y H:i:s');
    $text = static function (float $x, float $y, string $value, float $size = 10, bool $bold = false): array {
        return ['tipo' => 'texto', 'x' => $x, 'y' => $y, 'texto' => $value, 'tamanho' => $size, 'negrito' => $bold];
    };
    foreach ($buses as $number => $people) {
        $open = static function () use ($number, $people, $w, $left, $right, $stamp, $text): array {
            $blocks = [$text($left, 795, 'KRIATIVOS ON BOARD 2026', 10, true),
                $text($left, 770, $w['title'], 19, true),
                $text($left, 751, $w['generated'] . ' ' . $stamp . ' (UTC-3)', 8.5),
                $text($left, 726, $number ? $w['bus'] . ' ' . $number : $w['title'], 13, true),
                $text($left, 707, $w['expected'] . ': ' . count($people), 10, true)];
            foreach (['outbound', 'return'] as $i => $leg) {
                $present = count(array_filter($people, static fn(array $p): bool => !empty($p[$leg]['present'])));
                $blocks[] = $text($left, 691 - $i * 15, $w[$leg] . ': ' . $present . '/' . count($people)
                    . ' | ' . $w['missing'] . ': ' . (count($people) - $present), 9.5);
            }
            $blocks[] = ['tipo' => 'linha', 'x1' => $left, 'y1' => 664, 'x2' => $right, 'y2' => 664];
            $blocks[] = $text($left, 649, $w['passenger'], 9, true);
            $blocks[] = $text(405, 649, $w['outbound'], 9, true);
            $blocks[] = $text(483, 649, $w['return'], 9, true);
            return [$blocks, 630.0];
        };
        [$blocks, $y] = $open();
        if (!$people) $blocks[] = $text($left, $y, $w['empty']);
        $groups = [];
        foreach ($people as $person) {
            $key = !empty($person['vip']) ? 'vip' : ($sizes[$person['registration_id']] === 1 ? 'solo' : $person['registration_id']);
            $groups[$key][] = $person;
        }
        $priority = [];
        foreach (['vip', 'solo'] as $key) if (isset($groups[$key])) $priority[$key] = $groups[$key];
        $groups = $priority + $groups;
        foreach ($groups as $key => $members) {
            $first = $members[0];
            $title = in_array($key, ['vip', 'solo'], true) ? $w[$key] : (($first['group'] ?? '') ?: ($first['contact'] ?? $first['name']));
            $rows = [];
            foreach ($members as $person) {
                $meta = [$w['booking'] . ' ' . $person['code']];
                if (!empty($person['primary'])) $meta[] = $w['primary'];
                if (!empty($person['lap_child'])) $meta[] = $w['lap'];
                $names = bus_rollcall_wrap($person['name'], 335, 10.5);
                $details = bus_rollcall_wrap(implode(' | ', $meta), 335, 8.5);
                $rows[] = ['person' => $person, 'names' => $names, 'details' => $details,
                    'height' => max(46, count($names) * 14 + count($details) * 11 + 16)];
            }
            $heading = bus_rollcall_wrap($title, $right - $left, 11);
            $headingHeight = count($heading) * 14 + 10;
            $groupHeight = $headingHeight + array_sum(array_column($rows, 'height'));
            // Keep a complete group together when it fits one page; otherwise keep heading + first row.
            $needed = $groupHeight <= 630 - $bottom ? $groupHeight : $headingHeight + $rows[0]['height'];
            if ($y - $needed < $bottom && $y < 630) { $pages[] = $blocks; [$blocks, $y] = $open(); }
            foreach ($heading as $line) { $blocks[] = $text($left, $y, $line, 11, true); $y -= 14; }
            $y -= 10;
            foreach ($rows as $row) {
                if ($y - $row['height'] < $bottom) {
                    $pages[] = $blocks; [$blocks, $y] = $open();
                    foreach (bus_rollcall_wrap($title . ' (' . $w['continued'] . ')', $right - $left, 11) as $line) {
                        $blocks[] = $text($left, $y, $line, 11, true); $y -= 14;
                    }
                    $y -= 10;
                }
                $top = $y;
                foreach ($row['names'] as $line) { $blocks[] = $text($left, $y, $line, 10.5, true); $y -= 14; }
                foreach ($row['details'] as $line) { $blocks[] = $text($left, $y, $line, 8.5); $y -= 11; }
                foreach (['outbound', 'return'] as $i => $leg) {
                    $x = 408 + $i * 78;
                    $present = !empty($row['person'][$leg]['present']);
                    $blocks[] = ['tipo' => 'retangulo', 'x' => $x, 'y' => $top - 12, 'largura' => 13, 'altura' => 13];
                    if ($present) {
                        $blocks[] = ['tipo' => 'linha', 'x1' => $x + 2, 'y1' => $top - 10, 'x2' => $x + 11, 'y2' => $top - 1];
                        $blocks[] = ['tipo' => 'linha', 'x1' => $x + 2, 'y1' => $top - 1, 'x2' => $x + 11, 'y2' => $top - 10];
                    }
                    $blocks[] = $text($x - 6, $top - 26, $w[$present ? 'yes' : 'no'], 8);
                }
                $y = $top - $row['height'];
                $blocks[] = ['tipo' => 'linha', 'x1' => $left, 'y1' => $y + 14, 'x2' => $right, 'y2' => $y + 14, 'espessura' => .3];
            }
            $y -= 12;
        }
        $pages[] = $blocks;
    }
    foreach ($pages as $i => &$blocks) {
        $blocks[] = ['tipo' => 'linha', 'x1' => $left, 'y1' => 52, 'x2' => $right, 'y2' => 52, 'espessura' => .5];
        $blocks[] = $text($left, 37, 'Kriativos On Board 2026', 8);
        $blocks[] = $text($right - 82, 37, $w['page'] . ' ' . ($i + 1) . '/' . count($pages), 8);
    }
    return $pages;
}

function bus_rollcall_pdf(array $manifest, string $lang = 'pt'): string
{
    return pdf_montar_multipagina(bus_rollcall_pages($manifest, $lang));
}
