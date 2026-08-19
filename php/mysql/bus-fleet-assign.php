<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';

$config = bus_config();
$tokenEsperado = $config['manifest_token'] ?? '';

if (
    !is_string($tokenEsperado) || $tokenEsperado === ''
    || !hash_equals($tokenEsperado, (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''))
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
    
    if (!isset($body['registration_id']) || !is_string($body['registration_id'])) {
        throw new ValidationError('ID da reserva inválido.');
    }
    
    $bus_number = isset($body['bus_number']) ? (int) $body['bus_number'] : null;
    if ($bus_number !== null && ($bus_number < 1 || $bus_number > 99)) {
        throw new ValidationError('Número de ônibus inválido.');
    }

    $pdo = bus_pdo();
    
    // Validar se a reserva existe e está confirmada
    $stmt = $pdo->prepare('SELECT status, passenger_count, children_count FROM bus_registrations WHERE id = ?');
    $stmt->execute([$body['registration_id']]);
    $reserva = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$reserva) {
        throw new ValidationError('Reserva não encontrada.');
    }
    
    if ($reserva['status'] !== 'confirmed') {
        throw new ValidationError('Apenas reservas confirmadas podem ser alocadas.');
    }

    // Se estiver movendo para um ônibus específico, validar capacidade
    if ($bus_number !== null) {
        $stmtBus = $pdo->prepare('
            SELECT SUM(passenger_count + children_count) AS ocupacao 
              FROM bus_registrations 
             WHERE status = "confirmed" AND bus_number = ? AND id != ?
        ');
        $stmtBus->execute([$bus_number, $body['registration_id']]);
        $ocupacaoAtual = (int) $stmtBus->fetchColumn();
        
        $tamanhoReserva = (int) $reserva['passenger_count'] + (int) $reserva['children_count'];
        if ($ocupacaoAtual + $tamanhoReserva > 46) {
            throw new ValidationError('O ônibus ' . $bus_number . ' não tem capacidade suficiente.');
        }
    }

    $stmtUpdate = $pdo->prepare('UPDATE bus_registrations SET bus_number = ? WHERE id = ?');
    $stmtUpdate->execute([$bus_number, $body['registration_id']]);

    json_response(200, ['success' => true]);
} catch (ValidationError $e) {
    json_response(400, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    log_failure('bus-fleet-assign', $e);
    json_response(503, ['error' => 'Erro interno ao alocar reserva.']);
}
