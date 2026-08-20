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
require_once __DIR__ . '/email-parts.php';

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
        ['Encontro do grupo', '06:00 hrs (Saída: 06:30) &middot; Rua Tagipuru, 552 (Barra Funda)'],
    ];
    if (!empty($dados['orderId'])) {
        $fatos[] = ['Transação (Mercado Pago)', $dados['orderId']];
    }

    $linhasFatos = '';
    foreach ($fatos as $i => [$rotulo, $valor]) {
        $borda = $i === 0 ? '' : 'border-top:1px solid rgba(255,255,255,0.09);';
        // Código e transação usam monoespaçada. `word-break:break-all` só aqui:
        // o Order ID tem 32 caracteres sem espaço e, sem poder quebrar, impunha
        // largura mínima que estourava a tela em aparelho estreito.
        $mono = str_contains($rotulo, 'Transação') || str_contains($rotulo, 'Código')
            ? 'font-family:\'Courier New\',Courier,monospace;letter-spacing:0.06em;word-break:break-all;'
            : '';
        $destaque = str_contains($rotulo, 'Valor') || str_contains($rotulo, 'Código');
        $corValor = $destaque ? 'color:#29c3f5;font-weight:700;' : 'color:#ffffff;';
        $rotuloSeguro = in_array($rotulo, ['Rota', 'Encontro do grupo'], true) ? $rotulo : $e($rotulo);
        $valorSeguro = in_array($rotulo, ['Rota', 'Encontro do grupo'], true) ? $valor : $e($valor);
        $linhasFatos .= '
            <tr>
              <td style="' . $borda . 'padding:10px 0;font:400 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">'
                . $rotuloSeguro . '</td>
              <td style="' . $borda . 'padding:10px 0;font:700 14px/1.4 Arial,Helvetica,sans-serif;' . $corValor . 'text-align:right;' . $mono . '">'
                . $valorSeguro . '</td>
            </tr>';
    }

    $html = bus_email_abertura(
        'Sua vaga no ônibus fretado está garantida. Código ' . $dados['code'] . '.'
    );

    $html .= bus_email_cabecalho(
        'Kriativos On Board 2026',
        'Transporte fretado'
    );

    // Mensagem principal
    $html .= '
          <tr>
            <td style="padding:0 0 20px;">
              <p style="margin:0 0 8px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.14em;text-transform:uppercase;">
                Pagamento confirmado
              </p>
              <h1 style="margin:0 0 12px;font:700 26px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;">
                ' . ($primeiroNome !== '' ? $e($primeiroNome) . ', sua vaga' : 'Sua vaga') . ' está garantida.
              </h1>
              <p style="margin:0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.82);">
                Recebemos seu Pix e os assentos já estão reservados. Guarde o comprovante em anexo:
                é ele que identifica seu grupo no embarque.
              </p>
            </td>
          </tr>';

    // Bloco do grupo + botão de WhatsApp
    $html .= bus_email_bloco_grupo($dados['groupName'] ?? null);

    // Passageiros
    $html .= '
          <tr>
            <td style="padding:0 0 24px;">
              <p style="margin:0 0 12px;font:700 12px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.12em;text-transform:uppercase;">
                Quem embarca com você
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ' . $linhasManifesto . '
                ' . $linhaCriancas . '
              </table>
            </td>
          </tr>';

    // Fatos da reserva
    $html .= '
          <tr>
            <td style="padding:0 0 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ' . $linhasFatos . '
              </table>
            </td>
          </tr>';

    // Próximos passos e regras de embarque / pontualidade / assentos
    $html .= '
          <tr>
            <td style="padding:0 0 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.12);">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font:700 12px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.12em;text-transform:uppercase;">
                      Próximos Passos &amp; Instruções de Viagem
                    </p>
                    
                    <p style="margin:0 0 12px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">1. Comprovante de Reserva:</strong> Guarde o PDF em anexo. Ele vale como comprovante oficial de viagem e poderá ser apresentado diretamente pelo celular no momento do embarque.
                    </p>

                    <p style="margin:0 0 12px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">2. Ponto de Encontro &amp; Horários:</strong> Encontro às <strong style="color:#29c3f5;">06h00</strong>, na <strong>Rua Tagipuru, altura do nº 552 – Barra Funda – SP</strong> (atrás do Memorial da América Latina).<br>
                      A saída do ônibus será às <strong style="color:#feb32c;">06h30</strong>, com tolerância máxima de 10 minutos (saída final às 06h40). Após esse horário limite, o ônibus precisará seguir viagem e não poderá aguardar passageiros que ainda não estejam no local, não nos responsabilizando por perdas decorrentes de atraso.
                    </p>

                    <p style="margin:0 0 12px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">3. Programe-se com Antecedência:</strong> Chegue com calma para estar no local às <strong>06h00</strong>, garantindo tempo hábil para conferência da lista e acomodação de bagagens.
                    </p>

                    <p style="margin:0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.9);">
                      <strong style="color:#ffffff;">4. Assentos Livres &amp; Integração:</strong> Os assentos não são exclusivos nem marcados. Os lugares serão ocupados por ordem de chegada, de forma livre, então você pode sentar onde houver disponibilidade. Aproveite esse momento para ir conhecendo os outros participantes durante o trajeto, para que todos cheguem ao evento mais enturmados e conectados! <em>(Essa regra de assento livre vale para ida e volta; você não necessariamente retornará no mesmo assento em que foi).</em>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';

    // Aviso de contratação
    $html .= '
          <tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:14px 18px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
                    O ônibus só será contratado se o número mínimo de passageiros for atingido. Caso isso não aconteça, 100% do valor é devolvido integralmente via Pix.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 4px;text-align:center;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
              Ficou com alguma dúvida? Responda este e-mail que a gente te ajuda.
            </td>
          </tr>';

    $html .= bus_email_fechamento(
        'Emitido em ' . $e($dados['issuedAt']) . ' &middot; Kriativos On Board 2026'
    );

    return $html;
}

