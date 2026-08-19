<?php

declare(strict_types=1);

/**
 * Template do e-mail de pagamento Pix pendente.
 */

/**
 * @param array{
 *   amount: string, passengerCount: int, childrenCount: int, contactName: string,
 *   passengers: list<array{name: string, whatsapp: ?string}>,
 *   qrCode: string, groupName: ?string
 * } $dados
 */
require_once __DIR__ . '/email-parts.php';

function bus_pix_email_html(array $dados): string
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
        ['Valor a pagar', 'R$ ' . str_replace('.', ',', $dados['amount'])],
        ['Passageiros', (string) $dados['passengerCount']],
        ['Rota', 'Barra Funda (SP) &rarr; Porto de Santos'],
    ];

    $linhasFatos = '';
    foreach ($fatos as $i => [$rotulo, $valor]) {
        $borda = $i === 0 ? '' : 'border-top:1px solid rgba(255,255,255,0.09);';
        $destaque = str_contains($rotulo, 'Valor');
        $corValor = $destaque ? 'color:#29c3f5;font-weight:700;' : 'color:#ffffff;';
        $rotuloSeguro = $rotulo === 'Rota' ? $rotulo : $e($rotulo);
        $valorSeguro = $rotulo === 'Rota' ? $valor : $e($valor);
        $linhasFatos .= '
            <tr>
              <td style="' . $borda . 'padding:10px 0;font:400 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.65);">'
                . $rotuloSeguro . '</td>
              <td style="' . $borda . 'padding:10px 0;font:700 14px/1.4 Arial,Helvetica,sans-serif;' . $corValor . 'text-align:right;">'
                . $valorSeguro . '</td>
            </tr>';
    }

    $qrCodeUrl = 'https://quickchart.io/qr?size=300&text=' . urlencode($dados['qrCode']);

    $html = bus_email_abertura(
        'Finalize seu pagamento para garantir sua vaga no ônibus fretado.'
    );

    $html .= bus_email_cabecalho(
        'Kriativos On Board 2026',
        'Transporte fretado'
    );

    $html .= '
          <tr>
            <td style="padding:0 0 20px;">
              <p style="margin:0 0 8px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#f5a623;letter-spacing:0.14em;text-transform:uppercase;">
                Pagamento Pendente
              </p>
              <h1 style="margin:0 0 12px;font:700 26px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;">
                ' . $e($primeiroNome) . ', sua reserva está quase lá.
              </h1>
              <p style="margin:0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.82);">
                Seu código Pix foi gerado com sucesso. Escaneie o QR Code ou copie a chave abaixo no app do seu banco para confirmar suas vagas. <strong>Vence em 30 minutos.</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:12px;">
                <tr>
                  <td style="padding:24px 20px;text-align:center;">
                    <img src="' . $e($qrCodeUrl) . '" alt="QR Code Pix" width="200" height="200" style="display:inline-block;width:200px;height:200px;background:#fff;padding:10px;border-radius:8px;margin-bottom:20px;">
                    <p style="margin:0 0 8px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.76);text-transform:uppercase;letter-spacing:0.05em;">
                      Ou utilize o código Copia e Cola:
                    </p>
                    <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:12px;word-break:break-all;font-family:\'Courier New\',Courier,monospace;font-size:13px;color:#29c3f5;line-height:1.4;">
                      ' . $e($dados['qrCode']) . '
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';

    // Bloco do Grupo manual sem dizer "confirmado"
    if (!empty($dados['groupName'])) {
        $nomeUpper = function_exists('mb_strtoupper') ? mb_strtoupper($dados['groupName'], 'UTF-8') : strtoupper($dados['groupName']);
        $html .= '
          <tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#072b4f;border:1px solid #144573;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;text-align:center;">
                    <p style="margin:0 0 10px;font:700 15px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">
                      Viajando com o grupo:
                    </p>
                    <p style="margin:0;font:800 22px/1.2 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.04em;text-transform:uppercase;">
                      ' . $e($nomeUpper) . '
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';
    }

    // Manifesto: Quem embarca
    $html .= '
          <tr>
            <td style="padding:0 0 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.12);">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="3" style="padding:0 0 8px;font:700 12px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.2);">
                          Quem embarca
                        </td>
                      </tr>
                      ' . $linhasManifesto . $linhaCriancas . '
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';

    $html .= '
          <tr>
            <td style="padding:0 0 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ' . $linhasFatos . '
              </table>
            </td>
          </tr>';

    $html .= '
          <tr>
            <td style="padding:20px 0 0;border-top:1px solid rgba(255,255,255,0.12);text-align:center;">
              <p style="margin:0;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.5);">
                Se você já realizou o pagamento, pode desconsiderar este e-mail. A confirmação oficial chegará em breve.
              </p>
            </td>
          </tr>';

    $html .= bus_email_fechamento('Este é um e-mail automático enviado pelo sistema de reservas do Kriativos On Board.');

    return $html;
}

function bus_pix_email_text(array $dados): string
{
    $linhas = [];
    $primeiroNome = explode(' ', trim($dados['contactName']))[0] ?? '';

    $linhas[] = 'KRIATIVOS ON BOARD 2026 - Transporte Fretado';
    $linhas[] = '--------------------------------------------------';
    $linhas[] = 'PAGAMENTO PENDENTE';
    $linhas[] = $primeiroNome . ', sua reserva está quase lá.';
    $linhas[] = '';
    $linhas[] = 'Seu código Pix foi gerado com sucesso. Copie a chave abaixo no app do seu banco para confirmar suas vagas. Vence em 30 minutos.';
    $linhas[] = '';
    $linhas[] = 'CÓDIGO PIX COPIA E COLA:';
    $linhas[] = $dados['qrCode'];
    $linhas[] = '';
    $linhas[] = 'Resumo da reserva:';
    $linhas[] = '- Valor a pagar: R$ ' . str_replace('.', ',', $dados['amount']);
    $linhas[] = '- Passageiros: ' . $dados['passengerCount'];
    $linhas[] = '- Rota: Barra Funda (SP) -> Porto de Santos';
    if (!empty($dados['groupName'])) {
        $linhas[] = '';
        $linhas[] = 'Viajando com o grupo: ' . $dados['groupName'];
    }
    
    $linhas[] = '';
    $linhas[] = 'Passageiros:';
    foreach ($dados['passengers'] as $i => $p) {
        $linhas[] = ($i + 1) . '. ' . $p['name'] . (!empty($p['whatsapp']) ? ' (' . $p['whatsapp'] . ')' : '');
    }

    $linhas[] = '';
    $linhas[] = 'Se você já realizou o pagamento, desconsidere esta mensagem.';
    
    return implode("\n", $linhas);
}
