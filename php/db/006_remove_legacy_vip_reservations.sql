-- Kriativos On Board 2026 — remover a configuração antiga de VIPs por quantidade.
--
-- VIPs reais ficam em bus_registrations com is_vip = 1 e NÃO são tocados aqui.
-- A configuração abaixo era apenas a reserva visual sem nome/CPF da versão
-- anterior do painel.

DELETE FROM bus_settings
 WHERE setting_key = 'vip_assignments';

INSERT INTO bus_settings (setting_key, setting_value)
VALUES ('vip_seats', '0')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
