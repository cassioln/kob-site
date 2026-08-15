import { randomUUID } from 'node:crypto';

export const BUS_PRICE_CENTS = 12_000;
export const MAX_PASSENGERS = 100;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function requiredObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} inválido.`);
  }
  return value;
}

function normalizeText(value, label, minLength = 2, maxLength = 160) {
  if (typeof value !== 'string') throw new ValidationError(`${label} é obrigatório.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new ValidationError(`${label} inválido.`);
  }
  return normalized;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCpf(value) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^([0-9])\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf[9])) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(cpf[10]);
}

function normalizeCpf(value, label) {
  const cpf = digitsOnly(value);
  if (!isValidCpf(cpf)) {
    const subject = label.replace(/^CPF do /, '');
    throw new ValidationError(`CPF inválido para ${subject}.`);
  }
  return cpf;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') throw new ValidationError('E-mail é obrigatório.');
  const email = value.trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('E-mail inválido.');
  }
  return email;
}

function normalizeWhatsapp(value) {
  const digits = digitsOnly(value);
  const national = digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
  if (![10, 11].includes(national.length)) {
    throw new ValidationError('WhatsApp inválido.');
  }
  return national;
}

export function validateBusPayload(payload) {
  requiredObject(payload, 'Cadastro');
  const contact = requiredObject(payload.contact, 'Contato principal');
  const passengerCount = Number(payload.passenger_count);
  const childrenCount = Number(payload.children_count ?? 0);

  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > MAX_PASSENGERS) {
    throw new ValidationError(`Informe entre 1 e ${MAX_PASSENGERS} passageiros.`);
  }
  // Crianças de até 5 anos são ADICIONAIS e não pagam: viajam no colo de um
  // pagante, então cada uma precisa de um colo: crianças <= pagantes.
  if (!Number.isInteger(childrenCount) || childrenCount < 0
      || childrenCount > passengerCount) {
    throw new ValidationError('As crianças de até 5 anos não podem passar do número de passageiros pagantes.');
  }

  const primaryName = normalizeText(contact.full_name, 'Nome completo do contato principal', 3);
  if (primaryName.split(' ').length < 2) {
    throw new ValidationError('Informe o nome completo do contato principal.');
  }
  const primaryCpf = normalizeCpf(contact.cpf, 'CPF do contato principal');
  const email = normalizeEmail(contact.email);
  const whatsapp = normalizeWhatsapp(contact.whatsapp);

  if (!Array.isArray(payload.passengers) || payload.passengers.length !== passengerCount) {
    throw new ValidationError('Informe os dados de todos os passageiros.');
  }

  const passengers = payload.passengers.map((passenger, index) => {
    const entry = requiredObject(passenger, `Passageiro ${index + 1}`);
    const fullName = normalizeText(entry.full_name, `Nome completo do passageiro ${index + 1}`, 3);
    if (fullName.split(' ').length < 2) {
      throw new ValidationError(`Informe o nome completo do passageiro ${index + 1}.`);
    }
    const cpf = normalizeCpf(entry.cpf, `CPF do passageiro ${index + 1}`);
    return { position: index + 1, fullName, cpf };
  });

  if (passengers[0].fullName !== primaryName || passengers[0].cpf !== primaryCpf) {
    throw new ValidationError('O passageiro 1 deve ser o contato principal.');
  }

  const cpfs = new Set();
  passengers.forEach((passenger) => {
    if (cpfs.has(passenger.cpf)) throw new ValidationError('Não repita o CPF de um passageiro.');
    cpfs.add(passenger.cpf);
  });

  return {
    contact: {
      fullName: primaryName,
      cpf: primaryCpf,
      email,
      whatsapp
    },
    passengerCount,
    childrenCount,
    passengers
  };
}

export async function createPixOrder({
  payload,
  db,
  mercadoPago,
  idempotencyKey = randomUUID()
}) {
  if (!db || typeof db.createRegistration !== 'function' || typeof db.updateRegistration !== 'function') {
    throw new Error('Repositório de cadastro não configurado.');
  }
  if (!mercadoPago || typeof mercadoPago.createOrder !== 'function') {
    throw new Error('Integração do Mercado Pago não configurada.');
  }

  const normalized = validateBusPayload(payload);
  const id = randomUUID();
  const externalReference = `kob_bus_2026_${id}`;
  // Criancas de ate 5 anos sao adicionais e NAO pagam: o valor cobre
  // exatamente o grupo informado em passengerCount.
  const amountCents = normalized.passengerCount * BUS_PRICE_CENTS;
  const totalAmount = (amountCents / 100).toFixed(2);

  await db.createRegistration({
    id,
    externalReference,
    primaryName: normalized.contact.fullName,
    primaryCpf: normalized.contact.cpf,
    email: normalized.contact.email,
    whatsapp: normalized.contact.whatsapp,
    passengerCount: normalized.passengerCount,
    childrenCount: normalized.childrenCount,
    amountCents,
    passengers: normalized.passengers
  });

  let payment;
  try {
    payment = await mercadoPago.createOrder({
      totalAmount,
      externalReference,
      payerEmail: normalized.contact.email,
      idempotencyKey,
      payerData: {
        fullName: normalized.contact.fullName,
        cpf: normalized.contact.cpf,
        whatsapp: normalized.contact.whatsapp
      },
      passengerCount: normalized.passengerCount
    });
  } catch (error) {
    try {
      await db.updateRegistration(id, { status: 'payment_failed' });
    } catch (_updateError) {
      // O erro original é mais útil para o chamador; a tentativa de atualização
      // fica registrada pelo status do processo na próxima conciliação.
    }
    throw error;
  }

  await db.updateRegistration(id, {
    status: 'payment_pending',
    mercadopagoOrderId: payment.orderId,
    mercadopagoPaymentId: payment.paymentId
  });

  return {
    registrationId: id,
    orderId: payment.orderId,
    paymentId: payment.paymentId,
    status: payment.status,
    totalAmount,
    qrCode: payment.qrCode,
    qrCodeBase64: payment.qrCodeBase64,
    ticketUrl: payment.ticketUrl,
    expiresAt: payment.expiresAt ?? null
  };
}
