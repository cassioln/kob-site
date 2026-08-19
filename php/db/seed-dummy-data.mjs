import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

// Gerador de CPF matematicamente válido
function gerarCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  
  // Primeiro dígito verificador
  let d1 = n.reduce((acc, val, idx) => acc + val * (10 - idx), 0);
  d1 = (d1 * 10) % 11;
  if (d1 === 10) d1 = 0;
  n.push(d1);

  // Segundo dígito verificador
  let d2 = n.reduce((acc, val, idx) => acc + val * (11 - idx), 0);
  d2 = (d2 * 10) % 11;
  if (d2 === 10) d2 = 0;
  n.push(d2);

  return n.join('');
}

const PRIMEIROS_NOMES = [
  'Lucas', 'Gabriel', 'Matheus', 'Rodrigo', 'Bruno', 'Felipe', 'Rafael', 'Thiago',
  'Guilherme', 'Leonardo', 'Gustavo', 'Marcelo', 'Eduardo', 'Henrique', 'Diego',
  'Mariana', 'Juliana', 'Beatriz', 'Camila', 'Larissa', 'Fernanda', 'Amanda',
  'Bruna', 'Carolina', 'Patricia', 'Renata', 'Vanessa', 'Aline', 'Jessica', 'Carla',
  'Ricardo', 'Danilo', 'Vitor', 'Alexandre', 'Daniel', 'Marcos', 'Andre', 'Fabio',
  'Tatiana', 'Priscila', 'Natalia', 'Debora', 'Bianca', 'Luana', 'Sabrina', 'Thais'
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade',
  'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos'
];

const NOMES_CRIANCAS = [
  'Pedro', 'Theo', 'Alice', 'Helena', 'Davi', 'Bernardo', 'Laura', 'Valentina',
  'Enzo', 'Lorenzo', 'Sophia', 'Isabella', 'Manuela', 'Arthur', 'Heitor', 'Miguel'
];

let nomeIdx = 0;
function gerarNomeCompleto() {
  const primeiro = PRIMEIROS_NOMES[nomeIdx % PRIMEIROS_NOMES.length];
  const sobre1 = SOBRENOMES[(nomeIdx * 3 + 7) % SOBRENOMES.length];
  const sobre2 = SOBRENOMES[(nomeIdx * 5 + 13) % SOBRENOMES.length];
  nomeIdx++;
  return `${primeiro} ${sobre1} ${sobre2}`;
}

function gerarNomeCrianca(sobrenomeFamilia) {
  const primeiro = NOMES_CRIANCAS[Math.floor(Math.random() * NOMES_CRIANCAS.length)];
  return `${primeiro} ${sobrenomeFamilia}`;
}

const DDD_LIST = ['11', '19', '12', '13', '15', '21', '31', '41'];
function gerarTelefone() {
  const ddd = DDD_LIST[Math.floor(Math.random() * DDD_LIST.length)];
  const num = '9' + Math.floor(10000000 + Math.random() * 90000000);
  return `${ddd}${num}`;
}

function gerarEmail(nome) {
  const clean = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.');
  const dominios = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br', 'icloud.com'];
  const dom = dominios[Math.floor(Math.random() * dominios.length)];
  return `${clean}@${dom}`;
}

const GRUPOS_CATALOGO = [
  'The Castles of Burgundy', 'Wingspan', 'Catan', 'Terraforming Mars', 'Ark Nova',
  'Azul', 'Scythe', 'Everdell', 'Root', 'Gloomhaven', 'Puerto Rico', 'Spirit Island',
  '7 Wonders', 'Pandemic', 'Carcassonne', 'Dixit', 'Ticket to Ride', 'Zombicide',
  'Power Grid', 'Agricola', 'Clank!', 'Harmonies', 'SETI', 'Projeto Gaia',
  'Mansions of Madness', 'Five Tribes', 'Terra Mystica', 'Mage Knight', 'Lisboa',
  'Twilight Struggle', 'Um Banquete a Odin', 'Caverna', 'On Mars', 'La Granja'
];

