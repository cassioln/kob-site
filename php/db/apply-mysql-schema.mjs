/**
 * Aplica o schema MySQL do ônibus fretado em um servidor real.
 *
 * Existe porque `DELIMITER $$` é um comando do CLIENTE mysql (CLI/phpMyAdmin),
 * não do servidor: enviar o arquivo inteiro por um driver falha com erro de
 * sintaxe e — pior — as tabelas são criadas mas as TRIGGERS não, deixando o
 * banco sem nenhuma validação no MySQL 5.7 (onde CHECK é ignorado).
 *
 * Uso:
 *   node php/db/apply-mysql-schema.mjs             # aplica
 *   node php/db/apply-mysql-schema.mjs --verify    # só confere o que existe
 *
 * Lê MYSQL_HOST/PORT/DATABASE/USER/PASSWORD do ambiente.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARQUIVO_SCHEMA = join(AQUI, '001_bus_registrations_mysql.sql');

/**
 * Divide o SQL em instruções executáveis por driver.
 * Trata os blocos DELIMITER como uma instrução única cada.
 */
export function dividirInstrucoes(sql) {
  const semComentarios = sql
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n');

  const instrucoes = [];
  let delimitador = ';';
  let buffer = '';

  for (const linha of semComentarios.split('\n')) {
    const troca = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(linha);
    if (troca) {
      if (buffer.trim()) {
        instrucoes.push(buffer.trim());
        buffer = '';
      }
      delimitador = troca[1];
      continue;
    }

    buffer += linha + '\n';

    let posicao = buffer.indexOf(delimitador);
    while (posicao !== -1) {
      const instrucao = buffer.slice(0, posicao).trim();
      if (instrucao) instrucoes.push(instrucao);
      buffer = buffer.slice(posicao + delimitador.length);
      posicao = buffer.indexOf(delimitador);
    }
  }

  if (buffer.trim()) instrucoes.push(buffer.trim());

  return instrucoes.filter(Boolean);
}

function configDoAmbiente(env = process.env) {
  const senha = env.MYSQL_PASSWORD;
  if (!senha) throw new Error('MYSQL_PASSWORD não configurado.');

  return {
    host: env.MYSQL_HOST || '186.202.152.70',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'db_kob_msql',
    password: senha,
    database: env.MYSQL_DATABASE || 'db_kob_msql',
    connectTimeout: 20_000
  };
}

async function inventario(conexao) {
  const [tabelas] = await conexao.query(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name LIKE 'bus_%' ORDER BY 1`
  );
  const [triggers] = await conexao.query(
    `SELECT trigger_name AS t FROM information_schema.triggers
      WHERE trigger_schema = DATABASE() ORDER BY 1`
  );

  return {
    tabelas: tabelas.map((linha) => linha.t),
    triggers: triggers.map((linha) => linha.t)
  };
}

async function principal() {
  const apenasVerificar = process.argv.includes('--verify');
  const conexao = await mysql.createConnection(configDoAmbiente());

  try {
    if (!apenasVerificar) {
      const instrucoes = dividirInstrucoes(readFileSync(ARQUIVO_SCHEMA, 'utf8'));
      let aplicadas = 0;
      for (const instrucao of instrucoes) {
        try {
          await conexao.query(instrucao);
          aplicadas += 1;
        } catch (erro) {
          // Reaplicar o schema é normal; só objetos já existentes são ignorados.
          if (['ER_TABLE_EXISTS_ERROR', 'ER_TRG_ALREADY_EXISTS', 'ER_DUP_KEYNAME'].includes(erro.code)) {
            continue;
          }
          throw new Error(`Falha em: ${instrucao.slice(0, 80)}… → ${erro.message}`);
        }
      }
      console.log(`instruções aplicadas: ${aplicadas}/${instrucoes.length}`);
    }

    const atual = await inventario(conexao);
    console.log(`tabelas (${atual.tabelas.length}): ${atual.tabelas.join(', ') || '(nenhuma)'}`);
    console.log(`triggers (${atual.triggers.length}): ${atual.triggers.join(', ') || '(nenhuma)'}`);

    // No MySQL 5.7 as CHECK constraints são ignoradas: sem trigger, o banco
    // aceitaria grupo sem pagante, status inválido e comprovante gigante.
    if (atual.triggers.length < 6) {
      console.error('ATENÇÃO: menos de 6 triggers. As regras de negócio NÃO estão protegidas.');
      process.exitCode = 1;
    }
  } finally {
    await conexao.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((erro) => {
    console.error(String(erro.message).replace(process.env.MYSQL_PASSWORD || '\u0000', '[REDACTED]'));
    process.exitCode = 1;
  });
}
