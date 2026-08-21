<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/contact-display.php';

function contact_display_expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

contact_display_expect_same(
    'Não informado',
    bus_missing_contact_label('', false),
    'vazio aplicável'
);
contact_display_expect_same(
    'Não informado',
    bus_missing_contact_label(null, false),
    'nulo aplicável'
);
contact_display_expect_same(
    'N/A',
    bus_missing_contact_label('', true),
    'vazio não aplicável'
);
contact_display_expect_same(
    'usuario@email.com',
    bus_missing_contact_label('  usuario@email.com  ', false),
    'valor preenchido'
);

fwrite(STDOUT, "PASS: contact display tests\n");
