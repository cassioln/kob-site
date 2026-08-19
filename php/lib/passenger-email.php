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
                     style="background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.12);">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font:700 12px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.12em;text-transform:uppercase;">
                      Informações de Embarque &amp; Pontualidade
                    </p>
                    <p style="margin:0 0 8px;font:400 13px/1.65 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">Local de Encontro:</strong> Rua Tagipuru, altura do número 552 — Barra Funda — SP (atrás do Memorial da América Latina).
                    </p>
                    <p style="margin:0 0 8px;font:400 13px/1.65 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">Horário de Chegada:</strong> <span style="color:#29c3f5;font-weight:700;">06:00 hrs</span> (chegue com antecedência para conferência da lista e acomodação de bagagens).
                    </p>
                    <p style="margin:0 0 14px;font:400 13px/1.65 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">Saída do Ônibus:</strong> <span style="color:#feb32c;font-weight:700;">06:20 hrs</span> (tolerância máxima de 10 minutos &mdash; saída final às 06:30 hrs impreterivelmente).
                    </p>
                    <div style="padding:12px 14px;background:rgba(254,179,44,0.1);border-left:3px solid #feb32c;border-radius:4px;">
                      <p style="margin:0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                        <strong style="color:#feb32c;">Atenção importante:</strong> O ônibus não aguardará além do horário limite e <strong>não nos responsabilizamos por passageiros que perderem o transporte por atraso</strong>. Planeje sua ida até o ponto de encontro com antecedência!
                      </p>
                    </div>
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
    $linhas[] = 'INFORMACOES DE EMBARQUE E PONTUALIDADE';
    $linhas[] = 'Saida de Sao Paulo (Barra Funda) com destino ao Porto de Santos.';
    $linhas[] = '- Local de Encontro: Rua Tagipuru, altura do numero 552 - Barra Funda - SP (atras do Memorial da America Latina)';
    $linhas[] = '- Horario de Chegada: 06:00 hrs';
    $linhas[] = '- Saida do Onibus: 06:20 hrs (Tolerancia maxima de 10 minutos - saida final as 06:30 hrs impreterivelmente)';
    $linhas[] = '- IMPORTANTE: Devido a janela rigida de embarque no navio no Porto de Santos, o onibus nao aguardara alem da tolerancia e nao nos responsabilizamos por passageiros que perderem o transporte. Planeje sua chegada com antecedencia!';
    $linhas[] = '';
    $linhas[] = 'Ficou com alguma duvida? Responda este e-mail que a gente te ajuda.';

    return implode("\r\n", $linhas);
}
