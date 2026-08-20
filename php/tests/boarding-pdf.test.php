<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/boarding-pdf.php';

$pdf = bus_boarding_pdf([
    [
        'code' => 'COMUM001',
        'group_name' => null,
        'contato' => 'Reserva Comum',
        'email' => '',
        'contato_whatsapp' => '',
        'pagantes' => 1,
        'criancas' => 0,
        'valor' => '120,00',
        'pago_em' => '20/08/2026 10:00',
        'order_id' => 'ORD-COMUM',
        'bus_number' => 1,
        'is_vip' => false,
        'passageiros' => [[
            'posicao' => 1,
            'nome' => 'Reserva Comum',
            'cpf' => '529.982.247-25',
            'whatsapp' => null,
            'responsavel' => true,
            'menor' => false,
            'crianca_colo' => false,
        ]],
    ],
    [
        'code' => 'VIP00001',
        'group_name' => null,
        'contato' => 'Pessoa VIP',
        'email' => '',
        'contato_whatsapp' => '',
        'pagantes' => 1,
        'criancas' => 0,
        'valor' => '0,00',
        'pago_em' => null,
        'order_id' => null,
        'bus_number' => 1,
        'is_vip' => true,
        'passageiros' => [[
            'posicao' => 1,
            'nome' => 'Pessoa VIP',
            'cpf' => '529.982.247-25',
            'whatsapp' => null,
            'responsavel' => true,
            'menor' => false,
            'crianca_colo' => false,
        ]],
    ],
    [
        'code' => 'WAIT0001',
        'group_name' => null,
        'contato' => 'Pessoa aguardando ônibus',
        'email' => '',
        'contato_whatsapp' => '',
        'pagantes' => 1,
        'criancas' => 0,
        'valor' => '0,00',
        'pago_em' => null,
        'order_id' => null,
        'bus_number' => null,
        'is_vip' => true,
        'passageiros' => [[
            'posicao' => 1,
            'nome' => 'Pessoa aguardando ônibus',
            'cpf' => '529.982.247-25',
            'whatsapp' => null,
            'responsavel' => true,
            'menor' => false,
            'crianca_colo' => false,
        ]],
    ],
], null);

if (!str_starts_with($pdf, '%PDF-1.4') || !str_ends_with(rtrim($pdf), '%%EOF')) {
    fwrite(STDERR, "FAIL: PDF sem assinatura ou EOF válido\n");
    exit(1);
}

$vipPosition = strpos($pdf, 'RESERVA VIP');
$commonPosition = strpos($pdf, 'RESERVA COMUM');
if ($vipPosition === false || $commonPosition === false || $vipPosition >= $commonPosition) {
    fwrite(STDERR, "FAIL: VIP deve aparecer antes da reserva comum\n");
    exit(1);
}
if (strpos($pdf, 'WAIT0001') !== false || strpos($pdf, 'Pessoa aguardando') !== false) {
    fwrite(STDERR, "FAIL: reserva sem ônibus não pode aparecer no PDF\n");
    exit(1);
}

fwrite(STDOUT, "PASS: boarding PDF tests\n");
