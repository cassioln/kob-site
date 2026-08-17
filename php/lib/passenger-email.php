<?php

declare(strict_types=1);

/**
 * E-mail de confirmação para PASSAGEIRO ADICIONAL.
 *
 * Diferença deliberada em relação ao e-mail do contato principal: aqui NÃO vão
 * código de pagamento, QR Code, valor pago, transação nem comprovante em PDF.
 * Esses dados pertencem a quem pagou. O passageiro adicional precisa saber que
 * a vaga dele está garantida, com quem falar e onde entrar no grupo.
 *
 * Personalizado com o nome de quem recebe, para não parecer aviso em massa.
 */

require_once __DIR__ . '/email-parts.php';

function bus_passenger_email_html(array $dados, string $nomePassageiro): string
{
    $e = static fn (?string $v): string => bus_email_e($v);

    // Primeiro nome no cumprimento: o nome completo no "Olá" soa como cobrança.
    $primeiroNome = trim(explode(' ', trim($nomePassageiro))[0] ?? $nomePassageiro);

    $html = bus_email_abertura(
        'Sua vaga no ônibus do Kriativos On Board 2026 está confirmada.'
    );

    $html .= bus_email_cabecalho(
        'Kriativos On Board 2026',
        'Transporte fretado'
    );

    $html .= '
          <tr>
            <td style="padding:0 0 8px;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">
              Olá, ' . $e($primeiroNome) . '! Sua vaga está confirmada.
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 22px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.76);">
              ' . $e($dados['contactName']) . ' concluiu o pagamento da reserva
              <strong style="color:#ffffff;">' . $e($dados['code']) . '</strong> e o seu nome está
              na lista de embarque do ônibus fretado.
            </td>
          </tr>';

    $html .= bus_email_bloco_grupo($dados['groupName'] ?? null);

    // Ficha da viagem, sem nada de pagamento.
    $html .= '
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
        . bus_email_linha('Reserva', $dados['code'])
        . bus_email_linha('Grupo', $dados['groupName'] ?? null)
        . bus_email_linha('Responsável pela reserva', $dados['contactName'])
        . bus_email_linha('Contato do responsável', $dados['contactWhatsapp'])
        . bus_email_linha('Pessoas na reserva', (string) $dados['passengerCount']
            . ((int) $dados['childrenCount'] > 0
                ? ' + ' . $dados['childrenCount'] . ' de colo' : ''))
        . '
              </table>
            </td>
          </tr>';

    // Quem mais embarca no mesmo grupo. Só nomes: expor CPF de terceiro num
    // e-mail que circula por encaminhamento seria vazar dado alheio.
    if (!empty($dados['passengers'])) {
        $itens = '';
        foreach ($dados['passengers'] as $p) {
            $marca = !empty($p['isPrimary']) ? ' (responsável)' : '';
            $itens .= '
                    <li style="margin:0 0 5px;">' . $e($p['name']) . $e($marca) . '</li>';
        }
        $html .= '
          <tr>
            <td style="padding:0 0 22px;">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
                Quem embarca com você
              </p>
              <ul style="margin:0;padding-left:20px;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.78);">'
            . $itens . '
              </ul>
            </td>
          </tr>';
    }

    // Informações do fretado: é o que a pessoa precisa no dia.
    $html .= '
          <tr>
            <td style="padding:0 0 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.05);border-radius:10px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;">
                      O fretado
                    </p>
                    <p style="margin:0;font:400 13px/1.65 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.76);">
                      Saída do Terminal Barra Funda, em São Paulo, com destino ao Porto de Santos,
                      no dia do embarque. Chegue ao ponto de encontro com 30 minutos de
                      antecedência. O horário exato é confirmado pela organização no grupo do
                      WhatsApp.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0 0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
              Ficou com alguma dúvida? Responda este e-mail que a gente te ajuda.
            </td>
          </tr>';

    $html .= bus_email_fechamento(
        'Kriativos On Board 2026 &middot; Transporte fretado'
    );

    return $html;
}

function bus_passenger_email_text(array $dados, string $nomePassageiro): string
{
    $primeiroNome = trim(explode(' ', trim($nomePassageiro))[0] ?? $nomePassageiro);

    $linhas = [];
    $linhas[] = 'KRIATIVOS ON BOARD 2026 - TRANSPORTE FRETADO';
    $linhas[] = '';
    $linhas[] = 'Ola, ' . $primeiroNome . '! Sua vaga esta confirmada.';
    $linhas[] = '';
    $linhas[] = $dados['contactName'] . ' concluiu o pagamento da reserva '
        . $dados['code'] . ' e o seu nome esta na lista de embarque.';

    $linhas = array_merge($linhas, bus_email_grupo_texto($dados['groupName'] ?? null));

    $linhas[] = '';
    $linhas[] = 'DADOS DA RESERVA';
    $linhas[] = 'Reserva: ' . $dados['code'];
    if (($dados['groupName'] ?? null) !== null) {
        $linhas[] = 'Grupo: ' . $dados['groupName'];
    }
    $linhas[] = 'Responsavel: ' . $dados['contactName'];
    $linhas[] = 'Contato do responsavel: ' . $dados['contactWhatsapp'];
    $linhas[] = 'Pessoas na reserva: ' . $dados['passengerCount']
        . ((int) $dados['childrenCount'] > 0
            ? ' + ' . $dados['childrenCount'] . ' de colo' : '');

    if (!empty($dados['passengers'])) {
        $linhas[] = '';
        $linhas[] = 'QUEM EMBARCA COM VOCE';
        foreach ($dados['passengers'] as $p) {
            $linhas[] = '- ' . $p['name'] . (!empty($p['isPrimary']) ? ' (responsavel)' : '');
        }
    }

    $linhas[] = '';
    $linhas[] = 'O FRETADO';
    $linhas[] = 'Saida do Terminal Barra Funda, em Sao Paulo, com destino ao Porto de';
    $linhas[] = 'Santos, no dia do embarque. Chegue com 30 minutos de antecedencia.';
    $linhas[] = 'O horario exato e confirmado pela organizacao no grupo do WhatsApp.';
    $linhas[] = '';
    $linhas[] = 'Ficou com alguma duvida? Responda este e-mail que a gente te ajuda.';

    return implode("\r\n", $linhas);
}
