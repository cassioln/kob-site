<?php

declare(strict_types=1);

/**
 * Envia os e-mails de uma reserva paga.
 *
 * Três destinatários, com conteúdos diferentes de propósito:
 *
 *  1. CONTATO PRINCIPAL: comprovante em PDF anexo, resumo, nome do grupo e link
 *     do grupo de WhatsApp. É quem pagou, então é o único que recebe dado de
 *     pagamento.
 *  2. PASSAGEIROS ADICIONAIS que informaram e-mail: resumo, nome do grupo, quem
 *     é o responsável e o link do grupo. SEM QR Code, SEM código de pagamento e
 *     SEM comprovante: esses dados pertencem a quem pagou.
 *  3. administrativo@: ficha completa da reserva para a organização, incluindo
 *     CPF e transação.
 *
 * Chamado pelo webhook e pela reconciliação quando o status vira `confirmed`.
 */

/**
 * Caminhos: este arquivo vive em `php/mysql/lib/`, então `__DIR__` é
 * `php/mysql/lib`, `dirname(__DIR__)` é `php/mysql` e só `dirname(__DIR__, 2)`
 * chega em `php/`. Usar um nível a menos aponta para `php/mysql/lib/...`, que
 * não existe — foi exatamente o erro que derrubou a consulta de status.
 */
require_once dirname(__DIR__, 2) . '/lib/validation.php';
require_once __DIR__ . '/db.php';
require_once dirname(__DIR__, 2) . '/lib/smtp.php';
require_once dirname(__DIR__, 2) . '/lib/receipt-pdf.php';
require_once dirname(__DIR__, 2) . '/lib/confirmation-email.php';
require_once dirname(__DIR__, 2) . '/lib/passenger-email.php';
require_once dirname(__DIR__, 2) . '/lib/admin-email.php';

/** Destinatário fixo da notificação administrativa. */
const BUS_EMAIL_ADMIN = 'administrativo@kriativosonboard.com.br';

/**
 * Envia uma mensagem com retry curto.
 *
 * O SMTP da Locaweb aplica limite por janela de tempo. Medido: envios em
 * sequência recebem `451 4.3.0 queue file write error` ou fecham a conexão no
 * RCPT TO, de forma INCONSISTENTE — o mesmo conteúdo que falha passa minutos
 * depois. Conteúdo malformado falharia sempre igual; isso não é o caso.
 *
 * Como esta reserva pode disparar vários e-mails (contato + adicionais + admin),
 * o espaçamento entre eles importa: enviar tudo em rajada é o que provoca o 451.
 */
function bus_enviar_com_retry(
    array $config,
    string $para,
    string $nome,
    string $assunto,
    string $html,
    string $texto,
    array $anexos = []
): void {
    $ultimoErro = null;
    foreach ([0, 6] as $espera) {
        if ($espera > 0) {
            sleep($espera);
        }
        try {
            smtp_send($config, $para, $nome, $assunto, $html, $texto, $anexos);

            return;
        } catch (SmtpError $erro) {
            $ultimoErro = $erro;
        }
    }
    if ($ultimoErro !== null) {
        throw $ultimoErro;
    }
}

/**
 * Carrega a reserva e monta os dados usados por todos os e-mails.
 *
 * @return array{ok: bool, motivo?: string, dados?: array, email?: string, passageiros?: array}
 */
