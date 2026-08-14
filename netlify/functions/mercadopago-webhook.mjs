import { handleMercadoPagoWebhook } from '../../server/http.mjs';

// Endpoint servidor-para-servidor: nenhum header de CORS é emitido aqui.
export async function handler(event) {
  const result = await handleMercadoPagoWebhook({
    method: event.httpMethod,
    body: event.body
  });
  return {
    statusCode: result.statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(result.body)
  };
}
