<?php

declare(strict_types=1);

/**
 * Envia o e-mail de confirmação de uma reserva paga (1x por reserva).
 *
 * Chamado internamente pelo webhook e pela reconciliação, no momento em que o
 * status vira `confirmed`. Não é um endpoint público: exige o token da
 * organização, porque disparar e-mail é ação com efeito externo.
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

/**
 * Carrega a reserva e monta os dados do comprovante.
 *
 * @return array{ok: bool, motivo?: string, dados?: array, email?: string}
 */
function bus_confirmation_payload(PDO $pdo, string $registrationId): array
{
    $q = $pdo->prepare(
        'SELECT id, status, email, primary_name, whatsapp, passenger_count, children_count,
                amount_cents, mercadopago_order_id, confirmation_email_sent_at,
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
    // Idempotência: reentrega de webhook não pode gerar segundo e-mail.
    if (!empty($reg['confirmation_email_sent_at'])) {
        return ['ok' => false, 'motivo' => 'ja_enviado'];
    }

    $qp = $pdo->prepare(
        'SELECT full_name, whatsapp FROM bus_passengers
          WHERE registration_id = :id ORDER BY `position`'
    );
    $qp->execute([':id' => $registrationId]);
    $passageiros = [];
    foreach ($qp->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $passageiros[] = ['name' => $p['full_name'], 'whatsapp' => $p['whatsapp']];
    }

    return [
        'ok' => true,
        'email' => (string) $reg['email'],
        'dados' => [
            'code' => strtoupper(substr((string) $reg['id'], 0, 8)),
            'orderId' => $reg['mercadopago_order_id'],
            'amount' => number_format(((int) $reg['amount_cents']) / 100, 2, '.', ''),
            'passengerCount' => (int) $reg['passenger_count'],
            'childrenCount' => (int) $reg['children_count'],
            'contactName' => (string) $reg['primary_name'],
            'contactWhatsapp' => $reg['whatsapp'],
            'passengers' => $passageiros,
            'issuedAt' => (string) ($reg['pago_em'] ?? gmdate('d/m/Y \à\s H:i')),
        ],
    ];
}

/**
 * Envia e marca como enviado. Devolve o motivo quando não envia.
 */
function bus_send_confirmation_email(PDO $pdo, array $config, string $registrationId): array
{
    $prep = bus_confirmation_payload($pdo, $registrationId);
    if (!$prep['ok']) {
        return $prep;
    }

    $dados = $prep['dados'];
    $pdf = bus_receipt_pdf($dados);
    $html = bus_confirmation_email_html($dados);
    $texto = bus_confirmation_email_text($dados);
    $assunto = 'Reserva confirmada · Ônibus Kriativos On Board 2026';
    $anexos = [[
        'nome' => 'comprovante-' . $dados['code'] . '.pdf',
        'tipo' => 'application/pdf',
        'conteudo' => $pdf,
    ]];

    // O SMTP da Locaweb aplica limite por janela de tempo. Medido: envios em
    // sequência recebem `451 4.3.0 queue file write error` ou fecham a conexão no
    // RCPT TO, de forma INCONSISTENTE — o mesmo conteúdo que falha passa minutos
    // depois. Conteúdo malformado falharia sempre igual; isso não é o caso.
    //
    // Duas tentativas com espera curta cobrem o caso comum sem prender a
    // requisição. Se ainda falhar, a exceção sobe e o chamador registra: a marca
    // de "enviado" só é gravada depois do sucesso, então uma consulta de status
    // posterior tenta de novo.
    $ultimoErro = null;
    foreach ([0, 6] as $espera) {
        if ($espera > 0) {
            sleep($espera);
        }
        try {
            smtp_send($config, $prep['email'], $dados['contactName'], $assunto, $html, $texto, $anexos);
            $ultimoErro = null;
            break;
        } catch (SmtpError $erro) {
            $ultimoErro = $erro;
        }
    }
    if ($ultimoErro !== null) {
        throw $ultimoErro;
    }

    // Marca DEPOIS do envio: se o SMTP falhar, a próxima tentativa reenvia em
    // vez de considerar entregue algo que não saiu.
    $pdo->prepare(
        'UPDATE bus_registrations SET confirmation_email_sent_at = UTC_TIMESTAMP() WHERE id = :id'
    )->execute([':id' => $registrationId]);

    return ['ok' => true, 'enviado_para' => $prep['email'], 'code' => $dados['code']];
}
