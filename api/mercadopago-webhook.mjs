import { handleMercadoPagoWebhook } from '../server/http.mjs';

// Endpoint servidor-para-servidor: nenhum header de CORS é emitido aqui.
export default async function handler(request, response) {
  const result = await handleMercadoPagoWebhook({
    method: request.method,
    body: request.body
  });
  response.setHeader('Cache-Control', 'no-store');
  response.status(result.statusCode).json(result.body);
}
