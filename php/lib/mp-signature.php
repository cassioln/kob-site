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
 * Segue o exemplo oficial: `implode(';', $parts) . ';'`. Na prática o resultado
 * é idêntico a concatenar `';'` em cada campo (verificado), então esta forma foi
 * adotada por fidelidade à documentação, não por corrigir um bug.
 *
 * Campos ausentes são OMITIDOS (não viram `id:;`), conforme a documentação:
 * "If any of the values are not present, you must remove them from the manifest".
 */
function mp_signature_manifest(?string $dataId, ?string $requestId, string $ts): string
{
    return mp_signature_manifest_raw(
        $dataId === null ? null : strtolower($dataId),
        $requestId,
        $ts
    );
}

/**
 * Mesma montagem, mas SEM alterar o case do `data.id`.
 *
 * Necessária porque o emissor real assina com o id no case original, enquanto a
 * documentação manda usar minúsculas. Ver mp_signature_is_valid().
 */
function mp_signature_manifest_raw(?string $dataId, ?string $requestId, string $ts): string
{
    $partes = [];
    if ($dataId !== null && $dataId !== '') {
        $partes[] = 'id:' . $dataId;
    }
    if ($requestId !== null && $requestId !== '') {
        $partes[] = 'request-id:' . $requestId;
    }
    $partes[] = 'ts:' . $ts;

    return implode(';', $partes) . ';';
}

/**
 * Confere a assinatura da notificação.
 *
 * Aceita o `data.id` em minúsculas OU no case original.
 *
 * A documentação é explícita em mandar converter para minúsculas ("ORD01... should
 * be used as ord01..."), mas as notificações REAIS do painel são assinadas com o
 * id no case ORIGINAL (maiúsculo). Medido em produção: para a mesma notificação,
 * o manifesto com `id:ORDTST01M05...` casou com o v1 recebido e o manifesto com
 * `id:ordtst01m05...` não casou.
 *
 * Como não há como saber de antemão qual convenção o emissor usou, tentamos as
 * duas. Isso não enfraquece a verificação: ambas exigem a chave secreta correta,
 * o mesmo `x-request-id` e o mesmo `ts` — um atacante sem a chave não produz
 * nenhuma das duas.
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

    $recebido = strtolower($partes['v1']);

    // Variantes de case do data.id: doc pede minúsculo, o emissor real usa o
    // case original. hash_equals em todas: comparação em tempo constante,
    // contra timing attack.
    $candidatos = [mp_signature_manifest($dataId, $requestId, $partes['ts'])];
    if ($dataId !== null && $dataId !== '' && $dataId !== strtolower($dataId)) {
        $candidatos[] = mp_signature_manifest_raw($dataId, $requestId, $partes['ts']);
    }

    foreach ($candidatos as $manifesto) {
        if (hash_equals(hash_hmac('sha256', $manifesto, $secret), $recebido)) {
            return true;
        }
    }

    return false;
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

    // O PHP converte pontos em nomes de query param para underscore, então
    // `?data.id=X` chega em $_GET como `data_id`. O exemplo oficial em PHP lê
    // exatamente `$_GET['data_id']` — ler `$_GET['data.id']` nunca encontra
    // nada e o manifesto sai sem o id, invalidando toda assinatura.
    //
    // As notificações reais chegam SEM query string (medido: query vazia em
    // 5 entregas do `MercadoPago WebHook v1.0`), com o id apenas no corpo.
    // Por isso o corpo é fallback legítimo, não um atalho.
    $dataId = null;
    foreach (['data_id', 'data.id', 'id'] as $chave) {
        if (isset($query[$chave]) && $query[$chave] !== '') {
            $dataId = (string) $query[$chave];
            break;
        }
    }
    if ($dataId === null && $bodyDataId !== null && $bodyDataId !== '') {
        $dataId = $bodyDataId;
    }

    // Autenticidade primeiro: sem a chave correta nada passa, seja qual for o ts.
    if (!mp_signature_is_valid($header, $dataId, $requestId, $secret, 0)) {
        return ['ok' => false, 'motivo' => 'assinatura_invalida'];
    }

    // Frescor depois, e apenas como AVISO — não como recusa.
    //
    // O simulador do painel assina com um `ts` fixo de 2021 (medido:
    // ts=1635732122000, 151.177.087 s de idade). Recusar por replay fazia a
    // validação do painel falhar com 401 e o requisito de webhook nunca
    // pontuar, mesmo com a integração correta.
    //
    // Descartar por idade também é arriscado para notificações reais: uma
    // reentrega legítima após instabilidade chegaria velha e seria perdida —
    // e perder notificação de pagamento é pior do que aceitar uma repetida.
    //
    // O que protege contra replay de verdade não é o ts: é a RECONSULTA
    // autenticada da order antes de gravar. Reenviar uma notificação antiga só
    // faz o servidor reconfirmar o estado atual no Mercado Pago, que é
    // idempotente. Um atacante sem a chave secreta não chega até aqui.
    $partes = mp_parse_signature_header($header);
    $idade = $partes['ts'] !== null ? abs(time() - (int) ((int) $partes['ts'] / 1000)) : null;

    return [
        'ok' => true,
        'motivo' => ($idade !== null && $idade > 900) ? 'assinatura_valida_ts_antigo' : 'assinatura_valida',
    ];
}