/**
 * Versão em texto puro.
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
    $linhas[] = 'Encontro: 06:00 hrs (Saida: 06:30 hrs) - Rua Tagipuru, 552 (Barra Funda)';
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
    $linhas[] = 'PROXIMOS PASSOS E INSTRUCOES DE VIAGEM';
    $linhas[] = '1. Guarde o PDF em anexo. Ele vale como comprovante e podera ser apresentado pelo celular.';
    $linhas[] = '2. Horario de encontro: 06h00, na Rua Tagipuru, altura do numero 552 - Barra Funda - SP, atras do Memorial da America Latina.';
    $linhas[] = '   A saida do onibus sera as 06h30, com tolerancia maxima de 10 minutos. Apos esse horario, precisaremos seguir viagem e o onibus nao podera aguardar passageiros atrasados.';
    $linhas[] = '3. Chegue com antecedencia e programe-se para estar no local as 06h00.';
    $linhas[] = '4. Os assentos nao sao exclusivos. Os lugares serao ocupados por ordem de chegada, de forma livre, entao voce pode sentar onde houver disponibilidade. Aproveite para ir conhecendo os outros participantes durante o trajeto! Essa regra vale para ida e volta.';
    $linhas[] = '';
    $linhas[] = 'O onibus so sera contratado se o minimo de passageiros for atingido.';
    $linhas[] = 'Caso contrario, o valor e devolvido integralmente.';
    $linhas[] = '';
    // Mesma informacao do HTML: quem le em texto puro nao pode receber menos.
    $linhas = array_merge($linhas, bus_email_grupo_texto($dados['groupName'] ?? null));

    $linhas[] = '';
    $linhas[] = 'Ficou com alguma duvida? Responda este e-mail que a gente te ajuda.';
    $linhas[] = '';
    $linhas[] = 'Emitido em ' . $dados['issuedAt'];

    return implode("\r\n", $linhas);
}
