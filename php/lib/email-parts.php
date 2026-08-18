<?php

declare(strict_types=1);

/**
 * Peças compartilhadas pelos e-mails da reserva.
 *
 * Existe para os três e-mails (contato, passageiro adicional e administrativo)
 * terem o mesmo cabeçalho e o mesmo bloco de grupo, em vez de três cópias que
 * divergem na primeira alteração.
 *
 * Restrições de e-mail que ditam a forma deste arquivo, e não são preciosismo:
 *  - layout em <table>, porque Outlook (motor Word) ignora grande parte de
 *    flex/grid;
 *  - CSS inline, porque muitos clientes descartam <style> no <head>;
 *  - cores em hex literal, porque `color-mix()` e custom properties não existem
 *    em cliente de e-mail;
 *  - logo por URL absoluta, não anexo inline: `cid:` depende do cliente montar o
 *    multipart/related corretamente, e Gmail no navegador costuma bloquear. A URL
 *    pública sempre resolve, e se as imagens estiverem bloqueadas o `alt` diz o
 *    nome da marca.
 */

/** Link do grupo oficial de WhatsApp do fretado. */
const BUS_GRUPO_WHATSAPP = 'https://chat.whatsapp.com/DxTVSZrcKXa6WopHZkGL5N?s=cl&p=i&ilr=4';

/**
 * Logo por URL absoluta, em PNG.
 *
 * PNG e nao WebP: cliente de e-mail NÃO suporta WebP. Gmail, Outlook e Apple
 * Mail não renderizam `image/webp` em <img>, e o resultado é o logo não aparecer
 * (foi o que aconteceu no teste real). PNG com canal alfa é o único formato com
 * transparência que funciona em todos eles.
 *
 * O arquivo tem 336px de largura (2x os 168px de exibição) para não serrilhar em
 * tela retina, sem carregar os 1200px do original num e-mail.
 */
const BUS_EMAIL_LOGO = 'https://kriativosonboard.com.br/assets/images/brand/kriativos-on-board-logo-email.png';

/** Ícone do WhatsApp para o botão do grupo, em PNG pelo mesmo motivo do logo. */
const BUS_EMAIL_ICONE_WA = 'https://kriativosonboard.com.br/assets/images/brand/whatsapp-icon-white.png';

/** Escapa para HTML. Todo dado que vem do banco passa por aqui. */
function bus_email_e(?string $valor): string
{
  return htmlspecialchars((string) $valor, ENT_QUOTES, 'UTF-8');
}

/**
 * Cabeçalho padrão: logo centralizado, título e subtítulo.
 *
 * O logo vem centralizado nos três e-mails, como pedido. Largura de 168px é o
 * que mantém a marca legível sem empurrar o conteúdo para baixo da dobra em
 * tela de celular.
 */
function bus_email_cabecalho(string $titulo, string $subtitulo): string
{
  return '
          <tr>
            <td style="padding:0 0 22px;text-align:center;">
              <img src="' . BUS_EMAIL_LOGO . '" alt="Kriativos On Board" width="168"
                   style="display:inline-block;width:168px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 6px;text-align:center;font:700 26px/1.25 Arial,Helvetica,sans-serif;color:#ffffff;">
              ' . bus_email_e($titulo) . '
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 26px;text-align:center;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.72);">
              ' . bus_email_e($subtitulo) . '
            </td>
          </tr>';
}

/**
 * Bloco do grupo: nome em destaque e botão do grupo de WhatsApp.
 *
 * Sai vazio quando a reserva não tem nome de grupo (uma pessoa só). Devolver
 * string vazia em vez de esconder com CSS evita cliente de e-mail que ignora
 * `display:none` mostrar um bloco falando de grupo inexistente.
 *
 * Cor do botão: #0F7A6E, o verde escuro da família WhatsApp. O verde claro
 * #25D366 com texto branco dá 1.98:1, que é ilegível; este dá 5.21:1.
 */
