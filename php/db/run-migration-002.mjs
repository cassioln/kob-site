#!/usr/bin/env node
/**
 * Executa a migration 002_add_bus_number e auto-aloca os registros existentes.
 *
 * Uso: node php/db/run-migration-002.mjs
 */
import mysql from 'mysql2/promise';

const BUS_CAPACITY = 46;

const conn = await mysql.createConnection({
  host: '186.202.152.70',
  port: 3306,
  user: 'db_kob_msql',
  password: 'V@nitheolima30',
  database: 'db_kob_msql',
  timezone: '+00:00',
});

// ── 1. Verificar se a coluna já existe ──────────────────────────────────
const [cols] = await conn.execute(
  "SHOW COLUMNS FROM bus_registrations LIKE 'bus_number'"
);

if (cols.length === 0) {
  console.log('➕ Adicionando coluna bus_number...');
  await conn.execute(`
    ALTER TABLE bus_registrations
      ADD COLUMN bus_number TINYINT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Número do ônibus (1, 2, 3…). NULL = não alocado.'
      AFTER status_detail
  `);

  // Verificar se o índice já existe antes de criar
  const [indexes] = await conn.execute(
    "SHOW INDEX FROM bus_registrations WHERE Key_name = 'bus_registrations_bus_number_idx'"
  );
  if (indexes.length === 0) {
    await conn.execute(`
      CREATE INDEX bus_registrations_bus_number_idx
        ON bus_registrations (bus_number)
    `);
  }
  console.log('✅ Coluna e índice criados com sucesso.');
} else {
  console.log('ℹ️  Coluna bus_number já existe, pulando DDL.');
}

// ── 2. Auto-alocar registros confirmados existentes ─────────────────────
const [confirmed] = await conn.execute(`
  SELECT r.id,
         (r.passenger_count + r.children_count) AS total_a_bordo
    FROM bus_registrations r
   WHERE r.status = 'confirmed'
     AND r.bus_number IS NULL
   ORDER BY r.paid_at ASC, r.created_at ASC
`);

if (confirmed.length === 0) {
  console.log('ℹ️  Nenhum registro confirmado sem bus_number para alocar.');
} else {
  console.log(`🚌 Alocando ${confirmed.length} reservas confirmadas...`);

  // Contar ocupação atual dos ônibus (caso alguns já tenham bus_number)
  const [existing] = await conn.execute(`
    SELECT bus_number,
           SUM(passenger_count + children_count) AS ocupacao
      FROM bus_registrations
     WHERE status = 'confirmed' AND bus_number IS NOT NULL
     GROUP BY bus_number
     ORDER BY bus_number
  `);
  const ocupacao = {};
  for (const row of existing) {
    ocupacao[row.bus_number] = Number(row.ocupacao);
  }

  let allocated = 0;
  for (const reg of confirmed) {
    const size = Number(reg.total_a_bordo);
    // Encontrar o primeiro ônibus com espaço
    let busNum = 1;
    while (true) {
      const current = ocupacao[busNum] || 0;
      if (current + size <= BUS_CAPACITY) {
        break;
      }
      busNum++;
    }
    ocupacao[busNum] = (ocupacao[busNum] || 0) + size;
    await conn.execute(
      'UPDATE bus_registrations SET bus_number = ? WHERE id = ?',
      [busNum, reg.id]
    );
    allocated++;
  }
  console.log(`✅ ${allocated} reservas alocadas.`);

  // Mostrar distribuição
  for (const [bus, count] of Object.entries(ocupacao).sort((a, b) => a[0] - b[0])) {
    console.log(`   Ônibus ${bus}: ${count}/${BUS_CAPACITY} pessoas`);
  }
}

await conn.end();
console.log('\n🏁 Migration 002 concluída.');
