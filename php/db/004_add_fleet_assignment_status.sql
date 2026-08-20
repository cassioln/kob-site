-- Kriativos On Board 2026 — estado operacional da alocação na frota.
-- `waiting` mantém a reserva confirmada fora de um ônibus que não atingiu a meta.

ALTER TABLE bus_registrations
  ADD COLUMN fleet_assignment_status ENUM('assigned', 'waiting') NOT NULL DEFAULT 'assigned'
    COMMENT 'Estado operacional da alocacao na frota'
  AFTER bus_number;

CREATE INDEX bus_registrations_fleet_assignment_status_idx
  ON bus_registrations (fleet_assignment_status, bus_number);
