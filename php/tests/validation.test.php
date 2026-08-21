<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/validation.php';

function validation_expect_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function validation_expect_throws(callable $callable, string $message): void
{
    try {
        $callable();
    } catch (ValidationError) {
        return;
    }

    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

validation_expect_same(
    'Samara Nascimento de Toledo',
    normalize_person_name('  SAMARA   NASCIMENTO DE TOLEDO  ', 'Nome'),
    'nome canônico'
);
validation_expect_same(
    'Ana Maria-Das Dores',
    normalize_person_name('ANA MARIA-DAS DORES', 'Nome'),
    'nome com hífen e conector'
);
validation_expect_same('usuario@email.com', normalize_email(' USUARIO@EMAIL.COM '), 'e-mail minúsculo');
validation_expect_same('11999998888', normalize_whatsapp('(11) 99999-8888'), 'celular nacional');
validation_expect_same('11999998888', normalize_whatsapp('5511999998888'), 'celular com DDI');
validation_expect_same('1132345678', normalize_whatsapp('(11) 3234-5678'), 'telefone fixo');
validation_expect_throws(fn () => normalize_whatsapp('55119958957'), 'WhatsApp incompleto');
validation_expect_throws(fn () => normalize_whatsapp('11112345678'), 'celular sem prefixo 9');
validation_expect_throws(fn () => normalize_whatsapp('0011999998888'), 'DDD inválido');

fwrite(STDOUT, "PASS: validation tests\n");
