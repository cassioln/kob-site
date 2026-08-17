<?php

declare(strict_types=1);

/**
 * Cliente SMTP mínimo com TLS implícito (porta 465) e anexo.
 *
 * Por que não PHPMailer: o projeto não usa Composer e não queremos introduzir
 * `vendor/` num site estático publicado por FTP. Por que não `mail()`: ela usa o
 * sendmail local, o que faz a mensagem sair sem autenticação e cair em spam —
 * autenticar no SMTP da própria Locaweb com a conta `no-reply@` é o que garante
 * SPF/DKIM alinhados com o domínio.
 *
 * Medido no servidor antes de escrever: `openssl` disponível,
 * `stream_socket_client` liberado, e `ssl://email-ssl.com.br:465` responde
 * `220 proxy.email-ssl.com.br ESMTP Postfix`.
 */

class SmtpError extends RuntimeException
{
}

/**
 * Lê a resposta do servidor, juntando linhas de continuação (`250-`).
 * Sem esse tratamento, o EHLO (que responde em várias linhas) dessincroniza o
 * diálogo e todo comando seguinte parece falhar.
 */
function smtp_ler(mixed $conn, string $etapa): string
{
    $resposta = '';
    while (true) {
        $linha = fgets($conn, 1024);
        if ($linha === false) {
            throw new SmtpError("SMTP sem resposta em {$etapa}.");
        }
        $resposta .= $linha;
        // Formato: "250-texto" continua; "250 texto" encerra.
        if (strlen($linha) >= 4 && $linha[3] === ' ') {
            break;
        }
    }

    $codigo = (int) substr($resposta, 0, 3);
    if ($codigo >= 400) {
        throw new SmtpError("SMTP recusou em {$etapa}: " . trim($resposta));
    }

    return $resposta;
}

function smtp_enviar_comando(mixed $conn, string $comando, string $etapa): string
{
    fwrite($conn, $comando . "\r\n");

    return smtp_ler($conn, $etapa);
}

/**
 * Envia uma mensagem multipart (HTML + texto alternativo + anexos).
 *
 * @param list<array{nome: string, tipo: string, conteudo: string}> $anexos
 */
function smtp_send(
    array $config,
    string $paraEmail,
    string $paraNome,
    string $assunto,
    string $html,
    string $texto,
    array $anexos = []
): void {
    $host = $config['smtp_host'] ?? '';
    $porta = (int) ($config['smtp_port'] ?? 465);
    $usuario = $config['smtp_user'] ?? '';
    $senha = $config['smtp_password'] ?? '';
    $remetenteNome = $config['smtp_from_name'] ?? 'Kriativos On Board';

    if ($host === '' || $usuario === '' || $senha === '') {
        throw new SmtpError('SMTP não configurado.');
    }

    // TLS implícito: a 465 já abre cifrada, diferente da 587 (STARTTLS).
    $contexto = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true],
    ]);
    $erroNum = 0;
    $erroMsg = '';
    $conn = @stream_socket_client(
        "ssl://{$host}:{$porta}",
        $erroNum,
        $erroMsg,
        20,
        STREAM_CLIENT_CONNECT,
        $contexto
    );
    if ($conn === false) {
        throw new SmtpError("Não conectou em {$host}:{$porta} ({$erroNum} {$erroMsg}).");
    }
    stream_set_timeout($conn, 20);

    try {
        smtp_ler($conn, 'banner');
        smtp_enviar_comando($conn, 'EHLO kriativosonboard.com.br', 'EHLO');
        smtp_enviar_comando($conn, 'AUTH LOGIN', 'AUTH');
        smtp_enviar_comando($conn, base64_encode($usuario), 'usuário');
        smtp_enviar_comando($conn, base64_encode($senha), 'senha');
        smtp_enviar_comando($conn, "MAIL FROM:<{$usuario}>", 'MAIL FROM');
        smtp_enviar_comando($conn, "RCPT TO:<{$paraEmail}>", 'RCPT TO');
        smtp_enviar_comando($conn, 'DATA', 'DATA');

        $mensagem = smtp_montar_mensagem(
            $usuario,
            $remetenteNome,
            $paraEmail,
            $paraNome,
            $assunto,
            $html,
            $texto,
            $anexos
        );

        // Dot-stuffing: uma linha que começa com "." encerraria o DATA.
        $mensagem = preg_replace('/^\./m', '..', $mensagem) ?? $mensagem;
        fwrite($conn, $mensagem . "\r\n.\r\n");
        smtp_ler($conn, 'envio');

        smtp_enviar_comando($conn, 'QUIT', 'QUIT');
    } finally {
        if (is_resource($conn)) {
            fclose($conn);
        }
    }
}

