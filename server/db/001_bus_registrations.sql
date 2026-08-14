-- PostgreSQL schema for Kriativos OnBoard 2026 bus registrations.
-- Execute once in the database configured for the server-side API.

CREATE TABLE IF NOT EXISTS bus_registrations (
  id UUID PRIMARY KEY,
  event_slug TEXT NOT NULL DEFAULT 'kriativos-onboard-2026',
  external_reference TEXT NOT NULL UNIQUE,
  primary_name TEXT NOT NULL,
  primary_cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  passenger_count INTEGER NOT NULL CHECK (passenger_count BETWEEN 1 AND 100),
  children_count INTEGER NOT NULL DEFAULT 0 CHECK (children_count >= 0 AND children_count <= passenger_count - children_count),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'payment_pending'
    CHECK (status IN ('payment_pending', 'paid_awaiting_proof', 'confirmed', 'payment_failed', 'cancelled', 'refunded')),
  status_detail TEXT,
  mercadopago_order_id TEXT UNIQUE,
  mercadopago_payment_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bus_passengers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES bus_registrations(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position >= 1),
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registration_id, position),
  UNIQUE (registration_id, cpf)
);

CREATE INDEX IF NOT EXISTS bus_registrations_status_idx
  ON bus_registrations (status);

CREATE TABLE IF NOT EXISTS bus_payment_proofs (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL UNIQUE REFERENCES bus_registrations (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 2097152),
  sha256 CHAR(64) NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_registrations_created_at_idx
  ON bus_registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS bus_passengers_cpf_idx
  ON bus_passengers (cpf);
