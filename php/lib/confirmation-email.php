<?php

declare(strict_types=1);

/**
 * Template do e-mail de confirmação.
 *
 * Restrições de e-mail que ditam a forma deste arquivo — não é HTML de site:
 *  - layout em <table>, porque Outlook (motor Word) ignora flex e grid;
 *  - CSS inline, porque Gmail remove <style> em várias situações;
 *  - cores literais em hex, porque custom properties não são suportadas;
 *  - largura fixa de 600px, o padrão seguro para painéis de leitura;
 *  - nenhuma imagem externa obrigatória, porque a maioria dos clientes bloqueia
 *    imagem por padrão e o e-mail precisa se sustentar sem elas.
 *
 * A paleta é a do site (assets/css/main.css): ocean-abyss #041d3a,
 * ocean-navy #082f57, ocean-cyan #29c3f5, magenta #e5007e, action #7b1fa2.
 */

/**
 * @param array{
 *   code: string, orderId: ?string, amount: string, passengerCount: int,
 *   childrenCount: int, contactName: string,
 *   passengers: list<array{name: string, whatsapp: ?string}>, issuedAt: string
 * } $dados
 */
function bus_confirmation_email_html(array $dados): string
{
    $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
    $primeiroNome = explode(' ', trim($dados['contactName']))[0] ?? '';

    // Manifesto: cada linha com nome e, quando houver, telefone.
    $linhasManifesto = '';
    foreach ($dados['passengers'] as $i => $p) {
        $numero = $i + 1;
        $telefone = ($p['whatsapp'] ?? '') !== '' ? bus_format_phone((string) $p['whatsapp']) : '';
        $borda = $i === 0 ? '' : 'border-top:1px solid rgba(255,255,255,0.12);';
        $linhasManifesto .= '
            <tr>
              <td style="' . $borda . 'padding:10px 0;font:700 13px/1.3 Arial,Helvetica,sans-serif;color:#29c3f5;width:26px;vertical-align:top;">'
                . $numero . '.</td>
              <td style="' . $borda . 'padding:10px 0;font:400 14px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;vertical-align:top;">'
                . $e($p['name']) . '</td>
              <td style="' . $borda . 'padding:10px 0;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);text-align:right;white-space:nowrap;vertical-align:top;">'
                . ($telefone !== '' ? $e($telefone) : '&mdash;') . '</td>
            </tr>';
    }

    $linhaCriancas = '';
    if ($dados['childrenCount'] > 0) {
        $plural = $dados['childrenCount'] === 1 ? 'criança' : 'crianças';
        $linhaCriancas = '
            <tr>
              <td colspan="3" style="padding:14px 0 0;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
                + ' . $dados['childrenCount'] . ' ' . $plural . ' de até 5 anos, sem cobrança, no colo de um responsável.
              </td>
            </tr>';
    }

    // Tabela de dados da reserva.
    $fatos = [
        ['Código da reserva', $dados['code']],
        ['Valor pago', 'R$ ' . str_replace('.', ',', $dados['amount'])],
        ['Passageiros pagantes', (string) $dados['passengerCount']],
        ['Rota', 'Barra Funda (SP) &rarr; Porto de Santos'],
    ];
    if (!empty($dados['orderId'])) {
        $fatos[] = ['Transação (Mercado Pago)', $dados['orderId']];
    }

    $linhasFatos = '';
    foreach ($fatos as $i => [$rotulo, $valor]) {
        $borda = $i === 0 ? '' : 'border-top:1px solid rgba(13,41,78,0.12);';
        // Código e transação usam monoespaçada. `word-break:break-all` só aqui:
        // o Order ID tem 32 caracteres sem espaço e, sem poder quebrar, impunha
        // largura mínima que estourava a tela em aparelho estreito.
        $mono = str_contains($rotulo, 'Transação') || str_contains($rotulo, 'Código')
            ? 'font-family:\'Courier New\',Courier,monospace;letter-spacing:0.06em;word-break:break-all;'
            : '';
        $linhasFatos .= '
            <tr>
              <td style="' . $borda . 'padding:13px 0;font:400 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(13,34,66,0.72);">'
                . $rotulo . '</td>
              <td style="' . $borda . 'padding:13px 0;font:700 14px/1.4 Arial,Helvetica,sans-serif;color:#0d2242;text-align:right;' . $mono . '">'
                . $valor . '</td>
            </tr>';
    }

    return '<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reserva confirmada &mdash; Kriativos On Board 2026</title>
</head>
<body style="margin:0;padding:0;background:#041d3a;">
  <!-- Preheader: primeira linha que aparece na lista de mensagens. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Sua vaga no ônibus fretado está garantida. Código ' . $e($dados['code']) . '.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#041d3a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <!-- Cabeçalho. É a assinatura da marca no topo da mensagem, então tem
               tamanho de título e não de rótulo. O tracking cai de 0.14em para
               0.06em: espaçamento largo funciona em texto de 11px, mas em 20px
               espalha as palavras e enfraquece o conjunto. -->
          <tr>
            <td style="padding:0 0 26px;font:700 20px/1.25 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;">
              Kriativos On Board 2026<br>
              <span style="color:#29c3f5;">Transporte fretado</span>
            </td>
          </tr>

          <!-- Bloco principal -->
          <tr>
            <td style="background:#082f57;border-radius:16px;padding:36px 32px;">
              <p style="margin:0 0 10px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.14em;text-transform:uppercase;">
                Pagamento confirmado
              </p>
              <h1 style="margin:0 0 14px;font:700 30px/1.1 Arial,Helvetica,sans-serif;color:#ffffff;">
                ' . ($primeiroNome !== '' ? $e($primeiroNome) . ', sua vaga' : 'Sua vaga') . ' está garantida.
              </h1>
              <p style="margin:0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.82);">
                Recebemos seu Pix e os assentos já estão reservados. Guarde o comprovante em anexo:
                é ele que identifica seu grupo no embarque.
              </p>

              <!-- Manifesto -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                <tr>
                  <td colspan="3" style="padding:0 0 6px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.24);">
                    Quem embarca
                  </td>
                </tr>
                ' . $linhasManifesto . $linhaCriancas . '
              </table>
            </td>
          </tr>

          <!-- Dados da reserva -->
          <tr>
            <td style="padding:16px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 16px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#7b1fa2;letter-spacing:0.12em;text-transform:uppercase;">
                      Dados da reserva
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ' . $linhasFatos . '
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Próximos passos -->
          <tr>
            <td style="padding:16px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 14px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#7b1fa2;letter-spacing:0.12em;text-transform:uppercase;">
                      Próximos passos
                    </p>
                    <p style="margin:0 0 12px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:rgba(13,34,66,0.86);">
                      <strong style="color:#0d2242;">1.</strong> Guarde o PDF em anexo. Ele vale como comprovante e pode
                      ser mostrado no celular.
                    </p>
                    <p style="margin:0 0 12px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:rgba(13,34,66,0.86);">
                      <strong style="color:#0d2242;">2.</strong> Avisaremos o horário e o ponto exato de embarque na
                      Barra Funda pelo WhatsApp do contato principal.
                    </p>
                    <p style="margin:0;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:rgba(13,34,66,0.86);">
                      <strong style="color:#0d2242;">3.</strong> Chegue com 30 minutos de antecedência no dia da viagem.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Aviso de contratação. Fica sobre o fundo escuro do corpo do
               e-mail, então o texto é claro; um fundo translúcido claro aqui
               deixaria texto claro sobre claro em clientes que ignoram rgba. -->
          <tr>
            <td style="padding:16px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#082f57;border-radius:16px;">
                <tr>
                  <td style="padding:22px 28px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.82);border-left:0;">
                    O ônibus só será contratado se o número mínimo de passageiros for atingido. Caso isso
                    não aconteça, o valor é devolvido integralmente.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding:26px 4px 0;">
              <!-- Os dois canais estão abertos, então o texto diz qual usar em
                   vez de listar ambos e deixar a escolha no ar. O número aparece
                   escrito ao lado do link porque cliente de e-mail costuma
                   bloquear link e a pessoa precisa poder copiar. -->
              <p style="margin:0 0 10px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
                Ficou com alguma dúvida? Responda este e-mail que a gente te ajuda. Se for algo
                urgente, chama no WhatsApp da organização:
                <a href="https://wa.me/5511996847615" style="color:#29c3f5;font-weight:700;text-decoration:underline;">
                  (11) 99684-7615</a>.
              </p>
              <p style="margin:0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.45);">
                Emitido em ' . $e($dados['issuedAt']) . ' &middot; Kriativos On Board 2026
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>';
}

