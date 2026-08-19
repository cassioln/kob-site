<?php

declare(strict_types=1);

/**
 * Auto-aloca uma reserva em um ônibus que tenha vaga.
 *
 * Chamado pelo webhook ou conciliação assim que a reserva muda para 'confirmed'.
 */
function bus_assign_fleet(PDO $pdo, string $registrationId): void
{
    $find = $pdo->prepare('SELECT status, bus_number, passenger_count, children_count FROM bus_registrations WHERE id = :id');
    $find->execute([':id' => $registrationId]);
    $reserva = $find->fetch(PDO::FETCH_ASSOC);

    if (!$reserva || $reserva['status'] !== 'confirmed' || $reserva['bus_number'] !== null) {
        return; // Não está confirmada ou já tem ônibus
    }

    $tamanho = (int) $reserva['passenger_count'] + (int) $reserva['children_count'];
    
    // Ler todos os ônibus que já existem e suas capacidades
    $q = $pdo->query('
        SELECT bus_number, SUM(passenger_count + children_count) as ocupacao
          FROM bus_registrations
         WHERE status = "confirmed" AND bus_number IS NOT NULL
         GROUP BY bus_number
         ORDER BY bus_number ASC
    ');
    $onibus = $q->fetchAll(PDO::FETCH_ASSOC);
    
    $ocupacao = [];
    foreach ($onibus as $o) {
        $ocupacao[(int) $o['bus_number']] = (int) $o['ocupacao'];
    }

    $busNum = 1;
    while (true) {
        $current = $ocupacao[$busNum] ?? 0;
        if ($current + $tamanho <= 46) {
            break;
        }
        $busNum++;
    }

    $update = $pdo->prepare('UPDATE bus_registrations SET bus_number = :bus WHERE id = :id');
    $update->execute([':bus' => $busNum, ':id' => $registrationId]);
}
