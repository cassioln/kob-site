<?php

declare(strict_types=1);

/**
 * Atribui o nome do grupo a uma reserva confirmada.
 *
 * POR QUE NA CONFIRMAÇÃO, e não na criação da reserva: os nomes são finitos (51)
 * e não podem repetir. Se cada tentativa de pagamento reservasse um nome, uma
 * pessoa que gera Pix três vezes e não paga queimaria três nomes do catálogo
 * para sempre. Atribuir só quando o dinheiro entra garante que todo nome em uso
 * corresponde a um grupo que realmente embarca.
 */

/**
 * Caminho com DOIS níveis: este arquivo vive em `php/mysql/lib/`, então
 * `dirname(__DIR__)` é `php/mysql` e só `dirname(__DIR__, 2)` chega em `php/`.
 * Usar um nível a menos aponta para `php/mysql/lib/group-names.php`, que não
 * existe, e derruba o endpoint com erro fatal. Já errei isso uma vez aqui.
 */
require_once dirname(__DIR__, 2) . '/lib/group-names.php';

/**
 * Garante que a reserva tenha nome de grupo, se ela for elegível.
 *
 * Idempotente: chamado de novo numa reserva que já tem nome, devolve o nome
 * existente sem sortear outro. Isso importa porque webhook e reconciliação podem
 * confirmar a mesma reserva quase ao mesmo tempo.
 *
 * @return string|null nome do grupo, ou null para reserva individual
 */
function bus_garantir_nome_grupo(PDO $pdo, string $registrationId): ?string
{
    $q = $pdo->prepare(
        'SELECT group_name, passenger_count, children_count
           FROM bus_registrations WHERE id = :id LIMIT 1'
    );
    $q->execute([':id' => $registrationId]);
    $reserva = $q->fetch(PDO::FETCH_ASSOC);

    if (!$reserva) {
        return null;
    }

    // Já tem nome: devolve o que está lá. Sortear de novo trocaria o nome de um
    // grupo que talvez já recebeu o e-mail com o nome antigo.
    if (($reserva['group_name'] ?? null) !== null && $reserva['group_name'] !== '') {
        return (string) $reserva['group_name'];
    }

    $pagantes = (int) $reserva['passenger_count'];
    $criancas = (int) $reserva['children_count'];

    if (!bus_e_grupo($pagantes, $criancas)) {
        return null;
    }

    // O gravador tenta o UPDATE e trata violação de unicidade como "esse nome já
    // foi tomado", devolvendo false para a lib tentar o próximo. É isso que torna
    // a atribuição segura sob concorrência: o UNIQUE do banco é o árbitro.
    $update = $pdo->prepare(
        'UPDATE bus_registrations
            SET group_name = :nome
          WHERE id = :id AND group_name IS NULL'
    );

    // Distingue os dois motivos de falha. Sem isso, uma corrida na MESMA reserva
    // (outra execução já gravou) faria a lib sortear nome após nome até esgotar o
    // catálogo, porque todo UPDATE devolveria rowCount 0.
    $jaPreenchidaPorOutro = false;

    $gravar = function (string $nome) use ($update, $registrationId, &$jaPreenchidaPorOutro): bool {
        try {
            $update->execute([':nome' => $nome, ':id' => $registrationId]);
            if ($update->rowCount() > 0) {
                return true;
            }
            // rowCount 0 sem exceção: a cláusula `group_name IS NULL` não casou,
            // ou seja, outra execução preencheu esta reserva. Não é conflito de
            // nome, então sinaliza para interromper a busca.
            $jaPreenchidaPorOutro = true;

            return false;
        } catch (PDOException $e) {
            // 23000 = violação de integridade. Aqui só pode ser o UNIQUE do
            // group_name, então significa "nome tomado, tente outro".
            if ($e->getCode() === '23000') {
                return false;
            }
            throw $e;
        }
    };

    // O terceiro argumento interrompe a busca quando a falha nao foi conflito de
    // nome: sem ele, uma corrida na mesma reserva varreria o catalogo inteiro.
    $nome = bus_atribuir_nome_grupo($pdo, $gravar, static function () use (&$jaPreenchidaPorOutro): bool {
        return $jaPreenchidaPorOutro;
    });

    if ($nome === null && $jaPreenchidaPorOutro) {
        // Perdeu a corrida: lê o nome que o vencedor gravou, para o chamador
        // (e-mail, comprovante) usar o mesmo nome que ficou no banco.
        $q->execute([':id' => $registrationId]);
        $atual = $q->fetch(PDO::FETCH_ASSOC);
        $gravado = $atual['group_name'] ?? null;

        return ($gravado !== null && $gravado !== '') ? (string) $gravado : null;
    }

    return $nome;
}
