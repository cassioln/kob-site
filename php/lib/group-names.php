<?php

declare(strict_types=1);

/**
 * Nomes de grupo para reservas com 2 ou mais pessoas.
 *
 * Por que existe: dar identidade ao grupo facilita a organização chamar as
 * pessoas no embarque ("grupo Wingspan, por favor") e é mais fácil de lembrar
 * que um código hexadecimal.
 *
 * Regra: só reserva com 2+ pessoas (pagantes ou crianças de colo) recebe nome.
 * Reserva individual fica com NULL, e todo lugar que exibe o nome trata a
 * ausência como "não aplicável", nunca como erro.
 */

/**
 * Catálogo de nomes, na ordem em que foram fornecidos.
 *
 * A ordem é preservada de propósito: sortear aleatoriamente do catálogo inteiro
 * gastaria os nomes mais conhecidos junto com os obscuros de forma imprevisível.
 * O sorteio acontece ENTRE OS DISPONÍVEIS (ver bus_sortear_nome_grupo), o que
 * atende "nome aleatório" sem depender da posição na lista.
 */
function bus_catalogo_grupos(): array
{
    return [
        'The Castles of Burgundy', 'SETI', 'Projeto Gaia', 'Gloomhaven',
        'Terraforming Mars', 'Ark Nova', 'Terra Mystica', 'Mage Knight',
        'Harmonies', 'Clank!', 'Root', 'Puerto Rico', 'Spirit Island', 'Lisboa',
        'Twilight Struggle', 'Um Banquete a Odin', 'Everdell',
        'Mansions of Madness', 'Ticket to Ride', 'Zombicide', 'Scythe', 'Arnak',
        'Five Tribes', 'Caverna', 'On Mars', 'La Granja', 'Sky Team', 'Azul',
        'Tiranos da Umbreterna', '7 Wonders', 'Eclipse',
        'Agricola', 'Anachrony', 'As Viagens de Marco Polo', 'Robinson Crusoé',
        'World Wonders', 'Lords of Waterdeep', 'The White Castle', 'Stone Age',
        'El Grande', 'Teotihuacan', 'Orléans', 'Food Chain Magnate', 'Tikal',
        'Power Grid', 'Wingspan', 'Catan', 'Pandemic', 'Carcassonne', 'Dixit',
    ];
}

/**
 * Uma reserva é grupo quando tem mais de uma pessoa a bordo.
 *
 * Conta pagantes MAIS crianças de colo: o requisito diz "pagante ou não", e uma
 * mãe com bebê é um grupo de duas pessoas para quem organiza o embarque, mesmo
 * que só uma pague.
 */
function bus_e_grupo(int $pagantes, int $criancas): bool
{
    return ($pagantes + $criancas) >= 2;
}

/**
 * Escolhe e reserva um nome ainda não usado, de forma atômica.
 *
 * A atomicidade vem do UNIQUE em bus_registrations.group_name: duas reservas
 * simultâneas podem sortear o mesmo nome, mas só uma consegue gravar. A outra
 * recebe violação de unicidade e tenta o próximo. Fazer a checagem apenas com
 * SELECT antes do UPDATE deixaria exatamente essa janela aberta.
 *
 * @param callable(string): bool $tentarGravar recebe o nome e devolve true se
 *        conseguiu gravar (false em conflito de unicidade)
 * @param callable(): bool|null $abortar consultado a cada falha; se devolver
 *        true, a busca para. Serve para o chamador sinalizar "a falha não foi
 *        conflito de nome, foi outra coisa", evitando varrer o catálogo inteiro.
 */
function bus_atribuir_nome_grupo(PDO $pdo, callable $tentarGravar, ?callable $abortar = null): ?string
{
    $usados = bus_nomes_em_uso($pdo);

    $disponiveis = array_values(array_diff(bus_catalogo_grupos(), $usados));

    // Sorteia entre os disponíveis, em ordem aleatória, e tenta gravar cada um
    // até um passar. Em disputa, o perdedor cai para o próximo da mesma lista.
    shuffle($disponiveis);
    foreach ($disponiveis as $nome) {
        if ($tentarGravar($nome)) {
            return $nome;
        }
        if ($abortar !== null && $abortar()) {
            return null;
        }
    }

    // Catálogo esgotado: "Monopoly N" sequencial, como especificado. Continua a
    // partir do maior número já usado, para não repetir depois de um
    // cancelamento ter liberado um número do meio.
    $maior = 0;
    foreach ($usados as $usado) {
        if (preg_match('/^Monopoly (\d+)$/', $usado, $m)) {
            $maior = max($maior, (int) $m[1]);
        }
    }

    // O limite de tentativas evita laço infinito se algo estiver muito errado
    // (por exemplo, o gravador falhando por outro motivo que não unicidade).
    for ($i = $maior + 1; $i <= $maior + 50; $i++) {
        if ($tentarGravar('Monopoly ' . $i)) {
            return 'Monopoly ' . $i;
        }
        if ($abortar !== null && $abortar()) {
            return null;
        }
    }

    // Sem nome disponível a reserva segue válida, apenas sem apelido: bloquear
    // um pagamento confirmado por causa de um nome decorativo seria pior.
    return null;
}

/** Nomes já gravados, para saber o que sobrou do catálogo. */
function bus_nomes_em_uso(PDO $pdo): array
{
    $q = $pdo->query(
        'SELECT group_name FROM bus_registrations WHERE group_name IS NOT NULL'
    );

    return array_map('strval', array_column($q->fetchAll(PDO::FETCH_ASSOC), 'group_name'));
}
