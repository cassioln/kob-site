#!/usr/bin/env node
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const conn = await mysql.createConnection({
  host: '186.202.152.70',
  port: 3306,
  user: 'db_kob_msql',
  password: 'V@nitheolima30',
  database: 'db_kob_msql',
  multipleStatements: true,
});

const sql = fs.readFileSync(new URL('003_add_bus_settings.sql', import.meta.url), 'utf-8');

console.log('Executando migration 003_add_bus_settings.sql...');
await conn.query(sql);
console.log('✅ Migration executada com sucesso.');

await conn.end();