function bus_confirmation_payload(PDO $pdo, string $registrationId): array
{
    $q = $pdo->prepare(
        'SELECT id, status, email, primary_name, primary_cpf, whatsapp,
                passenger_count, children_count, group_name,
                amount_cents, mercadopago_order_id, mercadopago_payment_id,
                confirmation_email_sent_at, admin_email_sent_at,
                DATE_FORMAT(CONVERT_TZ(paid_at, "+00:00", "-03:00"), "%d/%m/%Y às %H:%i") AS pago_em
           FROM bus_registrations
          WHERE id = :id
          LIMIT 1'
    );
    $q->execute([':id' => $registrationId]);
    $reg = $q->fetch(PDO::FETCH_ASSOC);

    if (!$reg) {
        return ['ok' => false, 'motivo' => 'nao_encontrado'];
    }
    // Só confirmada: enviar antes do pagamento seria prometer vaga sem lastro.
    if ($reg['status'] !== 'confirmed') {
        return ['ok' => false, 'motivo' => 'nao_confirmada'];
    }

    $qp = $pdo->prepare(
        'SELECT `position`, full_name, cpf, whatsapp, email, is_primary,
                confirmation_email_sent_at
           FROM bus_passengers
          WHERE registration_id = :id ORDER BY `position`'
    );
    $qp->execute([':id' => $registrationId]);
    $linhas = $qp->fetchAll(PDO::FETCH_ASSOC);

    $passageiros = [];
    foreach ($linhas as $p) {
        $passageiros[] = [
            'position' => (int) $p['position'],
            'name' => (string) $p['full_name'],
            'cpf' => bus_format_cpf((string) $p['cpf']),
            'whatsapp' => ($p['whatsapp'] ?? '') !== ''
                ? bus_format_phone((string) $p['whatsapp']) : null,
            'email' => $p['email'] ?? null,
            'isPrimary' => (int) $p['is_primary'] === 1,
            'emailSentAt' => $p['confirmation_email_sent_at'] ?? null,
        ];
    }

    $grupo = ($reg['group_name'] ?? '') !== '' ? (string) $reg['group_name'] : null;

    return [
        'ok' => true,
        'email' => (string) $reg['email'],
        'jaEnviadoContato' => !empty($reg['confirmation_email_sent_at']),
        'jaEnviadoAdmin' => !empty($reg['admin_email_sent_at']),
        'passageiros' => $passageiros,
        'dados' => [
            'code' => strtoupper(substr((string) $reg['id'], 0, 8)),
            'orderId' => $reg['mercadopago_order_id'],
            'paymentId' => $reg['mercadopago_payment_id'],
            'amount' => number_format(((int) $reg['amount_cents']) / 100, 2, '.', ''),
            'passengerCount' => (int) $reg['passenger_count'],
            'childrenCount' => (int) $reg['children_count'],
            'groupName' => $grupo,
            'contactName' => (string) $reg['primary_name'],
            'contactCpf' => bus_format_cpf((string) $reg['primary_cpf']),
            'contactEmail' => (string) $reg['email'],
            'contactWhatsapp' => bus_format_phone((string) $reg['whatsapp']),
            // DOIS conjuntos de passageiros, de propósito. A blindagem contra
            // vazamento não pode depender de o template "escolher não imprimir"
            // um campo: qualquer alteração futura, um log de exceção que serialize
            // $dados, ou um esquecimento passariam a expor CPF e e-mail de todos
            // os passageiros a um único destinatário.
            //
            // `passengers` é o conjunto MÍNIMO (só nome, telefone e quem é o
            // responsável) e vai para os e-mails do cliente. `passengersAdmin`
            // tem CPF e e-mail, e só o admin-email.php usa.
            'passengers' => array_map(
                static fn ($p) => [
                    'name' => $p['name'],
                    'whatsapp' => $p['whatsapp'],
                    'isPrimary' => $p['isPrimary'],
                ],
                $passageiros
            ),
            'passengersAdmin' => array_map(
                static fn ($p) => [
                    'name' => $p['name'],
                    'whatsapp' => $p['whatsapp'],
                    'cpf' => $p['cpf'],
                    'email' => $p['email'],
                    'isPrimary' => $p['isPrimary'],
                ],
                $passageiros
            ),
            'issuedAt' => (string) ($reg['pago_em'] ?? gmdate('d/m/Y \à\s H:i')),
        ],
    ];
}

/**
 * Envia todos os e-mails da reserva, cada um no máximo uma vez.
 *
 * Falha em um destinatário NÃO impede os outros: se o e-mail do passageiro 3
 * falhar, o contato principal e a organização já receberam, e só o que faltou é
 * retentado numa próxima passagem. Por isso cada envio tem sua própria marca.
 */
