import { handleCreatePixRequest } from '../../server/http.mjs';

export async function handler(event) {
  const result = await handleCreatePixRequest({
    method: event.httpMethod,
    body: event.body,
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
