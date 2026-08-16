<?php

declare(strict_types=1);

/**
 * Validação da origem das notificações do Mercado Pago (header `x-signature`).
 *
 * O webhook já é seguro contra notificação forjada porque RECONSULTA a order na
 * API autenticada antes de mudar qualquer coisa: quem inventar um POST não
 * consegue aprovar vaga nenhuma. Esta validação é a camada anterior — descarta
 * a requisição antes de gastar uma chamada ao provedor, e é o que o painel de
 * qualidade espera de uma integração madura.
 *
 * Especificação (documentação oficial):
 *   1. o header vem como `ts=<millis>,v1=<hmac_hex>`;
 *   2. o manifesto é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *      - `data.id` em MINÚSCULAS quando vier alfanumérico maiúsculo;
 *      - campos ausentes saem do manifesto, em vez de virar string vazia;
 *   3. HMAC-SHA256 hex, com a chave secreta da aplicação;
 *   4. comparação com o `v1` recebido.
 *
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
 */

/**
 * Quebra o header `x-signature` em ts e v1.
 *
 * @return array{ts: ?string, v1: ?string}
 */
function mp_parse_signature_header(string $header): array
{
    $out = ['ts' => null, 'v1' => null];
    foreach (explode(',', $header) as $parte) {
        $par = explode('=', trim($parte), 2);
        if (count($par) !== 2) {
            continue;
        }
        $chave = strtolower(trim($par[0]));
        $valor = trim($par[1]);
        if ($chave === 'ts' || $chave === 'v1') {
            $out[$chave] = $valor;
        }
    }

    return $out;
}

/**
 * Monta o manifesto assinado.
 *
 * Campos ausentes são OMITIDOS (não viram `id:;`), conforme a documentação:
 * "If any of the values are not present, you must remove them from the manifest".
 */
function mp_signature_manifest(?string $dataId, ?string $requestId, string $ts): string
{
    $partes = [];
    if ($dataId !== null && $dataId !== '') {
        // A doc exige minúsculas: ORD01... deve ser usado como ord01...
        $partes[] = 'id:' . strtolower($dataId) . ';';
    }
    if ($requestId !== null && $requestId !== '') {
        $partes[] = 'request-id:' . $requestId . ';';
    }
    $partes[] = 'ts:' . $ts . ';';

    return implode('', $partes);
}

/**
 * Confere a assinatura da notificação.
 *
 * @param string      $header    Conteúdo de `x-signature`.
 * @param ?string     $dataId    `data.id` (query string tem precedência).
 * @param ?string     $requestId Header `x-request-id`.
 * @param string      $secret    Chave secreta da aplicação, por ambiente.
 * @param int         $toleranciaSegundos Janela aceita para o ts (0 = sem checar).
 */
function mp_signature_is_valid(
    string $header,
    ?string $dataId,
    ?string $requestId,
    string $secret,
    int $toleranciaSegundos = 900
): bool {
    if ($secret === '' || $header === '') {
        return false;
    }

    $partes = mp_parse_signature_header($header);
    if ($partes['ts'] === null || $partes['v1'] === null) {
        return false;
    }

    // Replay: o ts vem em MILISSEGUNDOS.
    if ($toleranciaSegundos > 0) {
        $idade = abs(time() - (int) ((int) $partes['ts'] / 1000));
        if ($idade > $toleranciaSegundos) {
            return false;
        }
    }

    $esperado = hash_hmac(
        'sha256',
        mp_signature_manifest($dataId, $requestId, $partes['ts']),
        $secret
    );

    // hash_equals: comparação em tempo constante, contra timing attack.
    return hash_equals($esperado, strtolower($partes['v1']));
}

/**
 * Decide se a requisição atual deve ser aceita.
 *
 * Fail-open deliberado quando NÃO há chave configurada: a reconciliação e a
 * reconsulta da order já protegem o fluxo, e derrubar o webhook por falta de
 * config deixaria vagas pendentes sem necessidade. Com chave configurada, passa
 * a ser fail-closed — assinatura inválida é descartada.
 *
 * @param array<string, mixed> $server Normalmente $_SERVER.
 * @param array<string, mixed> $query  Normalmente $_GET.
 * @return array{ok: bool, motivo: string}
 */
function mp_webhook_origin_check(array $server, array $query, ?string $secret, ?string $bodyDataId = null): array
{
    if ($secret === null || $secret === '') {
        return ['ok' => true, 'motivo' => 'sem_chave_configurada'];
    }

    $header = (string) ($server['HTTP_X_SIGNATURE'] ?? '');
    if ($header === '') {
        return ['ok' => false, 'motivo' => 'sem_x_signature'];
    }

    $requestId = isset($server['HTTP_X_REQUEST_ID']) ? (string) $server['HTTP_X_REQUEST_ID'] : null;

    // A doc manda usar o data.id da QUERY STRING; o corpo é fallback para
    // simulações do painel que não anexam query params.
    $dataId = null;
    if (isset($query['data.id'])) {
        $dataId = (string) $query['data.id'];
    } elseif (isset($query['data_id'])) {
        $dataId = (string) $query['data_id'];
    } elseif ($bodyDataId !== null && $bodyDataId !== '') {
        $dataId = $bodyDataId;
    }

    $valido = mp_signature_is_valid($header, $dataId, $requestId, $secret);

    return [
        'ok' => $valido,
        'motivo' => $valido ? 'assinatura_valida' : 'assinatura_invalida',
    ];
}