function bus_send_confirmation_email(PDO $pdo, array $config, string $registrationId): array
{
    $prep = bus_confirmation_payload($pdo, $registrationId);
    if (!$prep['ok']) {
        return $prep;
    }

    $dados = $prep['dados'];
    $resultado = [
        'ok' => true,
        'code' => $dados['code'],
        'contato' => 'ja_enviado',
        'passageiros' => [],
        'admin' => 'ja_enviado',
    ];
    $erros = [];

    // ---- 1. Contato principal: com comprovante em PDF anexo ----------------
    if (!$prep['jaEnviadoContato']) {
        try {
            bus_enviar_com_retry(
                $config,
                $prep['email'],
                $dados['contactName'],
                'Reserva confirmada · Ônibus Kriativos On Board 2026',
                bus_confirmation_email_html($dados),
                bus_confirmation_email_text($dados),
                [[
                    'nome' => 'comprovante-' . $dados['code'] . '.pdf',
                    'tipo' => 'application/pdf',
                    'conteudo' => bus_receipt_pdf($dados),
                ]]
            );

            // Marca DEPOIS do envio: se o SMTP falhar, a próxima tentativa
            // reenvia em vez de considerar entregue algo que não saiu.
            $pdo->prepare(
                'UPDATE bus_registrations SET confirmation_email_sent_at = UTC_TIMESTAMP()
                  WHERE id = :id'
            )->execute([':id' => $registrationId]);

            $resultado['contato'] = 'enviado';
        } catch (Throwable $e) {
            $resultado['contato'] = 'falhou';
            $erros[] = 'contato: ' . $e->getMessage();
        }
    }

    // ---- 2. Passageiros adicionais que informaram e-mail -------------------
    $marcarPassageiro = $pdo->prepare(
        'UPDATE bus_passengers SET confirmation_email_sent_at = UTC_TIMESTAMP()
          WHERE registration_id = :id AND `position` = :pos'
    );

    foreach ($prep['passageiros'] as $p) {
        // O passageiro 1 é o contato principal: já recebeu o e-mail completo,
        // com comprovante. Mandar a versão reduzida também seria e-mail dobrado.
        if ($p['isPrimary']) {
            continue;
        }
        if (($p['email'] ?? '') === '') {
            $resultado['passageiros'][] = ['pos' => $p['position'], 'status' => 'sem_email'];
            continue;
        }
        if (!empty($p['emailSentAt'])) {
            $resultado['passageiros'][] = ['pos' => $p['position'], 'status' => 'ja_enviado'];
            continue;
        }

        try {
            bus_enviar_com_retry(
                $config,
                (string) $p['email'],
                $p['name'],
                'Sua vaga no ônibus está confirmada · Kriativos On Board 2026',
                bus_passenger_email_html($dados, $p['name']),
                bus_passenger_email_text($dados, $p['name'])
            );

            $marcarPassageiro->execute([':id' => $registrationId, ':pos' => $p['position']]);
            $resultado['passageiros'][] = ['pos' => $p['position'], 'status' => 'enviado'];
        } catch (Throwable $e) {
            $resultado['passageiros'][] = ['pos' => $p['position'], 'status' => 'falhou'];
            $erros[] = 'passageiro ' . $p['position'] . ': ' . $e->getMessage();
        }
    }

    // ---- 3. Notificação administrativa -------------------------------------
    if (!$prep['jaEnviadoAdmin']) {
        try {
            $valorFormatado = number_format((float) $dados['amount'], 2, ',', '.');
            $assuntoAdmin = sprintf(
                '[Fretado KOB] Novo Pagamento: R$ %s - Reserva %s (%s)',
                $valorFormatado,
                $dados['code'],
                $dados['contactName']
            );

            bus_enviar_com_retry(
                $config,
                BUS_EMAIL_ADMIN,
                'Administrativo Kriativos On Board',
                $assuntoAdmin,
                bus_admin_email_html($dados),
                bus_admin_email_text($dados)
            );

            $pdo->prepare(
                'UPDATE bus_registrations SET admin_email_sent_at = UTC_TIMESTAMP()
                  WHERE id = :id'
            )->execute([':id' => $registrationId]);

            $resultado['admin'] = 'enviado';
        } catch (Throwable $e) {
            $resultado['admin'] = 'falhou';
            $erros[] = 'admin: ' . $e->getMessage();
        }
    }

    if ($erros) {
        // Registra o que falhou, mas não lança: o que saiu já está marcado, e
        // lançar aqui faria o chamador tratar como falha total.
        log_failure('confirmation-mailer', new RuntimeException(implode(' | ', $erros)));
        $resultado['erros'] = $erros;
    }

    return $resultado;
}
