<?php

declare(strict_types=1);

/**
 * Notificação administrativa: pagamento confirmado.
 *
 * Vai para administrativo@kriativosonboard.com.br a cada pagamento aprovado.
 *
 * Diferente dos e-mails do cliente, aqui o CPF APARECE: é uma caixa interna da
 * organização, e o CPF é o que permite conferir o passageiro no embarque. Nos
 * e-mails que circulam com o cliente o CPF fica fora, porque comprovante costuma
 * ser encaminhado e fotografado.
 *
 * Também não leva o botão do grupo de WhatsApp: quem trabalha na organização já
 * está no grupo, e o botão só ocuparia espaço acima dos dados que importam.
 */

require_once __DIR__ . '/email-parts.php';

function bus_admin_email_html(array $dados): string
{
    $e = static fn (?string $v): string => bus_email_e($v);

    $html = bus_email_abertura(
        'Reserva ' . $dados['code'] . ' - pagamento confirmado, R$ ' . $dados['amount']
    );

    $html .= bus_email_cabecalho(
        'Pagamento confirmado',
        'Reserva ' . $dados['code'] . ' · Transporte fretado'
    );

    // Faixa de destaque com os três dados que a organização olha primeiro:
    // qual reserva, quanto entrou e qual grupo.
    $html .= '
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(41,195,245,0.10);border:1px solid rgba(41,195,245,0.28);border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font:400 11px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.6);">RESERVA</td>
                        <td style="text-align:right;font:400 11px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.6);">VALOR PAGO</td>
                      </tr>
                      <tr>
                        <td style="padding-top:4px;font:700 22px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.04em;">
                          ' . $e($dados['code']) . '
                        </td>
                        <td style="padding-top:4px;text-align:right;font:700 22px/1.2 Arial,Helvetica,sans-serif;color:#29c3f5;">
                          R$ ' . $e($dados['amount']) . '
                        </td>
                      </tr>';

    if (($dados['groupName'] ?? null) !== null && $dados['groupName'] !== '') {
        $nomeUpper = function_exists('mb_strtoupper') ? mb_strtoupper((string) $dados['groupName'], 'UTF-8') : strtoupper((string) $dados['groupName']);
        $html .= '
                      <tr>
                        <td colspan="2" style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.12);">
                          <p style="margin:0 0 3px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.6);letter-spacing:0.12em;text-transform:uppercase;">
                            GRUPO:
                          </p>
                          <strong style="display:block;font:800 18px/1.3 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.04em;text-transform:uppercase;">'
                            . $e($nomeUpper) . '</strong>
                        </td>
                      </tr>';
    }

    $html .= '
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';

    // Dados do pagamento.
    $html .= '
          <tr>
            <td style="padding:0 0 6px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
              Pagamento
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        . bus_email_linha('Status', 'Aprovado')
        . bus_email_linha('Data e hora', $dados['issuedAt'])
        . bus_email_linha('Valor', 'R$ ' . $dados['amount'])
        . bus_email_linha('ID da transação', $dados['orderId'])
        . bus_email_linha('ID do pagamento', $dados['paymentId'] ?? null)
        . '
              </table>
            </td>
          </tr>';

    // Contato principal, com CPF (caixa interna).
    $html .= '
          <tr>
            <td style="padding:0 0 6px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
              Contato principal
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        . bus_email_linha('Nome', $dados['contactName'])
        . bus_email_linha('CPF', $dados['contactCpf'])
        . bus_email_linha('WhatsApp', $dados['contactWhatsapp'])
        . bus_email_linha('E-mail', $dados['contactEmail'])
        . bus_email_linha('Total de passageiros', (string) $dados['passengerCount']
            . ((int) $dados['childrenCount'] > 0
                ? ' pagantes + ' . $dados['childrenCount'] . ' de colo'
                : ' pagante(s)'))
        . '
              </table>
            </td>
          </tr>';

    // Tabela de passageiros. Cabeçalho com fundo próprio para a leitura não se
    // perder quando a lista tem muitas linhas.
    if (!empty($dados['passengersAdmin'])) {
        $linhas = '';
        foreach ($dados['passengersAdmin'] as $p) {
            $fundo = !empty($p['isPrimary']) ? 'background:rgba(41,195,245,0.08);' : '';
            $peso = !empty($p['isPrimary']) ? '700' : '400';
            $marca = !empty($p['isPrimary']) ? ' *' : '';
            $linhas .= '
                <tr style="' . $fundo . '">
                  <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font:' . $peso . ' 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
                    ' . $e($p['name']) . $e($marca) . '
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font:400 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.8);">
                    ' . $e($p['cpf'] ?? '') . '
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font:400 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.8);">
                    ' . $e($p['whatsapp'] ?? '-') . '
                  </td>
                  <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);font:400 12px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.7);word-break:break-all;">
                    ' . $e($p['email'] ?? '-') . '
                  </td>
                </tr>';
        }

        $html .= '
          <tr>
            <td style="padding:0 0 6px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
              Passageiros
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-collapse:collapse;">
                <tr style="background:rgba(255,255,255,0.08);">
                  <th align="left" style="padding:8px 10px;font:700 11px/1.3 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);letter-spacing:0.04em;">NOME</th>
                  <th align="left" style="padding:8px 10px;font:700 11px/1.3 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);letter-spacing:0.04em;">CPF</th>
                  <th align="left" style="padding:8px 10px;font:700 11px/1.3 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);letter-spacing:0.04em;">WHATSAPP</th>
                  <th align="left" style="padding:8px 10px;font:700 11px/1.3 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);letter-spacing:0.04em;">E-MAIL</th>
                </tr>'
            . $linhas . '
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 6px;font:400 11px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.5);">
              * contato responsável pela reserva
            </td>
          </tr>';
    }

    $html .= bus_email_fechamento(
        'Mensagem automática do site &middot; Kriativos On Board 2026'
    );

    return $html;
}

