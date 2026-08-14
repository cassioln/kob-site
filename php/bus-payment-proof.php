<?php

declare(strict_types=1);

require __DIR__ . '/lib/validation.php';
require __DIR__ . '/lib/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

// upload_max_filesize do host é 2M. Ficamos abaixo para que o próprio PHP não
// descarte o POST antes de chegarmos à validação (o que geraria erro opaco).
const PROOF_MAX_BYTES = 1_900_000;

const PROOF_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
];

function proof_upload_error_message(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'O comprovante excede o tamanho máximo permitido.',
        UPLOAD_ERR_PARTIAL => 'O envio do comprovante foi interrompido. Tente novamente.',
        UPLOAD_ERR_NO_FILE => 'Escolha um arquivo de comprovante.',
        default => 'Não foi possível receber o comprovante.',
    };
}

function safe_proof_name(string $original, string $extension): string
{
    $base = basename(str_replace('\\', '/', $original));
    $clean = preg_replace('/[^A-Za-z0-9._-]/', '_', $base) ?? '';
    $clean = substr($clean, 0, 120);
    if ($clean === '' || !str_ends_with(strtolower($clean), '.' . $extension)) {
        return 'comprovante.' . $extension;
    }

    return $clean;
}

try {
    $registrationId = $_POST['registration_id'] ?? null;
    if (!is_uuid($registrationId)) {
        throw new ValidationError('Cadastro inválido.');
    }

    $file = $_FILES['proof'] ?? null;
    if (!is_array($file) || !isset($file['error'])) {
        // POST vazio normalmente significa corpo descartado por exceder post_max_size.
        throw new ValidationError('Escolha um arquivo de comprovante.');
    }
    if ((int) $file['error'] !== UPLOAD_ERR_OK) {
        throw new ValidationError(proof_upload_error_message((int) $file['error']));
    }
    if (!is_uploaded_file((string) $file['tmp_name'])) {
        throw new ValidationError('Envio inválido.');
    }

    $size = (int) $file['size'];
    if ($size < 1 || $size > PROOF_MAX_BYTES) {
        throw new ValidationError('O comprovante precisa ter no máximo 1,9 MB.');
    }

    // O tipo REAL vem do conteúdo (finfo), nunca do header enviado pelo cliente.
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detected = $finfo->file((string) $file['tmp_name']);
    if (!is_string($detected) || !isset(PROOF_TYPES[$detected])) {
        throw new ValidationError('Envie um comprovante em JPG, PNG, WebP ou PDF.');
    }

    $bytes = file_get_contents((string) $file['tmp_name']);
    if ($bytes === false || $bytes === '') {
        throw new ValidationError('Não foi possível ler o comprovante.');
    }

    $pdo = bus_pdo();
    $find = $pdo->prepare('SELECT status FROM bus_registrations WHERE id = :id LIMIT 1');
    $find->execute([':id' => $registrationId]);
    $registration = $find->fetch();
    if (!$registration) {
        json_response(404, ['error' => 'Cadastro não encontrado.']);
        exit;
    }
    if (in_array($registration['status'], ['cancelled', 'refunded'], true)) {
        json_response(409, ['error' => 'Este cadastro não aceita mais comprovantes.']);
        exit;
    }

    $pdo->beginTransaction();
    $save = $pdo->prepare(
        'INSERT INTO bus_payment_proofs
            (id, registration_id, file_name, mime_type, file_size, sha256, file_data)
         VALUES (:id, :rid, :name, :mime, :size, :hash, :data)
         ON CONFLICT (registration_id) DO UPDATE SET
            id = EXCLUDED.id,
            file_name = EXCLUDED.file_name,
            mime_type = EXCLUDED.mime_type,
            file_size = EXCLUDED.file_size,
            sha256 = EXCLUDED.sha256,
            file_data = EXCLUDED.file_data,
            uploaded_at = now()'
    );
    $save->bindValue(':id', uuid_v4());
    $save->bindValue(':rid', $registrationId);
    $save->bindValue(':name', safe_proof_name((string) ($file['name'] ?? ''), PROOF_TYPES[$detected]));
    $save->bindValue(':mime', $detected);
    $save->bindValue(':size', strlen($bytes), PDO::PARAM_INT);
    $save->bindValue(':hash', hash('sha256', $bytes));
    $save->bindValue(':data', $bytes, PDO::PARAM_LOB);
    $save->execute();

    // O comprovante só promove a vaga quando o pagamento JÁ foi identificado.
    // Enviar arquivo nunca aprova um Pix.
    $promote = $pdo->prepare(
        'UPDATE bus_registrations
            SET status = CASE WHEN status = \'paid_awaiting_proof\' THEN \'confirmed\' ELSE status END,
                updated_at = now()
          WHERE id = :id
      RETURNING status'
    );
    $promote->execute([':id' => $registrationId]);
    $status = (string) $promote->fetchColumn();
    $pdo->commit();

    json_response(201, ['status' => $status]);
} catch (ValidationError $error) {
    json_response(400, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    log_failure('bus-payment-proof', $error);
    json_response(500, ['error' => 'Não foi possível receber o comprovante.']);
}
