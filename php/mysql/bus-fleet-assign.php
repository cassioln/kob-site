<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';
$tokenRecebido = (string) ($_GET['token'] ?? ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''));

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || $tokenRecebido === ''
    || !hash_equals($tokenEsperado, $tokenRecebido)
) {
    json_response(403, ['error' => 'Acesso negado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method Not Allowed']);
    exit;
}

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
    
    // Tratamento para VIPs (IDs virtuais vip_1, vip_2 etc)
    if (str_starts_with($registrationId, 'vip_')) {
        $q_settings = $pdo->query("SELECT setting_key, setting_value FROM bus_settings WHERE setting_key IN ('vip_seats', 'vip_assignments')");
        $vipCount = 0;
        $vipAssignments = [];
        if ($q_settings) {
            foreach ($q_settings->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if ($row['setting_key'] === 'vip_seats') {
                    $vipCount = (int) $row['setting_value'];
                } elseif ($row['setting_key'] === 'vip_assignments') {
                    $vipAssignments = json_decode($row['setting_value'], true) ?: [];
                }
            }
        }
        
        $vipNumber = (int) substr($registrationId, 4);
        if ($vipNumber < 1 || $vipNumber > $vipCount) {
            throw new ValidationError('VIP não encontrado.');
        }

        $tamanhoReserva = 1;
        
        if ($bus_number !== null) {
            $stmtBus = $pdo->prepare('
                SELECT SUM(passenger_count + children_count) AS ocupacao 
                  FROM bus_registrations 
                 WHERE status = "confirmed" AND bus_number = ?
            ');
            $stmtBus->execute([$bus_number]);
            $ocupacaoAtual = (int) $stmtBus->fetchColumn();

            foreach ($vipAssignments as $vId => $bNum) {
                if ($vId !== $registrationId && (int)$bNum === $bus_number) {
                    $ocupacaoAtual++;
                }
            }
            if ($bus_number === 1) {
                for ($i = 1; $i <= $vipCount; $i++) {
                    $vId = 'vip_' . $i;
                    if ($vId !== $registrationId && !isset($vipAssignments[$vId])) {
                        $ocupacaoAtual++;
                    }
                }
            }

            if ($ocupacaoAtual + $tamanhoReserva > 46) {
                throw new ValidationError('O Ônibus ' . $bus_number . ' não tem capacidade suficiente (' . (46 - $ocupacaoAtual) . ' vagas restantes).');
            }
        }

        $vipAssignments[$registrationId] = $bus_number !== null ? $bus_number : 1;
        $stmtUpdate = $pdo->prepare('
            INSERT INTO bus_settings (setting_key, setting_value) 
            VALUES ("vip_assignments", ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ');
        $stmtUpdate->execute([json_encode($vipAssignments)]);
        
        json_response(200, ['success' => true, 'bus_number' => $bus_number]);
        exit;
    }

    // Tratamento para Reservas Reais
    $stmt = $pdo->prepare('SELECT status, passenger_count, children_count FROM bus_registrations WHERE id = ?');
    $stmt->execute([$registrationId]);
    $reserva = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$reserva) {
        throw new ValidationError('Reserva não encontrada.');
    }
    
    if ($reserva['status'] !== 'confirmed') {
        throw new ValidationError('Apenas reservas com pagamento confirmado podem ser alocadas.');
    }

    $tamanhoReserva = (int) $reserva['passenger_count'] + (int) $reserva['children_count'];

    // Se estiver movendo para um ônibus específico, validar capacidade
    if ($bus_number !== null) {
        $stmtBus = $pdo->prepare('
            SELECT SUM(passenger_count + children_count) AS ocupacao 
              FROM bus_registrations 
             WHERE status = "confirmed" AND bus_number = ? AND id != ?
        ');
        $stmtBus->execute([$bus_number, $registrationId]);
        $ocupacaoAtual = (int) $stmtBus->fetchColumn();

        // Adiciona VIPs que estao no onibus destino
        $q_settings = $pdo->query("SELECT setting_key, setting_value FROM bus_settings WHERE setting_key IN ('vip_seats', 'vip_assignments')");
        $vipCount = 0;
        $vipAssignments = [];
        if ($q_settings) {
            foreach ($q_settings->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if ($row['setting_key'] === 'vip_seats') {
                    $vipCount = (int) $row['setting_value'];
                } elseif ($row['setting_key'] === 'vip_assignments') {
                    $vipAssignments = json_decode($row['setting_value'], true) ?: [];
                }
            }
        }
        foreach ($vipAssignments as $vId => $bNum) {
            if ((int)$bNum === $bus_number) {
                $ocupacaoAtual++;
            }
        }
        if ($bus_number === 1) {
            for ($i = 1; $i <= $vipCount; $i++) {
                $vId = 'vip_' . $i;
                if (!isset($vipAssignments[$vId])) {
                    $ocupacaoAtual++;
                }
            }
        }
        
        if ($ocupacaoAtual + $tamanhoReserva > 46) {
            throw new ValidationError('O Ônibus ' . $bus_number . ' não tem capacidade suficiente (' . (46 - $ocupacaoAtual) . ' vagas restantes).');
        }
    }

    $stmtUpdate = $pdo->prepare('UPDATE bus_registrations SET bus_number = ? WHERE id = ?');
    $stmtUpdate->execute([$bus_number, $registrationId]);

    json_response(200, ['success' => true, 'bus_number' => $bus_number]);
} catch (ValidationError $e) {
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    log_failure('bus-fleet-assign', $e);
    json_response(500, ['error' => 'Erro interno ao alocar reserva: ' . $e->getMessage()]);
}