async function run() {
  const senha = process.env.MYSQL_PASSWORD || 'V@nitheolima30';
  const conn = await mysql.createConnection({
    host: '186.202.152.70',
    user: 'db_kob_msql',
    password: senha,
    database: 'db_kob_msql'
  });

  console.log('Limpando banco de dados para nova população...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE bus_payment_proofs');
  await conn.query('TRUNCATE TABLE bus_passengers');
  await conn.query('TRUNCATE TABLE bus_registrations');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  const insertReg = `
    INSERT INTO bus_registrations (
      id, event_slug, external_reference, primary_name, primary_cpf, primary_birth_date,
      email, whatsapp, passenger_count, children_count, group_name, amount_cents,
      currency, status, status_detail, mercadopago_order_id, mercadopago_payment_id,
      paid_at, confirmation_email_sent_at, admin_email_sent_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertPass = `
    INSERT INTO bus_passengers (
      registration_id, \`position\`, full_name, cpf, whatsapp, email,
      is_primary, is_minor, is_child_lap, confirmation_email_sent_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let grupoCatIdx = 0;
  let totalABordo = 0;
  let totalPagantes = 0;
  let totalCriancas = 0;
  let semTelefoneCount = 0;

  // CPFs especiais para simular cancelado/falha -> confirmado posterior
  const recompras = [
    { nome: 'Renato Silva Barbosa', cpf: gerarCpf(), email: 'renato.barbosa@gmail.com', tel: '11984521099' },
    { nome: 'Patricia Moreira Alves', cpf: gerarCpf(), email: 'patricia.alves@outlook.com', tel: '19992345511' },
    { nome: 'Lucas Ferreira Gomes', cpf: gerarCpf(), email: 'lucas.gomes@gmail.com', tel: '11977665544' },
    { nome: 'Camila Rocha Fernandes', cpf: gerarCpf(), email: 'camila.fernandes@uol.com.br', tel: '21988776655' },
    { nome: 'Gabriel Souza Lima', cpf: gerarCpf(), email: 'gabriel.lima@hotmail.com', tel: '31991223344' }
  ];

  // -------------------------------------------------------------
  // 1. RESERVAS CONFIRMADAS (Totalizando 90 pessoas a bordo)
  // Distribuição intercalada e misturada: 85 pagantes + 5 crianças no colo = 90 a bordo
  // -------------------------------------------------------------
  const estruturasConfirmadas = [
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 2, criancas: 0 }, // Renato Silva Barbosa (The Castles of Burgundy)
    { pagantes: 4, criancas: 0 }, // Quarteto
    { pagantes: 1, criancas: 0 }, // Patricia Moreira Alves (Individual)
    { pagantes: 3, criancas: 0 }, // Lucas Ferreira Gomes (Wingspan)
    { pagantes: 5, criancas: 0 }, // Quinteto
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 2, criancas: 0 }, // Camila Rocha Fernandes (Terraforming Mars)
    { pagantes: 2, criancas: 2 }, // Família com 2 crianças (Projeto Gaia)
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 3, criancas: 0 }, // Gabriel Souza Lima (Ark Nova)
    { pagantes: 5, criancas: 0 }, // Quinteto
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 2, criancas: 0 }, // Dupla
    { pagantes: 4, criancas: 0 }, // Quarteto
    { pagantes: 1, criancas: 1 }, // Mãe + bebê no colo (SETI)
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 3, criancas: 0 }, // Trio
    { pagantes: 5, criancas: 0 }, // Quinteto
    { pagantes: 2, criancas: 0 }, // Dupla
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 4, criancas: 0 }, // Quarteto
    { pagantes: 3, criancas: 2 }, // Família com 2 crianças (Mansions of Madness)
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 2, criancas: 0 }, // Dupla
    { pagantes: 5, criancas: 0 }, // Quinteto
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 3, criancas: 0 }, // Trio
    { pagantes: 2, criancas: 0 }, // Dupla
    { pagantes: 4, criancas: 0 }, // Quarteto
    { pagantes: 1, criancas: 0 }, // Individual
    { pagantes: 2, criancas: 0 }, // Dupla
    { pagantes: 3, criancas: 0 }, // Trio
    { pagantes: 4, criancas: 0 }  // Quarteto
  ];

  console.log(`Inserindo ${estruturasConfirmadas.length} reservas confirmadas intercaladas...`);

  let dataBase = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 dias atrás

  for (let i = 0; i < estruturasConfirmadas.length; i++) {
    const est = estruturasConfirmadas[i];
    const regId = randomUUID();
    const isGrupo = (est.pagantes + est.criancas) >= 2;
    const nomeGrupo = isGrupo ? GRUPOS_CATALOGO[grupoCatIdx++] : null;
    
    let primaryName, primaryCpf, primaryEmail, primaryTel;

    // Conectar os 5 casos de recompra confirmada
    if (i === 1) {
      primaryName = recompras[0].nome;
      primaryCpf = recompras[0].cpf;
      primaryEmail = recompras[0].email;
      primaryTel = recompras[0].tel;
    } else if (i === 3) {
      primaryName = recompras[1].nome;
      primaryCpf = recompras[1].cpf;
      primaryEmail = recompras[1].email;
      primaryTel = recompras[1].tel;
    } else if (i === 4) {
      primaryName = recompras[2].nome;
      primaryCpf = recompras[2].cpf;
      primaryEmail = recompras[2].email;
      primaryTel = recompras[2].tel;
    } else if (i === 7) {
      primaryName = recompras[3].nome;
      primaryCpf = recompras[3].cpf;
      primaryEmail = recompras[3].email;
      primaryTel = recompras[3].tel;
    } else if (i === 10) {
      primaryName = recompras[4].nome;
      primaryCpf = recompras[4].cpf;
      primaryEmail = recompras[4].email;
      primaryTel = recompras[4].tel;
    } else {
      primaryName = gerarNomeCompleto();
      primaryCpf = gerarCpf();
      primaryEmail = gerarEmail(primaryName);
      primaryTel = gerarTelefone();
    }

    const amountCents = est.pagantes * 12000;
    dataBase = new Date(dataBase.getTime() + Math.floor(Math.random() * 4 + 4) * 3600 * 1000);
    const paidAt = new Date(dataBase.getTime() + 15 * 60 * 1000);

    const orderId = `ORD_${Math.floor(100000000 + Math.random() * 900000000)}`;
    const paymentId = `PAY_${Math.floor(100000000 + Math.random() * 900000000)}`;

    await conn.query(insertReg, [
      regId,
      'kriativos-onboard-2026',
      `ext_${regId.substring(0, 8)}`,
      primaryName,
      primaryCpf,
      '1992-06-15',
      primaryEmail,
      primaryTel,
      est.pagantes,
      est.criancas,
      nomeGrupo,
      amountCents,
      'BRL',
      'confirmed',
      'accredited',
      orderId,
      paymentId,
      paidAt,
      paidAt,
      paidAt,
      dataBase,
      paidAt
    ]);

    totalPagantes += est.pagantes;
    totalCriancas += est.criancas;
    totalABordo += (est.pagantes + est.criancas);

    // Inserir passageiros
    let pos = 1;
    // Passageiro 1 (Contato Principal)
    await conn.query(insertPass, [
      regId,
      pos++,
      primaryName,
      primaryCpf,
      primaryTel,
      primaryEmail,
      1, // is_primary
      0, // is_minor
      0, // is_child_lap
      paidAt,
      dataBase
    ]);

    // Passageiros Pagantes Adicionais
    for (let p = 2; p <= est.pagantes; p++) {
      const passName = gerarNomeCompleto();
      const passCpf = gerarCpf();
      // Alguns passageiros sem telefone para dar o indicador visual no resumo
      const semTel = (Math.random() < 0.15);
      const passTel = semTel ? null : gerarTelefone();
      if (semTel) semTelefoneCount++;

      const passEmail = (Math.random() < 0.6) ? gerarEmail(passName) : null;

      await conn.query(insertPass, [
        regId,
        pos++,
        passName,
        passCpf,
        passTel,
        passEmail,
        0, // is_primary
        0, // is_minor
        0, // is_child_lap
        passEmail ? paidAt : null,
        dataBase
      ]);
    }

    // Crianças de Colo
    const sobrenomeFam = primaryName.split(' ').slice(1).join(' ');
    for (let c = 1; c <= est.criancas; c++) {
      const kidName = gerarNomeCrianca(sobrenomeFam);
      const kidCpf = gerarCpf();
      semTelefoneCount++; // Criança não tem celular

      await conn.query(insertPass, [
        regId,
        pos++,
        kidName,
        kidCpf,
        null, // sem whats
        null, // sem email
        0, // is_primary
        1, // is_minor
        1, // is_child_lap
        null,
        dataBase
      ]);
    }
  }

  // -------------------------------------------------------------
  // 2. RESERVAS PENDENTES (Aguardando Pix)
  // -------------------------------------------------------------
  console.log('Inserindo 4 reservas pendentes...');
  const estruturasPendentes = [
    { pagantes: 1, criancas: 0 },
    { pagantes: 2, criancas: 0 },
    { pagantes: 3, criancas: 0 },
    { pagantes: 1, criancas: 1 }
  ];

  for (const est of estruturasPendentes) {
    const regId = randomUUID();
    const primaryName = gerarNomeCompleto();
    const primaryCpf = gerarCpf();
    const primaryEmail = gerarEmail(primaryName);
    const primaryTel = gerarTelefone();
    const amountCents = est.pagantes * 12000;
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 8 + 1) * 3600 * 1000); // poucas horas atrás
    const orderId = `ORD_${Math.floor(100000000 + Math.random() * 900000000)}`;

    await conn.query(insertReg, [
      regId,
      'kriativos-onboard-2026',
      `ext_${regId.substring(0, 8)}`,
      primaryName,
      primaryCpf,
      '1995-03-20',
      primaryEmail,
      primaryTel,
      est.pagantes,
      est.criancas,
      null, // pendente não tem grupo ainda
      amountCents,
      'BRL',
      'payment_pending',
      'waiting_payment',
      orderId,
      null,
      null,
      null,
      null,
      createdAt,
      createdAt
    ]);

    let pos = 1;
    await conn.query(insertPass, [
      regId,
      pos++,
      primaryName,
      primaryCpf,
      primaryTel,
      primaryEmail,
      1, 0, 0, null, createdAt
    ]);

    for (let p = 2; p <= est.pagantes; p++) {
      const passName = gerarNomeCompleto();
      await conn.query(insertPass, [
        regId,
        pos++,
        passName,
        gerarCpf(),
        gerarTelefone(),
        gerarEmail(passName),
        0, 0, 0, null, createdAt
      ]);
    }
  }

  // -------------------------------------------------------------
  // 3. RESERVAS CANCELADAS / FALHAS (Com múltiplos casos de recompra)
  // -------------------------------------------------------------
  console.log('Inserindo reservas canceladas / falhas com recompras cruzadas...');
  
  // Caso 1: Renato gerou Pix há 6 dias que expirou (cancelled), depois comprou com sucesso
  const regCancel1 = randomUUID();
  const dataAntiga1 = new Date(Date.now() - 6 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel1, 'kriativos-onboard-2026', `ext_${regCancel1.substring(0, 8)}`,
    recompras[0].nome, recompras[0].cpf, '1988-11-10', recompras[0].email, recompras[0].tel,
    2, 0, null, 24000, 'BRL', 'cancelled', 'expired',
    `ORD_EXP_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga1, dataAntiga1
  ]);
  await conn.query(insertPass, [regCancel1, 1, recompras[0].nome, recompras[0].cpf, recompras[0].tel, recompras[0].email, 1, 0, 0, null, dataAntiga1]);
  await conn.query(insertPass, [regCancel1, 2, 'Marcos Silva Barbosa', gerarCpf(), recompras[0].tel, null, 0, 0, 0, null, dataAntiga1]);

  // Caso 2: Patricia teve falha no pagamento há 5 dias (payment_failed), depois comprou com sucesso
  const regCancel2 = randomUUID();
  const dataAntiga2 = new Date(Date.now() - 5 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel2, 'kriativos-onboard-2026', `ext_${regCancel2.substring(0, 8)}`,
    recompras[1].nome, recompras[1].cpf, '1993-04-18', recompras[1].email, recompras[1].tel,
    1, 0, null, 12000, 'BRL', 'payment_failed', 'cc_rejected',
    `ORD_FAL_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga2, dataAntiga2
  ]);
  await conn.query(insertPass, [regCancel2, 1, recompras[1].nome, recompras[1].cpf, recompras[1].tel, recompras[1].email, 1, 0, 0, null, dataAntiga2]);

  // Caso 3: Lucas gerou Pix há 4 dias que expirou (cancelled), depois refez e confirmou
  const regCancel3 = randomUUID();
  const dataAntiga3 = new Date(Date.now() - 4 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel3, 'kriativos-onboard-2026', `ext_${regCancel3.substring(0, 8)}`,
    recompras[2].nome, recompras[2].cpf, '1991-08-22', recompras[2].email, recompras[2].tel,
    3, 0, null, 36000, 'BRL', 'cancelled', 'expired',
    `ORD_EXP_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga3, dataAntiga3
  ]);
  await conn.query(insertPass, [regCancel3, 1, recompras[2].nome, recompras[2].cpf, recompras[2].tel, recompras[2].email, 1, 0, 0, null, dataAntiga3]);
  await conn.query(insertPass, [regCancel3, 2, 'Tiago Ferreira Gomes', gerarCpf(), recompras[2].tel, null, 0, 0, 0, null, dataAntiga3]);
  await conn.query(insertPass, [regCancel3, 3, 'Bruna Dias Gomes', gerarCpf(), recompras[2].tel, null, 0, 0, 0, null, dataAntiga3]);

  // Caso 4: Camila teve falha no pagamento há 3 dias (payment_failed), depois comprou com sucesso
  const regCancel4 = randomUUID();
  const dataAntiga4 = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel4, 'kriativos-onboard-2026', `ext_${regCancel4.substring(0, 8)}`,
    recompras[3].nome, recompras[3].cpf, '1996-12-05', recompras[3].email, recompras[3].tel,
    2, 0, null, 24000, 'BRL', 'payment_failed', 'insufficient_amount',
    `ORD_FAL_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga4, dataAntiga4
  ]);
  await conn.query(insertPass, [regCancel4, 1, recompras[3].nome, recompras[3].cpf, recompras[3].tel, recompras[3].email, 1, 0, 0, null, dataAntiga4]);
  await conn.query(insertPass, [regCancel4, 2, 'Felipe Rocha Fernandes', gerarCpf(), recompras[3].tel, null, 0, 0, 0, null, dataAntiga4]);

  // Caso 5: Gabriel teve 2 tentativas fracassadas (Pix cancelado há 7 dias E falha no cartão há 4 dias), antes de pagar confirmado
  const regCancel5a = randomUUID();
  const dataAntiga5a = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel5a, 'kriativos-onboard-2026', `ext_${regCancel5a.substring(0, 8)}`,
    recompras[4].nome, recompras[4].cpf, '1990-07-14', recompras[4].email, recompras[4].tel,
    1, 0, null, 12000, 'BRL', 'cancelled', 'expired',
    `ORD_EXP_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga5a, dataAntiga5a
  ]);
  await conn.query(insertPass, [regCancel5a, 1, recompras[4].nome, recompras[4].cpf, recompras[4].tel, recompras[4].email, 1, 0, 0, null, dataAntiga5a]);

  const regCancel5b = randomUUID();
  const dataAntiga5b = new Date(Date.now() - 4 * 24 * 3600 * 1000);
  await conn.query(insertReg, [
    regCancel5b, 'kriativos-onboard-2026', `ext_${regCancel5b.substring(0, 8)}`,
    recompras[4].nome, recompras[4].cpf, '1990-07-14', recompras[4].email, recompras[4].tel,
    1, 0, null, 12000, 'BRL', 'payment_failed', 'cc_rejected',
    `ORD_FAL_${Math.floor(100000 + Math.random() * 900000)}`,
    null, null, null, null, dataAntiga5b, dataAntiga5b
  ]);
  await conn.query(insertPass, [regCancel5b, 1, recompras[4].nome, recompras[4].cpf, recompras[4].tel, recompras[4].email, 1, 0, 0, null, dataAntiga5b]);

  // Mais 2 canceladas normais (pessoas que desistiram)
  for (let c = 0; c < 2; c++) {
    const regId = randomUUID();
    const name = gerarNomeCompleto();
    const cpf = gerarCpf();
    const dataExp = new Date(Date.now() - (8 + c) * 24 * 3600 * 1000);
    await conn.query(insertReg, [
      regId,
      'kriativos-onboard-2026',
      `ext_${regId.substring(0, 8)}`,
      name,
      cpf,
      '1990-01-01',
      gerarEmail(name),
      gerarTelefone(),
      1, 0, null, 12000, 'BRL', 'cancelled', 'expired',
      `ORD_EXP_${Math.floor(100000 + Math.random() * 900000)}`,
      null, null, null, null, dataExp, dataExp
    ]);
    await conn.query(insertPass, [regId, 1, name, cpf, gerarTelefone(), gerarEmail(name), 1, 0, 0, null, dataExp]);
  }

  console.log('\n--- RESUMO DA POPULAÇÃO ---');
  console.log(`Total a bordo (Confirmados): ${totalABordo} passageiros`);
  console.log(`- Pagantes: ${totalPagantes} (Receita: R$ ${(totalPagantes * 120).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
  console.log(`- Crianças no colo: ${totalCriancas}`);
  console.log(`- Sem telefone (para conferência): ${semTelefoneCount}`);
  console.log(`- Grupos nomeados com jogos: ${grupoCatIdx}`);
  console.log(`- Reservas Pendentes: 4`);
  console.log(`- Reservas Canceladas/Falhas: 8 (com 6 recompras cruzadas de 5 pessoas)`);

  await conn.end();
}

run().catch((err) => {
  console.error('Erro na população:', err);
  process.exit(1);
});
