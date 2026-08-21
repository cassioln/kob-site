<?php

declare(strict_types=1);

// validation.php é agnóstica de banco: reaproveitamos a lib existente.
require_once dirname(__DIR__) . '/lib/validation.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/pending-reconciliation.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

try {
    $id = $_GET['id'] ?? null;
    if (!is_uuid($id)) {
        json_response(400, ['error' => 'Cadastro inválido.']);
        exit;
    }

    $pdo = bus_pdo();
    // As idades são calculadas pelo banco em UTC — o mesmo relógio que o PHP
    // usa para gravar as datas. Ver o comentário de reconcile_pending_registration().
    $query = $pdo->prepare(
        'SELECT id, status, status_detail, mercadopago_order_id,
                TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS idade_segundos,
                TIMESTAMPDIFF(SECOND, reconciled_at, UTC_TIMESTAMP()) AS segundos_desde_reconciliacao
           FROM bus_registrations
          WHERE id = :id
          LIMIT 1'
    );
    $query->execute([':id' => $id]);
    $registration = $query->fetch();

    if (!$registration) {
        json_response(404, ['error' => 'Cadastro não encontrado.']);
        exit;
    }

    $status = (string) $registration['status'];
    $detail = $registration['status_detail'] ?: null;

    if ($status === 'payment_pending') {
        try {
            $novo = bus_reconcile_pending_registration($pdo, $registration);
            if ($novo !== null) {
                $status = $novo['status'];
                $detail = $novo['status_detail'];
            }
        } catch (Throwable $reconcileError) {
            // Falha na reconciliação não pode derrubar a consulta de status: a
            // página continua exibindo o estado conhecido e tenta de novo.
            log_failure('bus-registration-status/reconcile', $reconcileError);
        }
    }

    // Nome do grupo, para a tela de confirmação exibir. É apelido de grupo, não
    // dado pessoal: não identifica ninguém sozinho, então pode sair aqui. CPF,
    // nome, e-mail e WhatsApp continuam fora.
    $grupo = null;
    if ($status === 'confirmed') {
        $qg = $pdo->prepare('SELECT group_name FROM bus_registrations WHERE id = :id LIMIT 1');
        $qg->execute([':id' => $id]);
        $linha = $qg->fetch(PDO::FETCH_ASSOC);
        $valor = $linha['group_name'] ?? null;
        $grupo = ($valor !== null && $valor !== '') ? (string) $valor : null;
    }

    // Só o estado operacional. Nunca CPF, nome, e-mail ou WhatsApp.
    json_response(200, [
        'status' => $status,
        'statusDetail' => $detail ?: null,
        'groupName' => $grupo,
    ]);
} catch (Throwable $error) {
    log_failure('bus-registration-status', $error);
    json_response(503, ['error' => 'Consulta temporariamente indisponível.']);
}