/**
 * Versão em texto puro.
 *
 * Não é opcional: mensagem só-HTML tem pontuação de spam maior, e alguns
 * clientes (relógios, leitores de tela em modo texto) mostram só esta parte.
 */
function bus_confirmation_email_text(array $dados): string
{
    $linhas = [];
    $primeiroNome = explode(' ', trim($dados['contactName']))[0] ?? '';

    $linhas[] = 'KRIATIVOS ON BOARD 2026 - TRANSPORTE FRETADO';
    $linhas[] = '';
    $linhas[] = ($primeiroNome !== '' ? $primeiroNome . ', sua vaga' : 'Sua vaga') . ' esta garantida.';
    $linhas[] = '';
    $linhas[] = 'Recebemos seu Pix e os assentos ja estao reservados.';
    $linhas[] = 'O comprovante em PDF esta em anexo.';
    $linhas[] = '';
    $linhas[] = 'DADOS DA RESERVA';
    $linhas[] = 'Codigo: ' . $dados['code'];
    $linhas[] = 'Valor pago: R$ ' . str_replace('.', ',', $dados['amount']);
    $linhas[] = 'Passageiros pagantes: ' . $dados['passengerCount'];
    if ($dados['childrenCount'] > 0) {
        $linhas[] = 'Criancas de ate 5 anos: ' . $dados['childrenCount'] . ' (nao pagantes, no colo)';
    }
    $linhas[] = 'Rota: Barra Funda (SP) -> Porto de Santos';
    if (!empty($dados['orderId'])) {
        $linhas[] = 'Transacao: ' . $dados['orderId'];
    }
    $linhas[] = '';
    $linhas[] = 'QUEM EMBARCA';
    foreach ($dados['passengers'] as $i => $p) {
        $telefone = ($p['whatsapp'] ?? '') !== '' ? ' - ' . bus_format_phone((string) $p['whatsapp']) : '';
        $linhas[] = ($i + 1) . '. ' . $p['name'] . $telefone;
    }
    $linhas[] = '';
    $linhas[] = 'PROXIMOS PASSOS';
    $linhas[] = '1. Guarde o PDF em anexo.';
    $linhas[] = '2. Avisaremos horario e ponto de embarque pelo WhatsApp.';
    $linhas[] = '3. Chegue com 30 minutos de antecedencia.';
    $linhas[] = '';
    $linhas[] = 'O onibus so sera contratado se o minimo de passageiros for atingido.';
    $linhas[] = 'Caso contrario, o valor e devolvido integralmente.';
    $linhas[] = '';
    $linhas[] = 'Ficou com alguma duvida? Responda este e-mail que a gente te ajuda.';
    $linhas[] = 'Se for algo urgente, chama no WhatsApp da organizacao:';
    $linhas[] = '(11) 99684-7615  -  https://wa.me/5511996847615';
    $linhas[] = '';
    $linhas[] = 'Emitido em ' . $dados['issuedAt'];

    return implode("\r\n", $linhas);
}
