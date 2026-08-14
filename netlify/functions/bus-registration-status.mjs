import { handleRegistrationStatusRequest } from '../../server/http.mjs';

export async function handler(event) {
  const result = await handleRegistrationStatusRequest({
    method: event.httpMethod,
    registrationId: event.queryStringParameters?.id,
    headers: event.headers
  });
  const headers = {
    'Cache-Control': 'no-store',
    ...(result.headers || {})
  };
  if (result.body === null) {
    return { statusCode: result.statusCode, headers, body: '' };
  }
  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(result.body)
  };
}
