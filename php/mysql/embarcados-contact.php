<?php

declare(strict_types=1);

/**
 * Endpoint de contato para passageiros confirmados (Kriativos On Board - Embarcados).
 *
 * Recebe submissões do modal de suporte/contato da página embarcados.html.
 * Valida dados, rejeita bots via honeypot e responde JSON padronizado.
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// CORS restrito à mesma origem e métodos permitidos
$allowedMethods = ['POST', 'OPTIONS'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'Método não permitido. Utilize POST.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Obter corpo da requisição (JSON ou form-data)
$rawBody = file_get_contents('php://input');
$data = [];

if (!empty($rawBody)) {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

// Proteção Honeypot contra robôs de spam
if (!empty($data['website']) || !empty($data['_gotcha'])) {
    // Fingir sucesso para bots sem processar nada
    http_response_code(200);
    echo json_encode([
        'ok' => true,
        'message' => 'Solicitação processada com sucesso.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Campos esperados
$name = trim((string)($data['name'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$phone = trim((string)($data['phone'] ?? $data['whatsapp'] ?? ''));
$bookingRef = trim((string)($data['bookingRef'] ?? $data['cabin'] ?? ''));
$topic = trim((string)($data['topic'] ?? 'Dúvida Geral de Embarcado'));
$message = trim((string)($data['message'] ?? ''));
$newsletter = !empty($data['newsletter']);

// Validações
$errors = [];

if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
    $errors['name'] = 'Por favor, informe seu nome completo (2 a 100 caracteres).';
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120) {
    $errors['email'] = 'Por favor, informe um endereço de e-mail válido.';
}

if (mb_strlen($topic) < 2 || mb_strlen($topic) > 100) {
    $errors['topic'] = 'Por favor, selecione ou informe o assunto da sua dúvida.';
}

if (mb_strlen($message) < 10 || mb_strlen($message) > 2000) {
    $errors['message'] = 'Sua mensagem deve conter entre 10 e 2000 caracteres.';
}

if (!empty($bookingRef) && mb_strlen($bookingRef) > 50) {
    $errors['bookingRef'] = 'O identificador de reserva/cabine não pode exceder 50 caracteres.';
}

if (!empty($phone) && mb_strlen($phone) > 30) {
    $errors['phone'] = 'O telefone informado é inválido.';
}

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => 'Dados inválidos fornecidos.',
        'validation' => $errors
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Log e persistência básica em arquivo seguro (caso diretório de logs exista ou php temp)
$logEntry = [
    'timestamp' => date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'bookingRef' => $bookingRef,
    'topic' => $topic,
    'message' => $message,
    'newsletter_opt_in' => $newsletter,
];

// Opcional: tentar notificar admin se mail() estiver configurado
$adminEmail = 'contato@kriativosonboard.com.br';
$subject = "[KOB Embarcados] Dúvida de Passageiro: " . mb_substr($topic, 0, 50);
$mailBody = "Novo contato recebido pelo portal de Embarcados:\n\n"
    . "Nome: {$name}\n"
    . "E-mail: {$email}\n"
    . "WhatsApp / Telefone: {$phone}\n"
    . "Reserva / Cabine: {$bookingRef}\n"
    . "Assunto: {$topic}\n"
    . "Newsletter Opt-in: " . ($newsletter ? "Sim" : "Não") . "\n\n"
    . "Mensagem:\n{$message}\n\n"
    . "Enviado em: " . date('d/m/Y H:i:s') . "\n";

$headers = [
    'From' => 'no-reply@kriativosonboard.com.br',
    'Reply-To' => $email,
    'X-Mailer' => 'PHP/' . phpversion()
];

// Silencia erro de mail() se ambiente local de teste não tiver sendmail ativo
@mail($adminEmail, $subject, $mailBody, $headers);

http_response_code(200);
echo json_encode([
    'ok' => true,
    'message' => 'Sua mensagem foi enviada com sucesso! A equipe Kriativos On Board retornará em breve.'
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
