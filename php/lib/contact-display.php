<?php

declare(strict_types=1);

/**
 * Escolhe o rótulo de apresentação para um contato ausente.
 *
 * O banco continua guardando NULL/vazio quando a pessoa não informa o campo.
 * "N/A" fica reservado para situações em que o contato não se aplica, como
 * telefone de criança de colo; nos demais casos a ausência é uma informação
 * válida para a operação e aparece como "Não informado".
 */
function bus_missing_contact_label(mixed $value, bool $notApplicable): string
{
    if ($notApplicable) {
        return 'N/A';
    }

    $text = trim((string) ($value ?? ''));
    return $text === '' ? 'Não informado' : $text;
}
