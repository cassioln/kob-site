-- =============================================================================
-- Kriativos OnBoard 2026 — Adicionar tabela bus_settings
-- Tabela simples de chave/valor para configurações globais.
-- Atualmente usada para armazenar a quantidade de VIPs ("Reserva de Lugares").
-- =============================================================================

CREATE TABLE IF NOT EXISTS bus_settings (
  setting_key VARCHAR(50) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valor inicial para VIPs
INSERT IGNORE INTO bus_settings (setting_key, setting_value) VALUES ('vip_seats', '0');
