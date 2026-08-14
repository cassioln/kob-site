import { handleRegistrationStatusRequest } from '../server/http.mjs';

export default async function handler(request, response) {
  const result = await handleRegistrationStatusRequest({
    method: request.method,
    registrationId: request.query?.id,
    headers: request.headers
  });
  response.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(result.headers || {})) {
    response.setHeader(name, value);
  }
  if (result.body === null) {
    response.status(result.statusCode).end();
    return;
  }
  response.status(result.statusCode).json(result.body);
}