function bus_email_bloco_grupo(?string $nomeGrupo): string
{
  $html = '';

  if ($nomeGrupo !== null && $nomeGrupo !== '') {
    $nomeUpper = function_exists('mb_strtoupper') ? mb_strtoupper($nomeGrupo, 'UTF-8') : strtoupper($nomeGrupo);
    $html .= '
          <tr>
            <td style="padding:0 0 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#072b4f;border:1px solid #144573;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;text-align:center;">
                    <p style="margin:0 0 10px;font:700 15px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">
                      Seu grupo está confirmado!
                    </p>
                    <p style="margin:0 0 4px;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.65);letter-spacing:0.14em;text-transform:uppercase;">
                      GRUPO:
                    </p>
                    <p style="margin:0;font:800 22px/1.2 Arial,Helvetica,sans-serif;color:#29c3f5;letter-spacing:0.04em;text-transform:uppercase;">
                      ' . bus_email_e($nomeUpper) . '
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';
  }

  // O botão do grupo aparece SEMPRE, mesmo em reserva individual: o grupo de
  // WhatsApp é do fretado inteiro, não do grupo da reserva. Quem viaja sozinho
  // também precisa receber os avisos de embarque.
  $html .= '
          <tr>
            <td style="padding:0 0 22px;text-align:center;">
              <p style="margin:0 0 14px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.76);">
                Junte-se ao grupo exclusivo do fretado oficial do Kriativos on Board para receber
                informações, tirar dúvidas e acompanhar as novidades.
              </p>
              <!-- Botão em tabela, não em <a> solto: Outlook não aplica padding
                   em link inline, e o botão sairia como texto sublinhado. -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
                     style="margin:0 auto;">
                <tr>
                  <td style="background:#0F7A6E;border-radius:8px;">
                    <a href="' . BUS_GRUPO_WHATSAPP . '" target="_blank"
                       style="display:inline-block;padding:14px 28px;font:700 15px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:8px;">
                      <!-- Ícone e texto em células irmãs de uma tabela interna:
                           o Outlook não alinha verticalmente <img> e texto soltos
                           dentro do mesmo <a>, e o ícone sairia deslocado. O
                           `border:0` evita a borda azul que alguns clientes
                           adicionam em imagem dentro de link. -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-right:10px;line-height:0;" valign="middle">
                            <img src="' . BUS_EMAIL_ICONE_WA . '" alt="" width="20" height="20"
                                 style="display:block;width:20px;height:20px;border:0;">
                          </td>
                          <td style="font:700 15px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;white-space:nowrap;" valign="middle">
                            Entrar no Grupo Oficial do Fretado
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>';

  return $html;
}

/** Abre o documento e o cartão escuro onde o conteúdo vive. */
function bus_email_abertura(string $preheader): string
{
  $spacer = str_repeat('&zwnj;&nbsp;&#847; ', 20);
  return '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kriativos On Board 2026</title>
</head>
<body style="margin:0;padding:0;background:#061a30;">
  <!-- Preheader: primeira linha que o cliente mostra na lista, antes de abrir.
       Escondido no corpo para não duplicar o texto visível. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#061a30;">
    ' . bus_email_e($preheader) . $spacer . '
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#061a30;">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background:linear-gradient(180deg,#0b2f52,#082744);border-radius:14px;">
          <tr>
            <td style="padding:30px 26px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">';
}

/** Fecha o cartão e o documento, com a assinatura do rodapé. */
function bus_email_fechamento(string $rodape): string
{
  return '
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:16px 26px 0;text-align:center;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.45);">
              ' . $rodape . '
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
 * Linha de rótulo e valor, para as fichas de dados.
 * `$destaque` deixa o valor maior e em ciano, para o olho achar o que importa.
 */
function bus_email_linha(string $rotulo, ?string $valor, bool $destaque = false): string
{
  if ($valor === null || $valor === '') {
    return '';
  }

  $estiloValor = $destaque
    ? 'font:700 16px/1.4 Arial,Helvetica,sans-serif;color:#29c3f5;'
    : 'font:400 14px/1.4 Arial,Helvetica,sans-serif;color:#ffffff;';

  return '
                <tr>
                  <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.09);font:400 12px/1.4 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.6);">
                    ' . bus_email_e($rotulo) . '
                  </td>
                  <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.09);text-align:right;' . $estiloValor . '">
                    ' . bus_email_e($valor) . '
                  </td>
                </tr>';
}

/** Bloco de grupo na versão texto puro, para quem lê sem HTML. */
function bus_email_grupo_texto(?string $nomeGrupo): array
{
  $linhas = [];
  if ($nomeGrupo !== null && $nomeGrupo !== '') {
    $linhas[] = '';
    $linhas[] = 'SEU GRUPO ESTA CONFIRMADO!';
    $linhas[] = 'GRUPO: ' . (function_exists('mb_strtoupper') ? mb_strtoupper($nomeGrupo, 'UTF-8') : strtoupper($nomeGrupo));
  }
  $linhas[] = '';
  $linhas[] = 'GRUPO OFICIAL DO FRETADO NO WHATSAPP';
  $linhas[] = 'Junte-se ao grupo exclusivo do fretado oficial do Kriativos on Board';
  $linhas[] = 'para receber informacoes, tirar duvidas e acompanhar as novidades:';
  $linhas[] = BUS_GRUPO_WHATSAPP;

  return $linhas;
}
