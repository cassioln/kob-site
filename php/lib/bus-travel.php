<?php

declare(strict_types=1);

/** Apenas veículos atribuídos; uma reserva em espera não tem horário próprio. */
function bus_assigned_number(array $registration): ?int
{
    if (($registration['fleet_assignment_status'] ?? 'assigned') !== 'assigned') {
        return null;
    }
    $number = filter_var($registration['bus_number'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1],
    ]);

    return $number === false ? null : $number;
}

/** Instruções compartilhadas por e-mails e comprovantes do passageiro. */
function bus_travel_details(array $dados): array
{
    $number = filter_var($dados['busNumber'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1],
    ]);
    $number = $number === false ? null : $number;
    $label = $number !== null ? 'Ônibus ' . $number : 'Ônibus a confirmar';
    $schedule = 'Horário a confirmar no grupo do fretado.';
    $punctuality = 'Confirme seu ônibus e horário no grupo do fretado antes de sair de casa.';
    $operation = 'O ônibus 1 está confirmado. O ônibus 2 e eventuais veículos adicionais dependem do mínimo de passageiros; se não for atingido, a organização devolve 100% do valor via Pix. Confirme o veículo da sua reserva no grupo do fretado.';

    if ($number === 1 || $number === 2) {
        $meeting = $number === 1 ? '06h00' : '06h40';
        $departure = $number === 1 ? '06h30' : '07h20';
        $cutoff = $number === 1 ? '06h40' : '07h30';
        $schedule = 'Encontro às ' . $meeting . ' · saída às ' . $departure;
        $punctuality = 'Chegue às ' . $meeting . ' para conferir a lista e acomodar as bagagens. Saída às ' . $departure . ', com tolerância máxima até ' . $cutoff . '; após esse limite, o veículo não poderá aguardar.';
        $operation = $number === 1
            ? 'O ônibus 1 está confirmado. A condição de quórum pendente do ônibus 2 não se aplica à sua reserva.'
            : 'O ônibus 2 depende do mínimo de passageiros para operar. Se não for atingido, a organização devolve 100% do valor pago via Pix.';
    } elseif ($number !== null) {
        $operation = 'O ônibus ' . $number . ' depende da confirmação operacional e do mínimo de passageiros. Se não for atingido, a organização devolve 100% do valor pago via Pix. Consulte o grupo do fretado.';
    }

    return [
        'label' => $label,
        'schedule' => $schedule,
        'punctuality' => $punctuality,
        'operation' => $operation,
    ];
}
