import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

/**
 * Acrescenta dados fictícios ao banco de teste sem apagar o que já existe.
 *
 * Executar com:
 *   node --env-file=.env php/db/add-dummy-fleet-data.mjs
 */

function gerarCpf(base) {
  const digitos = String(base).padStart(9, '0').slice(-9).split('').map(Number);
  let primeiro = digitos.reduce((total, valor, indice) => total + valor * (10 - indice), 0);
  primeiro = (primeiro * 10) % 11;
  if (primeiro === 10) primeiro = 0;
  digitos.push(primeiro);

  let segundo = digitos.reduce((total, valor, indice) => total + valor * (11 - indice), 0);
  segundo = (segundo * 10) % 11;
  if (segundo === 10) segundo = 0;
  digitos.push(segundo);

  return digitos.join('');
}

function telefone(numero) {
  return `11${9}${String(10000000 + numero).padStart(8, '0')}`;
}

const reservas = [
  { pagantes: 3, criancas: 0, grupo: 'Teste Frota 01', nomes: ['Marina Alves Rocha', 'Caio Rocha', 'Livia Rocha'] },
  { pagantes: 1, criancas: 1, grupo: null, nomes: ['Rafael Mendes Lima', 'Bia Lima'] },
  { pagantes: 5, criancas: 2, grupo: 'Teste Frota 03', nomes: ['Camila Nunes Dias', 'Enzo Dias', 'Bruna Dias', 'Diego Dias', 'Sofia Dias', 'Lara Dias', 'Theo Dias'] },
  { pagantes: 2, criancas: 0, grupo: 'Teste Frota 04', nomes: ['Felipe Cardoso', 'Nina Cardoso'] },
  { pagantes: 4, criancas: 1, grupo: 'Teste Frota 05', nomes: ['Juliana Freitas', 'Otavio Freitas', 'Ana Freitas', 'Igor Freitas', 'Malu Freitas'] },
  { pagantes: 6, criancas: 0, grupo: 'Teste Frota 06', nomes: ['Gustavo Ramos', 'Laura Ramos', 'Pedro Ramos', 'Alice Ramos', 'Vitor Ramos', 'Clara Ramos'] },
  { pagantes: 1, criancas: 0, grupo: null, nomes: ['Bianca Moreira'] },
  { pagantes: 3, criancas: 2, grupo: 'Teste Frota 08', nomes: ['Daniel Souza', 'Helena Souza', 'Lucas Souza', 'Davi Souza', 'Mia Souza'] },
  { pagantes: 4, criancas: 0, grupo: 'Teste Frota 09', nomes: ['Patricia Carvalho', 'Renato Carvalho', 'Alice Carvalho', 'Hugo Carvalho'] },
  { pagantes: 5, criancas: 1, grupo: 'Teste Frota 10', nomes: ['Leonardo Oliveira', 'Manuela Oliveira', 'Bruno Oliveira', 'Cecilia Oliveira', 'Andre Oliveira', 'Noah Oliveira'] }
];

const insertRegistration = `
  INSERT INTO bus_registrations (
    id, event_slug, external_reference, primary_name, primary_cpf, primary_birth_date,
    email, whatsapp, passenger_count, children_count, group_name, amount_cents,
    currency, status, status_detail, mercadopago_order_id, mercadopago_payment_id,
    paid_at, confirmation_email_sent_at, admin_email_sent_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const insertPassenger = `
  INSERT INTO bus_passengers (
    registration_id, \`position\`, full_name, cpf, whatsapp, email,
    is_primary, is_minor, is_child_lap, confirmation_email_sent_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

async function run() {
  if (!process.env.MYSQL_PASSWORD) {
    throw new Error('MYSQL_PASSWORD não configurado.');
  }

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '186.202.152.70',
    user: process.env.MYSQL_USER || 'db_kob_msql',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'db_kob_msql'
  });

  let inseridas = 0;
  let puladas = 0;
  let cpfBase = 985000000;

  try {
    for (let indice = 0; indice < reservas.length; indice += 1) {
      const reserva = reservas[indice];
      const marcador = `dummy_extra_frota_${String(indice + 1).padStart(2, '0')}`;
      const [existente] = await conn.execute(
        'SELECT id FROM bus_registrations WHERE external_reference = ? LIMIT 1',
        [marcador]
      );

      if (existente.length) {
        puladas += 1;
        continue;
      }

      const id = randomUUID();
      const primaryName = reserva.nomes[0];
      const primaryCpf = gerarCpf(cpfBase++);
      const primaryTel = telefone(indice + 1);
      const email = `teste.frota.${indice + 1}@exemplo.invalid`;
      const momento = new Date(Date.now() - (reservas.length - indice) * 90 * 60 * 1000);
      const orderId = `DUMMY_EXTRA_ORDER_${String(indice + 1).padStart(2, '0')}`;
      const paymentId = `DUMMY_EXTRA_PAYMENT_${String(indice + 1).padStart(2, '0')}`;

      await conn.beginTransaction();
      try {
        await conn.execute(insertRegistration, [
          id,
          'kriativos-onboard-2026',
          marcador,
          primaryName,
          primaryCpf,
          '1992-06-15',
          email,
          primaryTel,
          reserva.pagantes,
          reserva.criancas,
          reserva.grupo,
          reserva.pagantes * 12000,
          'BRL',
          'confirmed',
          'accredited',
          orderId,
          paymentId,
          momento,
          momento,
          momento,
          momento,
          momento
        ]);

        let posicao = 1;
        for (let pessoa = 0; pessoa < reserva.pagantes; pessoa += 1) {
          const nome = reserva.nomes[pessoa];
          const cpf = pessoa === 0 ? primaryCpf : gerarCpf(cpfBase++);
          const whatsapp = pessoa === 0 || pessoa % 2 === 0 ? telefone((indice + 1) * 10 + pessoa) : null;
          const passageiroEmail = pessoa === 0 ? email : null;
          await conn.execute(insertPassenger, [
            id,
            posicao++,
            nome,
            cpf,
            whatsapp,
            passageiroEmail,
            pessoa === 0 ? 1 : 0,
            0,
            0,
            pessoa === 0 ? momento : null,
            momento
          ]);
        }

        for (let crianca = 0; crianca < reserva.criancas; crianca += 1) {
          const nome = reserva.nomes[reserva.pagantes + crianca];
          await conn.execute(insertPassenger, [
            id,
            posicao++,
            nome,
            gerarCpf(cpfBase++),
            null,
            null,
            0,
            1,
            1,
            null,
            momento
          ]);
        }

        await conn.commit();
        inseridas += 1;
      } catch (erro) {
        await conn.rollback();
        throw erro;
      }
    }
  } finally {
    await conn.end();
  }

  const pagantes = reservas.reduce((total, reserva) => total + reserva.pagantes, 0);
  const criancas = reservas.reduce((total, reserva) => total + reserva.criancas, 0);
  console.log(`Reservas fictícias inseridas: ${inseridas}`);
  console.log(`Reservas já existentes ignoradas: ${puladas}`);
  console.log(`Pagantes adicionados: ${inseridas === reservas.length ? pagantes : 'verifique os marcadores'}`);
  console.log(`Crianças de colo adicionadas: ${inseridas === reservas.length ? criancas : 'verifique os marcadores'}`);
}

run().catch((erro) => {
  console.error('Erro ao adicionar dados fictícios:', erro.message);
  process.exit(1);
});
