<?php

declare(strict_types=1);

/**
 * Como o painel e o Excel administrativo mostram a desistência.
 *
 * Funções puras, sem PDO: bus-admin-data.php e bus-admin-xlsx.php montam os
 * dados e chamam estas regras, que ficam testáveis sem MySQL.
 */

/**
 * Status da reserva na lista do painel. A desistência da reserva inteira
 * sobrepõe o status de pagamento e o VIP (o pagamento continua no Excel);
 * depois vem o VIP, e por fim o status de pagamento já traduzido.
 *
 * @param array{chave: string, rotulo: string, tom: string} $pagamento
 * @return array{chave: string, rotulo: string, tom: string}
 */
function bus_admin_reserva_status(array $pagamento, bool $isVip, bool $desistente): array
{
    if ($desistente) {
        return ['chave' => 'desistente', 'rotulo' => 'Desistente', 'tom' => 'falha'];
    }
    if ($isVip) {
        return ['chave' => 'vip', 'rotulo' => 'Reserva VIP', 'tom' => 'vip'];
    }

    return $pagamento;
}

/**
 * Texto da coluna "Desistência" do Excel: "Desistiu em dd/mm/aaaa hh:mm" e,
 * quando houver, " · motivo". Vazio para passageiro ativo.
 *
 * @param ?string $desistiuEm data já formatada em São Paulo (dd/mm/aaaa hh:mm)
 */
function bus_withdrawal_cell_text(bool $desistiu, ?string $desistiuEm, ?string $motivo): string
{
    if (!$desistiu) {
        return '';
    }
    $texto = 'Desistiu';
    if ($desistiuEm !== null && $desistiuEm !== '') {
        $texto .= ' em ' . $desistiuEm;
    }
    $motivo = trim((string) $motivo);
    if ($motivo !== '') {
        $texto .= ' · ' . $motivo;
    }

    return $texto;
}

/**
 * Passageiros que aparecem nos cards da frota, no formato que o front já usa.
 * Desistente pagante (adulto ou menor de 6 a 17 anos) continua na lista com
 * `desistiu: true`, para o card pintar o meeple de vermelho e o tooltip
 * mostrar "Desistência". Criança de colo que desistiu simplesmente some.
 * Recebe os passageiros já montados por bus-admin-data.php.
 *
 * @param list<array> $passageiros
 * @return list<array{posicao: int, nome: string, responsavel: bool, menor: bool, crianca_colo: bool, faixa: string, desistiu: bool}>
 */
function bus_admin_fleet_passengers(array $passageiros): array
{
    $lista = [];
    foreach ($passageiros as $p) {
        $desistiu = !empty($p['desistiu']);
        if ($desistiu && !empty($p['crianca_colo'])) {
            continue;
        }
        $lista[] = [
            'posicao' => (int) $p['posicao'],
            'nome' => (string) $p['nome'],
            'responsavel' => (bool) $p['responsavel'],
            'menor' => (bool) $p['menor'],
            'crianca_colo' => (bool) $p['crianca_colo'],
            'faixa' => $p['crianca_colo'] ? '0 a 5 anos' : ($p['menor'] ? '6 a 17 anos' : '18 anos ou mais'),
            'desistiu' => $desistiu,
        ];
    }

    return $lista;
}

/**
 * Quantos passageiros pagantes (não são criança de colo) da lista já montada
 * por bus_admin_fleet_passengers() desistiram: vira o campo `desistentes` do
 * card da frota.
 *
 * @param list<array> $passageirosFrota
 */
function bus_admin_fleet_withdrawn_count(array $passageirosFrota): int
{
    $total = 0;
    foreach ($passageirosFrota as $p) {
        if (!empty($p['desistiu']) && empty($p['crianca_colo'])) {
            $total++;
        }
    }

    return $total;
}
