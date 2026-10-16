-- Kriativos On Board 2026 — edição de reservas e desistência de passageiros.
-- Horários em UTC; MySQL 5.7+. Aplicar uma única vez (ADD COLUMN não tem
-- IF NOT EXISTS no MySQL 5.7); o bootstrap em PHP tolera reexecução.

ALTER TABLE bus_passengers
  ADD COLUMN withdrawn_at DATETIME NULL COMMENT 'UTC; preenchido quando o passageiro desiste'
    AFTER is_child_lap,
  ADD COLUMN withdrawal_reason VARCHAR(500) NULL
    AFTER withdrawn_at;

ALTER TABLE bus_registrations
  ADD COLUMN withdrawn_at DATETIME NULL COMMENT 'UTC; preenchido quando toda a reserva desiste'
    AFTER paid_at,
  ADD COLUMN withdrawn_bus_number TINYINT UNSIGNED NULL
    COMMENT 'Ônibus em que a reserva estava ao desistir'
    AFTER withdrawn_at,
  ADD COLUMN withdrawn_fleet_status ENUM('assigned', 'waiting') NULL
    COMMENT 'Estado na frota ao desistir'
    AFTER withdrawn_bus_number;

CREATE TABLE IF NOT EXISTS bus_registration_edits (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  registration_id CHAR(36)     NOT NULL,
  edited_at       DATETIME     NOT NULL COMMENT 'UTC',
  changes         LONGTEXT     NOT NULL COMMENT 'JSON serializado',
  PRIMARY KEY (id),
  KEY bus_registration_edits_registration_idx (registration_id, edited_at),
  CONSTRAINT bus_registration_edits_registration_fk
    FOREIGN KEY (registration_id) REFERENCES bus_registrations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
