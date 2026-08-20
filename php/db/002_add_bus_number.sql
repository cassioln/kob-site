-- =============================================================================
-- Kriativos OnBoard 2026 — Adicionar coluna bus_number
-- Identifica em qual ônibus cada reserva está alocada.
--
-- Regras de negócio:
--   - Cada ônibus comporta até 46 assentos ocupados por pagantes; crianças de colo
--     acompanham o grupo, mas não consomem assento.
--   - São necessários no mínimo 40 assentos ocupados para contratar um ônibus.
--   - O valor é atribuído automaticamente na confirmação do pagamento
--     e pode ser sobrescrito manualmente pelo painel (drag-and-drop).
--   - NULL indica reserva não confirmada ou ainda não alocada.
-- =============================================================================

ALTER TABLE bus_registrations
  ADD COLUMN bus_number TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Número do ônibus (1, 2, 3…). NULL = não alocado.'
  AFTER status_detail;

CREATE INDEX bus_registrations_bus_number_idx
  ON bus_registrations (bus_number);
