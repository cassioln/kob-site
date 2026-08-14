/**
 * CORS centralizado para a API do Kriativos On Board.
 *
 * Contexto: o site é servido pela Locaweb (estático) e a API pode ficar em um
 * subdomínio separado (ex.: https://api.kriativosonboard.com.br) publicado em
 * Vercel/Netlify. Isso torna toda chamada do navegador cross-origin.
 *
 * Regras não negociáveis:
 *  - allowlist EXPLÍCITA (ALLOWED_ORIGINS), nunca wildcard em endpoint de dados;
 *  - a origem só é refletida se estiver na allowlist;
 *  - `Vary: Origin` sempre presente nos endpoints de dados (evita cache poisoning);
 *  - preflight OPTIONS responde 204 com Allow-Methods/Allow-Headers;
 *  - o webhook do Mercado Pago é servidor-para-servidor e NÃO recebe CORS.
 */

/** Origens liberadas quando ALLOWED_ORIGINS não está definida. */
export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'https://kriativosonboard.com.br',
  'https://www.kriativosonboard.com.br'
]);

/** Headers de requisição que o front precisa enviar. */
export const ALLOWED_REQUEST_HEADERS = 'Content-Type, X-Idempotency-Key';

/** Cache do preflight no navegador (segundos). */
export const PREFLIGHT_MAX_AGE = '600';

function normalizeOrigin(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Origem é sempre scheme://host[:port], sem path e sem barra final.
  return trimmed.replace(/\/+$/, '');
}

/**
 * Lê a allowlist do ambiente. Entradas vazias, `*` e `null` são descartadas:
 * wildcard nunca é aceito, nem por configuração equivocada.
 * @param {Record<string, string|undefined>} [env]
 * @returns {string[]}
 */
export function parseAllowedOrigins(env = process.env) {
  const raw = env?.ALLOWED_ORIGINS;
  if (typeof raw !== 'string' || !raw.trim()) return [...DEFAULT_ALLOWED_ORIGINS];
  const parsed = raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin && origin !== '*' && origin !== 'null');
  return parsed.length ? [...new Set(parsed)] : [...DEFAULT_ALLOWED_ORIGINS];
}

/**
 * Extrai o header Origin de forma case-insensitive.
 * @param {Record<string, unknown>} [headers]
 * @returns {string}
 */
export function getRequestOrigin(headers = {}) {
  if (!headers || typeof headers !== 'object') return '';
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'origin') continue;
    return normalizeOrigin(Array.isArray(value) ? value[0] : value);
  }
  return '';
}

/**
 * @param {string} origin
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function isOriginAllowed(origin, env = process.env) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return parseAllowedOrigins(env).includes(normalized);
}

/**
 * Monta os headers de CORS de um endpoint de dados.
 *
 * @param {object} options
 * @param {Record<string, unknown>} [options.headers] headers da requisição
 * @param {string} [options.origin] origem já extraída (tem precedência)
 * @param {string[]} [options.methods] métodos do endpoint (OPTIONS é adicionado)
 * @param {Record<string, string|undefined>} [options.env]
 * @returns {Record<string, string>}
 */
export function buildCorsHeaders({
  headers,
  origin,
  methods = ['POST'],
  env = process.env
} = {}) {
  const requestOrigin = origin !== undefined ? normalizeOrigin(origin) : getRequestOrigin(headers);
  // Vary sempre: a resposta muda conforme a origem, com ou sem header liberado.
  const corsHeaders = { Vary: 'Origin' };
  if (!isOriginAllowed(requestOrigin, env)) return corsHeaders;

  const allowMethods = [...new Set([...methods, 'OPTIONS'])].join(', ');
  corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
  corsHeaders['Access-Control-Allow-Methods'] = allowMethods;
  corsHeaders['Access-Control-Allow-Headers'] = ALLOWED_REQUEST_HEADERS;
  corsHeaders['Access-Control-Max-Age'] = PREFLIGHT_MAX_AGE;
  return corsHeaders;
}

/**
 * Resposta de preflight. Sempre 204 sem corpo; os headers de permissão só
 * aparecem quando a origem está na allowlist.
 *
 * @param {Parameters<typeof buildCorsHeaders>[0]} options
 * @returns {{ statusCode: 204, body: null, headers: Record<string, string> }}
 */
export function buildPreflightResponse(options = {}) {
  return {
    statusCode: 204,
    body: null,
    headers: buildCorsHeaders(options)
  };
}

/** @param {string} [method] */
export function isPreflight(method) {
  return String(method || '').toUpperCase() === 'OPTIONS';
}

/**
 * Acopla os headers de CORS a um resultado `{ statusCode, body }` sem alterar
 * o contrato existente (statusCode e body seguem intactos).
 *
 * @param {{ statusCode: number, body: unknown, headers?: Record<string,string> }} result
 * @param {Parameters<typeof buildCorsHeaders>[0]} options
 */
export function withCorsHeaders(result, options = {}) {
  return {
    ...result,
    headers: { ...buildCorsHeaders(options), ...(result.headers || {}) }
  };
}
