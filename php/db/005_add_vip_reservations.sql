-- Kriativos On Board 2026 — reservas VIP reais cadastradas pela organização.

ALTER TABLE bus_registrations
  ADD COLUMN is_vip TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 para reserva VIP administrativa, 0 para reserva paga'
  AFTER group_name;

CREATE INDEX bus_registrations_is_vip_status_idx
  ON bus_registrations (is_vip, status);

CREATE INDEX bus_registrations_is_vip_bus_idx
  ON bus_registrations (is_vip, bus_number);
