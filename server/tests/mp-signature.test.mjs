/**
 * Contrato da validação de assinatura do webhook do Mercado Pago.
 *
 * A implementação de produção é PHP (php/lib/mp-signature.php), mas a regra é
 * pura: manifesto + HMAC-SHA256. Aqui ela é reimplementada em JS e checada
 * contra o vetor da documentação oficial, para travar a FORMA do manifesto —
 * que é onde toda implementação erra (ordem dos campos, `;` final, minúsculas
 * do data.id, omissão de campos ausentes).
 *
 * Se este teste passar e o PHP falhar em produção, a diferença está no PHP e
 * não no entendimento da especificação.
 *
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

/** Quebra `ts=...,v1=...` em partes. */
function parseSignatureHeader(header) {
  const out = { ts: null, v1: null };
  for (const parte of String(header).split(',')) {
    const [k, v] = parte.trim().split('=', 2);
    const chave = String(k).trim().toLowerCase();
    if (chave === 'ts' || chave === 'v1') out[chave] = String(v).trim();
  }
  return out;
}

/** Manifesto assinado. Campos ausentes são OMITIDOS, não vazios. */
function signatureManifest(dataId, requestId, ts) {
  const partes = [];
  if (dataId) partes.push(`id:${String(dataId).toLowerCase()};`);
  if (requestId) partes.push(`request-id:${requestId};`);
  partes.push(`ts:${ts};`);
  return partes.join('');
}

function hmacHex(secret, mensagem) {
  return createHmac('sha256', secret).update(mensagem).digest('hex');
}

test('manifesto segue exatamente o template da documentação', () => {
  // Exemplo da doc: data.id=ORD01JQ4S4KY8HWQ6NA5PXB65B3D3, ts=1742505638683
  const m = signatureManifest(
    'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3',
    '2066ca19-c6f1-498a-be75-1923005edd06',
    '1742505638683'
  );

  assert.equal(
    m,
    'id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:2066ca19-c6f1-498a-be75-1923005edd06;ts:1742505638683;'
  );

  // O data.id maiúsculo DEVE virar minúsculo: a doc é explícita nisso e é o
  // erro mais comum, porque a notificação chega com ORD... em maiúsculas.
  assert.ok(m.includes('ord01jq'), 'data.id precisa estar em minúsculas');
  assert.ok(!m.includes('ORD01JQ'), 'data.id maiúsculo invalida a assinatura');
});

test('campos ausentes saem do manifesto em vez de virar string vazia', () => {
  // "If any of the values are not present, you must remove them from the manifest".
  assert.equal(signatureManifest(null, 'req-1', '123'), 'request-id:req-1;ts:123;');
  assert.equal(signatureManifest('ORD1', null, '123'), 'id:ord1;ts:123;');
  assert.equal(signatureManifest(null, null, '123'), 'ts:123;');
  // O erro a evitar: 'id:;request-id:;ts:123;'
  assert.ok(!signatureManifest(null, null, '123').includes('id:;'));
});

test('assinatura válida confere e qualquer alteração invalida', () => {
  const secret = 'chave-secreta-de-teste';
  const dataId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';
  const requestId = '2066ca19-c6f1-498a-be75-1923005edd06';
  const ts = String(Date.now());

  const v1 = hmacHex(secret, signatureManifest(dataId, requestId, ts));
  const header = `ts=${ts},v1=${v1}`;

  const partes = parseSignatureHeader(header);
  assert.equal(partes.ts, ts);
  assert.equal(partes.v1, v1);

  // Confere.
  assert.equal(hmacHex(secret, signatureManifest(dataId, requestId, partes.ts)), partes.v1);

  // Cada campo é load-bearing: mexer em qualquer um quebra a assinatura.
  assert.notEqual(hmacHex(secret, signatureManifest('ORD_OUTRA', requestId, ts)), v1);
  assert.notEqual(hmacHex(secret, signatureManifest(dataId, 'req-outro', ts)), v1);
  assert.notEqual(hmacHex(secret, signatureManifest(dataId, requestId, '1')), v1);
  assert.notEqual(hmacHex('chave-errada', signatureManifest(dataId, requestId, ts)), v1);
});

test('header malformado não é aceito como válido', () => {
  for (const h of ['', 'lixo', 'ts=123', 'v1=abc', 'ts=,v1=']) {
    const p = parseSignatureHeader(h);
    const completo = Boolean(p.ts) && Boolean(p.v1);
    assert.equal(completo, false, `header "${h}" não deveria render ts+v1 válidos`);
  }
});
