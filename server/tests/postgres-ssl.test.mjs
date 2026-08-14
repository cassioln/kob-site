import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPoolConfig } from '../db/postgres.mjs';

const BASE = 'postgresql://db_kob:senha@db_kob.postgresql.dbaas.com.br:5432/db_kob';

test('exige DATABASE_URL', () => {
  assert.throws(() => buildPoolConfig({}), /DATABASE_URL não configurado/);
});

test('remove sslmode da URL para o objeto ssl não ser ignorado pelo pg v9', () => {
  const config = buildPoolConfig({ DATABASE_URL: `${BASE}?sslmode=require` });
  assert.equal(config.connectionString.includes('sslmode'), false);
});

test('valida a cadeia por padrão', () => {
  const config = buildPoolConfig({ DATABASE_URL: BASE });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test('permite cert expirado da Locaweb sem desligar a criptografia', () => {
  const config = buildPoolConfig({
    DATABASE_URL: `${BASE}?sslmode=require`,
    PGSSL_REJECT_UNAUTHORIZED: 'false'
  });
  // ssl continua sendo objeto (TLS ativo), só a verificação da cadeia cede.
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
  assert.notEqual(config.ssl, false);
});

test('sslmode=disable e PGSSL=disable desligam TLS de forma explícita', () => {
  assert.equal(buildPoolConfig({ DATABASE_URL: `${BASE}?sslmode=disable` }).ssl, false);
  assert.equal(buildPoolConfig({ DATABASE_URL: BASE, PGSSL: 'disable' }).ssl, false);
});

test('preserva host, base e demais parâmetros da URL', () => {
  const config = buildPoolConfig({
    DATABASE_URL: `${BASE}?sslmode=require&application_name=kob`
  });
  const url = new URL(config.connectionString);
  assert.equal(url.hostname, 'db_kob.postgresql.dbaas.com.br');
  assert.equal(url.pathname, '/db_kob');
  assert.equal(url.searchParams.get('application_name'), 'kob');
});