function bus_admin_email_text(array $dados): string
{
    $linhas = [];
    $linhas[] = 'PAGAMENTO CONFIRMADO - RESERVA ' . $dados['code'];
    $linhas[] = str_repeat('=', 52);
    $linhas[] = '';
    $linhas[] = 'Reserva: ' . $dados['code'];
    $linhas[] = 'Valor pago: R$ ' . $dados['amount'];
    if (($dados['groupName'] ?? null) !== null && $dados['groupName'] !== '') {
        $linhas[] = 'Grupo: ' . $dados['groupName'];
    }
    $linhas[] = '';
    $linhas[] = 'PAGAMENTO';
    $linhas[] = 'Status: Aprovado';
    $linhas[] = 'Data e hora: ' . $dados['issuedAt'];
    $linhas[] = 'ID da transacao: ' . ($dados['orderId'] ?? '-');
    if (($dados['paymentId'] ?? null) !== null) {
        $linhas[] = 'ID do pagamento: ' . $dados['paymentId'];
    }
    $linhas[] = '';
    $linhas[] = 'CONTATO PRINCIPAL';
    $linhas[] = 'Nome: ' . $dados['contactName'];
    $linhas[] = 'CPF: ' . $dados['contactCpf'];
    $linhas[] = 'WhatsApp: ' . $dados['contactWhatsapp'];
    $linhas[] = 'E-mail: ' . $dados['contactEmail'];
    $linhas[] = 'Total de passageiros: ' . $dados['passengerCount']
        . ((int) $dados['childrenCount'] > 0
            ? ' pagantes + ' . $dados['childrenCount'] . ' de colo'
            : ' pagante(s)');

    if (!empty($dados['passengersAdmin'])) {
        $linhas[] = '';
        $linhas[] = 'PASSAGEIROS';
        foreach ($dados['passengersAdmin'] as $i => $p) {
            $linhas[] = ($i + 1) . '. ' . $p['name']
                . (!empty($p['isPrimary']) ? ' (responsavel)' : '');
            $linhas[] = '   CPF: ' . ($p['cpf'] ?? '-');
            $linhas[] = '   WhatsApp: ' . ($p['whatsapp'] ?? 'nao informado');
            $linhas[] = '   E-mail: ' . ($p['email'] ?? 'nao informado');
        }
    }

    $linhas[] = '';
    $linhas[] = 'Mensagem automatica do site.';

    return implode("\r\n", $linhas);
}
