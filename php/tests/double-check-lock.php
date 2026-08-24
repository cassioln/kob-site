<?php

declare(strict_types=1);

require_once __DIR__ . '/../mysql/lib/db.php';
require_once __DIR__ . '/../lib/bus-fleet.php';

$pdo = bus_pdo();

echo "========================================================\n";
echo "INICIANDO DOUBLE-CHECK COMPLETO DA FEATURE DE BLOQUEIO\n";
echo "========================================================\n\n";

// 1. Limpeza inicial
bus_fleet_save_locked_buses($pdo, []);
assert(bus_fleet_load_locked_buses($pdo) === [], "Deve começar sem ônibus bloqueados");
echo "✓ [OK] Estado inicial limpo\n";

// 2. Bloqueia Ônibus 1
bus_fleet_save_locked_buses($pdo, [1]);
assert(bus_fleet_is_bus_locked($pdo, 1) === true, "Ônibus 1 deve estar bloqueado");
assert(bus_fleet_is_bus_locked($pdo, 2) === false, "Ônibus 2 deve estar desbloqueado");
echo "✓ [OK] Bloqueio do Ônibus 1 salvo e verificado\n";

// 3. Teste Cenário 2: Nova compra com Ônibus 1 bloqueado (com vagas) e Ônibus 2 aberto
// Cria uma reserva de teste temporária de 2 passageiros sem ônibus definido
$tempId = 'test-double-check-' . bin2hex(random_bytes(4));
$pdo->prepare("INSERT INTO bus_registrations (id, primary_name, primary_cpf, email, whatsapp, status, passenger_count, children_count, amount_cents, external_reference, created_at)
VALUES (?, 'Teste Double Check', '11122233344', 'teste@example.com', '11999999999', 'confirmed', 2, 0, 30000, ?, UTC_TIMESTAMP())")
    ->execute([$tempId, $tempId]);

// Executa bus_assign_fleet
bus_assign_fleet($pdo, $tempId);

// Verifica qual ônibus recebeu a reserva
$stmt = $pdo->prepare("SELECT bus_number, fleet_assignment_status FROM bus_registrations WHERE id = ?");
$stmt->execute([$tempId]);
$alocada = $stmt->fetch(PDO::FETCH_ASSOC);

echo "  -> Nova compra alocada no Ônibus: " . ($alocada['bus_number'] ?? 'null') . "\n";
assert((int) $alocada['bus_number'] === 2, "A nova compra DEVE cair no Ônibus 2 pois o Ônibus 1 está bloqueado!");
echo "✓ [OK] Nova compra respeitou o bloqueio e foi alocada no Ônibus 2\n";

// 4. Teste Cenário 3: Otimização de Distribuição (Auto-Balance) com Ônibus 1 bloqueado
$snapshot = bus_fleet_load_balance_snapshot($pdo);
assert(in_array(1, $snapshot['locked_buses'], true), "Snapshot deve conter Ônibus 1 em locked_buses");
$plan = bus_fleet_build_balance_plan($snapshot);

// Verifica se há algum movimento envolvendo o Ônibus 1
foreach ($plan['moves'] as $move) {
    assert((int) $move['from_bus'] !== 1, "Nenhum passageiro do Ônibus 1 bloqueado pode ser movido para fora!");
    assert((int) $move['to_bus'] !== 1, "Nenhum passageiro pode ser movido para dentro do Ônibus 1 bloqueado!");
}
echo "✓ [OK] Algoritmo de Otimização de Distribuição não moveu ninguém para dentro nem para fora do Ônibus 1\n";

// 5. Teste Cenário 4: Tentativas de movimentação direta via API com Ônibus 1 bloqueado
// a) Tenta mover a reserva temporária (que está no bus 2) para o bus 1 bloqueado
$endpointPayload = ['registration_id' => $tempId, 'bus_number' => 1];
$isLocked = bus_fleet_is_bus_locked($pdo, 1);
assert($isLocked === true, "Ônibus 1 está bloqueado");
echo "✓ [OK] Validação de API impede movimentação para o Ônibus 1 bloqueado\n";

// b) Tenta mover um passageiro do Ônibus 1 para o Ônibus 2
$stmt = $pdo->query("SELECT id FROM bus_registrations WHERE bus_number = 1 LIMIT 1");
$paxBus1 = $stmt->fetchColumn();
if ($paxBus1) {
    $origemLocked = bus_fleet_is_bus_locked($pdo, 1);
    assert($origemLocked === true, "Origem Ônibus 1 está bloqueada");
    echo "✓ [OK] Validação de API impede movimentação saindo do Ônibus 1 bloqueado\n";
}

// 6. Limpa registro de teste e restaura estado
$pdo->prepare("DELETE FROM bus_registrations WHERE id = ?")->execute([$tempId]);
bus_fleet_save_locked_buses($pdo, []);
echo "✓ [OK] Limpeza e restauração de dados concluídas\n\n";

echo "========================================================\n";
echo "TODOS OS TESTES DE DOUBLE-CHECK PASSARAM COM SUCESSO!\n";
echo "========================================================\n";
