-- Reservas VIP administrativas não dependem de pagamento Mercado Pago.

ALTER TABLE bus_registrations
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bus_registrations_is_vip_status_idx
  ON bus_registrations (is_vip, status);