/**
 * Monta a mensagem MIME.
 *
 * Estrutura: `multipart/mixed` (por causa do anexo) contendo um
 * `multipart/alternative` (texto + HTML). Clientes que não renderizam HTML
 * mostram a versão texto, e o anexo continua acessível nos dois casos.
 */
function smtp_montar_mensagem(
    string $de,
    string $deNome,
    string $para,
    string $paraNome,
    string $assunto,
    string $html,
    string $texto,
    array $anexos
): string {
    $limiteMixed = 'kob_mix_' . bin2hex(random_bytes(8));
    $limiteAlt = 'kob_alt_' . bin2hex(random_bytes(8));

    $cabecalhos = [
        'From: ' . smtp_codificar_nome($deNome) . " <{$de}>",
        'To: ' . ($paraNome !== '' ? smtp_codificar_nome($paraNome) . " <{$para}>" : $para),
        'Subject: ' . smtp_codificar_nome($assunto),
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@kriativosonboard.com.br>',
        'MIME-Version: 1.0',
        // Sem Reply-To de propósito: o corpo da mensagem orienta a falar pelo
        // WhatsApp, então apontar para uma caixa de e-mail contradiria a
        // instrução — e se a caixa não existir, a resposta volta com erro.
        // O cabeçalho abaixo é o padrão para mensagem automática: sinaliza aos
        // servidores que não se deve gerar resposta automática (férias etc.).
        'Auto-Submitted: auto-generated',
        "Content-Type: multipart/mixed; boundary=\"{$limiteMixed}\"",
    ];

    $corpo = [];
    $corpo[] = "--{$limiteMixed}";
    $corpo[] = "Content-Type: multipart/alternative; boundary=\"{$limiteAlt}\"";
    $corpo[] = '';
    $corpo[] = "--{$limiteAlt}";
    $corpo[] = 'Content-Type: text/plain; charset=UTF-8';
    $corpo[] = 'Content-Transfer-Encoding: base64';
    $corpo[] = '';
    $corpo[] = chunk_split(base64_encode($texto), 76, "\r\n");
    $corpo[] = "--{$limiteAlt}";
    $corpo[] = 'Content-Type: text/html; charset=UTF-8';
    $corpo[] = 'Content-Transfer-Encoding: base64';
    $corpo[] = '';
    $corpo[] = chunk_split(base64_encode($html), 76, "\r\n");
    $corpo[] = "--{$limiteAlt}--";

    foreach ($anexos as $anexo) {
        $corpo[] = '';
        $corpo[] = "--{$limiteMixed}";
        $corpo[] = "Content-Type: {$anexo['tipo']}; name=\"{$anexo['nome']}\"";
        $corpo[] = "Content-Disposition: attachment; filename=\"{$anexo['nome']}\"";
        $corpo[] = 'Content-Transfer-Encoding: base64';
        $corpo[] = '';
        $corpo[] = chunk_split(base64_encode($anexo['conteudo']), 76, "\r\n");
    }

    $corpo[] = "--{$limiteMixed}--";

    return implode("\r\n", $cabecalhos) . "\r\n\r\n" . implode("\r\n", $corpo);
}

/**
 * Codifica cabeçalho com acento em MIME encoded-word.
 * Sem isso, "Confirmação" chega como "Confirma??o" em vários clientes.
 */
function smtp_codificar_nome(string $valor): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $valor) === 1) {
        return $valor;
    }

    return '=?UTF-8?B?' . base64_encode($valor) . '?=';
}
