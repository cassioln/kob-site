<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once dirname(__DIR__) . '/lib/bus-fleet.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();

if (!bus_check_admin_token($config)) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

$pdo = null;
$transacaoAberta = false;

try {
    $body = read_json_body();
    
    $registrationId = (string) ($_POST['registration_id'] ?? ($body['registration_id'] ?? ''));
    if ($registrationId === '') {
        throw new ValidationError('ID da reserva inválido.');
    }
    
    $busNumberRaw = $_POST['bus_number'] ?? ($body['bus_number'] ?? null);
    $bus_number = $busNumberRaw !== null ? (int) $busNumberRaw : null;
    if ($bus_number !== null && ($bus_number < 1 || $bus_number > 99)) {
        throw new ValidationError('Número de ônibus inválido.');
    }

    $pdo = bus_pdo();
    bus_fleet_ensure_assignment_status($pdo);
    $pdo->beginTransaction();
    $transacaoAberta = true;
    
    // Tratamento para VIPs (IDs virtuais vip_1, vip_2 etc)
    if (str_starts_with($registrationId, 'vip_')) {
        $legacyVip = bus_fleet_load_legacy_vip_settings($pdo, true);
        $vipCount = $legacyVip['count'];
        $vipAssignments = $legacyVip['assignments'];
        $effectiveVipAssignments = $legacyVip['effective_assignments'];
        
        $vipNumber = (int) substr($registrationId, 4);
        if ($vipNumber < 1 || $vipNumber > $vipCount) {
            throw new ValidationError('VIP não encontrado.');
        }

        if ($bus_number === null) {
            throw new ValidationError('Reservas VIP não podem ficar sem ônibus confirmado.');
        }

        $tamanhoReserva = 1;
        
        if ($bus_number !== null) {
            $ocupacaoAtual = bus_fleet_bus_occupancy($pdo, $bus_number, null, true);

            foreach ($effectiveVipAssignments as $vId => $bNum) {
                if ($vId !== $registrationId && (int)$bNum === $bus_number) {
                    $ocupacaoAtual++;
                }
            }

            if ($ocupacaoAtual + $tamanhoReserva > 46) {
                throw new ValidationError('O Ônibus ' . $bus_number . ' não tem capacidade suficiente (' . max(0, 46 - $ocupacaoAtual) . ' vagas restantes; são necessárias ' . $tamanhoReserva . ').');
            }
        }

        $vipAssignments[$registrationId] = $bus_number !== null ? $bus_number : 1;
        $stmtUpdate = $pdo->prepare('
            INSERT INTO bus_settings (setting_key, setting_value) 
            VALUES ("vip_assignments", ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ');
        $stmtUpdate->execute([json_encode($vipAssignments)]);
        $pdo->commit();
        $transacaoAberta = false;
        json_response(200, ['success' => true, 'bus_number' => $bus_number]);
        exit;
    }

    // Tratamento para Reservas Reais
    $stmt = $pdo->prepare('SELECT status, passenger_count, children_count FROM bus_registrations WHERE id = ? FOR UPDATE');
    $stmt->execute([$registrationId]);
    $reserva = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$reserva) {
        throw new ValidationError('Reserva não encontrada.');
    }
    
    if ($reserva['status'] !== 'confirmed') {
        throw new ValidationError('Apenas reservas com pagamento confirmado podem ser alocadas.');
    }

    $tamanhoReserva = bus_fleet_seat_count((int) $reserva['passenger_count'], (int) $reserva['children_count']);

    // Se estiver movendo para um ônibus específico, validar capacidade
    if ($bus_number !== null) {
        $ocupacaoAtual = bus_fleet_bus_occupancy($pdo, $bus_number, $registrationId, true);
        $legacyVip = bus_fleet_load_legacy_vip_settings($pdo, true);
        foreach ($legacyVip['effective_assignments'] as $vId => $bNum) {
            if ((int)$bNum === $bus_number) {
                $ocupacaoAtual++;
            }
        }
        
        if ($ocupacaoAtual + $tamanhoReserva > 46) {
            throw new ValidationError('O Ônibus ' . $bus_number . ' não tem capacidade suficiente (' . max(0, 46 - $ocupacaoAtual) . ' vagas restantes; são necessárias ' . $tamanhoReserva . ').');
        }
    }

    if ($bus_number === null) {
        $stmtUpdate = $pdo->prepare("UPDATE bus_registrations
            SET bus_number = NULL, fleet_assignment_status = 'waiting', updated_at = UTC_TIMESTAMP()
          WHERE id = ?");
        $stmtUpdate->execute([$registrationId]);
    } else {
        $stmtUpdate = $pdo->prepare("UPDATE bus_registrations
            SET bus_number = ?, fleet_assignment_status = 'assigned', updated_at = UTC_TIMESTAMP()
          WHERE id = ?");
        $stmtUpdate->execute([$bus_number, $registrationId]);
    }

    $pdo->commit();
    $transacaoAberta = false;
    json_response(200, ['success' => true, 'bus_number' => $bus_number]);
} catch (ValidationError $e) {
    if ($transacaoAberta && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($transacaoAberta && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-fleet-assign', $e);
    json_response(500, ['error' => 'Erro interno ao alocar reserva: ' . $e->getMessage()]);
}
