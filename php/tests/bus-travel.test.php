<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/receipt-pdf.php';
require_once __DIR__ . '/../lib/confirmation-email.php';
require_once __DIR__ . '/../lib/passenger-email.php';

function travel_expect(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

travel_expect(bus_assigned_number(['bus_number' => '2', 'fleet_assignment_status' => 'assigned']) === 2, 'número do banco é normalizado');
travel_expect(bus_assigned_number(['bus_number' => 1, 'fleet_assignment_status' => 'waiting']) === null, 'espera não atribui veículo');
foreach ([null, 0, -1, 'invalid'] as $invalid) {
    travel_expect(bus_assigned_number(['bus_number' => $invalid]) === null, 'atribuição inválida não inventa ônibus');
}

$fixture = [
    'code' => 'TEST0001', 'orderId' => 'ORD_TEST', 'amount' => '120.00',
    'passengerCount' => 1, 'childrenCount' => 0, 'contactName' => 'Pessoa de Teste',
    'contactWhatsapp' => '(11) 99999-0000', 'groupName' => null,
    'passengers' => [['name' => 'Pessoa de Teste', 'whatsapp' => null]],
    'issuedAt' => '03/10/2026 às 18:00',
];

foreach ([1, 2, null, 3] as $number) {
    $dados = $fixture + ['busNumber' => $number];
    $outputs = [
        bus_confirmation_email_html($dados), bus_confirmation_email_text($dados),
        bus_passenger_email_html($dados, 'Pessoa de Teste'), bus_passenger_email_text($dados, 'Pessoa de Teste'),
        iconv('Windows-1252', 'UTF-8', bus_receipt_pdf($dados)),
    ];
    foreach ($outputs as $output) {
        $label = $number === null ? 'Ônibus a confirmar' : 'Ônibus ' . $number;
        travel_expect(str_contains($output, $label), 'todos os canais identificam o veículo ou a pendência');
        if ($number === 1) {
            travel_expect(str_contains($output, '06h00') && str_contains($output, '06h30'), 'ônibus 1 recebe seu horário');
            travel_expect(!str_contains($output, '07h20'), 'ônibus 1 não recebe horário do segundo');
            travel_expect(str_contains($output, 'ônibus 1 está confirmado'), 'ônibus 1 recebe confirmação operacional');
        } elseif ($number === 2) {
            travel_expect(str_contains($output, '06h40') && str_contains($output, '07h20'), 'ônibus 2 recebe seu horário');
            travel_expect(!str_contains($output, '06h00'), 'ônibus 2 não recebe horário do primeiro');
            travel_expect(str_contains($output, 'depende do mínimo'), 'ônibus 2 continua condicionado ao quórum');
        } else {
            travel_expect(str_contains($output, 'confirmar'), 'horário desconhecido exige consulta');
            travel_expect(!str_contains($output, '06h00') && !str_contains($output, '07h20'), 'horário desconhecido não é inventado');
        }
        travel_expect(!str_contains($output, 'vaga está garantida'), 'pagamento não promete operação sem quórum');
    }
    $passenger = bus_passenger_email_text($dados, 'Pessoa de Teste');
    travel_expect(!str_contains($passenger, 'ORD_TEST') && !str_contains($passenger, '120,00'), 'passageiro adicional não recebe dados de pagamento');
}

fwrite(STDOUT, "PASS: bus travel instructions, assignment and passenger privacy\n");
