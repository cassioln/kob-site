import pg from 'pg';

const { Pool } = pg;
let pool;

export function buildPoolConfig(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL não configurado.');

  // `pg` >= 9 deixa o sslmode da URL vencer o objeto `ssl`, e trata
  // `require` como `verify-full`. Removemos o parâmetro da string para que a
  // política de TLS fique só aqui, explícita e testável.
  const url = new URL(env.DATABASE_URL);
  const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase();
  url.searchParams.delete('sslmode');

  const desligado = env.PGSSL === 'disable' || sslmode === 'disable';
  // O servidor PostgreSQL da Locaweb responde com certificado expirado. Sem
  // esta saída o cliente falha com CERT_HAS_EXPIRED e nada é gravado. O
  // tráfego continua cifrado; o que se perde é a validação da cadeia.
  const verificaCadeia = env.PGSSL_REJECT_UNAUTHORIZED !== 'false';

  return {
    connectionString: url.toString(),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: desligado ? false : { rejectUnauthorized: verificaCadeia }
  };
}

function getPool(env = process.env) {
  if (pool) return pool;
  pool = new Pool(buildPoolConfig(env));
  return pool;
}

export function createPostgresRepository(env = process.env) {
  const database = getPool(env);

  return {
    async createRegistration(record) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO bus_registrations
            (id, external_reference, primary_name, primary_cpf, email, whatsapp,
             passenger_count, children_count, amount_cents, currency, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BRL', 'payment_pending')`,
          [
            record.id,
            record.externalReference,
            record.primaryName,
            record.primaryCpf,
            record.email,
            record.whatsapp,
            record.passengerCount,
            record.childrenCount,
            record.amountCents
          ]
        );
        for (const passenger of record.passengers) {
          await client.query(
            `INSERT INTO bus_passengers
              (registration_id, position, full_name, cpf, is_primary)
             VALUES ($1, $2, $3, $4, $5)`,
            [record.id, passenger.position, passenger.fullName, passenger.cpf, passenger.position === 1]
          );
        }
        await client.query('COMMIT');
        return { id: record.id, externalReference: record.externalReference };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async updateRegistration(id, update) {
      const assignments = [];
      const values = [id];
      const add = (column, value) => {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      };

      if (update.status) add('status', update.status);
      if (Object.hasOwn(update, 'mercadopagoOrderId')) add('mercadopago_order_id', update.mercadopagoOrderId);
      if (Object.hasOwn(update, 'mercadopagoPaymentId')) add('mercadopago_payment_id', update.mercadopagoPaymentId);
      if (Object.hasOwn(update, 'statusDetail')) add('status_detail', update.statusDetail);
      if (Object.hasOwn(update, 'paidAt')) add('paid_at', update.paidAt);
      if (!assignments.length) return;

      assignments.push('updated_at = now()');
      await database.query(
        `UPDATE bus_registrations SET ${assignments.join(', ')} WHERE id = $1`,
        values
      );
    },

    async hasPaymentProof(id) {
      const result = await database.query(
        'SELECT 1 FROM bus_payment_proofs WHERE registration_id = $1 LIMIT 1',
        [id]
      );
      return result.rowCount > 0;
    },

    async createPaymentProof(proof) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO bus_payment_proofs
            (id, registration_id, file_name, mime_type, file_size, sha256, file_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (registration_id) DO UPDATE SET
             id = EXCLUDED.id,
             file_name = EXCLUDED.file_name,
             mime_type = EXCLUDED.mime_type,
             file_size = EXCLUDED.file_size,
             sha256 = EXCLUDED.sha256,
             file_data = EXCLUDED.file_data,
             uploaded_at = now()`,
          [proof.id, proof.registrationId, proof.fileName, proof.mimeType, proof.fileSize, proof.sha256, proof.fileData]
        );
        const result = await client.query(
          `UPDATE bus_registrations
              SET status = CASE WHEN status = 'paid_awaiting_proof' THEN 'confirmed' ELSE status END,
                  updated_at = now()
            WHERE id = $1
        RETURNING status`,
          [proof.registrationId]
        );
        await client.query('COMMIT');
        return { status: result.rows[0]?.status || 'payment_pending' };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async findByExternalReference(externalReference) {
      const result = await database.query(
        `SELECT id, external_reference, mercadopago_order_id
           FROM bus_registrations
          WHERE external_reference = $1
          LIMIT 1`,
        [externalReference]
      );
      return result.rows[0] || null;
    },

    async getRegistrationStatus(id) {
      const result = await database.query(
        `SELECT status, status_detail
           FROM bus_registrations
          WHERE id = $1
          LIMIT 1`,
        [id]
      );
      return result.rows[0] || null;
    }
  };
}

export function resetPostgresPoolForTests() {
  pool = undefined;
}
