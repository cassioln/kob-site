-- Kriativos On Board 2026 — consolidar o nome do grupo Pandemic.
--
-- O catálogo não oferece mais “Pandemic Legacy”. Esta atualização preserva
-- reservas já criadas, renomeando-as para o nome oficial “Pandemic”.
UPDATE bus_registrations
   SET group_name = 'Pandemic'
 WHERE group_name = 'Pandemic Legacy';
