<?php

declare(strict_types=1);

/**
 * Config e conexão PDO com o PostgreSQL da Locaweb.
 *
 * A senha NUNCA fica aqui nem em public_html. Ela é lida de um arquivo
 * fora do document root: ~/kob-config/bus-secrets.php
 */

function bus_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $candidates = [];
    if (getenv('KOB_SECRETS_FILE')) {
        $candidates[] = (string) getenv('KOB_SECRETS_FILE');
    }
    // Home do usuário na Locaweb, um nível acima do docroot.
    $candidates[] = dirname(__DIR__, 3) . '/kob-config/bus-secrets.php';
    $candidates[] = dirname(__DIR__, 2) . '/kob-config/bus-secrets.php';

    foreach ($candidates as $path) {
        if (is_file($path) && is_readable($path)) {
            /** @var array $loaded */
            $loaded = require $path;
            if (!is_array($loaded) || !isset($loaded['db_password'], $loaded['mp_access_token'])) {
                throw new RuntimeException('Arquivo de segredos incompleto.');
            }
            $config = $loaded + [
                'db_host' => 'db_kob.postgresql.dbaas.com.br',
                'db_port' => 5432,
                'db_name' => 'db_kob',
                'db_user' => 'db_kob',
            ];

            return $config;
        }
    }

    throw new RuntimeException('Arquivo de segredos não encontrado.');
}

function bus_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = bus_config();
    // O certificado do servidor da Locaweb está expirado; sslmode=require
    // mantém o tráfego cifrado sem exigir validação da cadeia (verify-full
    // falharia com CERT_HAS_EXPIRED).
    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s;sslmode=require',
        $config['db_host'],
        $config['db_port'],
        $config['db_name']
    );

    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ]);

    return $pdo;
}

function json_response(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > 200000) {
        throw new ValidationError('Corpo da requisição muito grande.');
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ValidationError('O corpo da requisição não é um JSON válido.');
    }

    return $decoded;
}

/**
 * Log de erro sem vazar dados pessoais nem credenciais.
 */
function log_failure(string $context, Throwable $error): void
{
    $config = null;
    try {
        $config = bus_config();
    } catch (Throwable) {
        // sem config, nada a mascarar
    }
    $message = $error->getMessage();
    if (is_array($config)) {
        foreach (['db_password', 'mp_access_token'] as $key) {
            if (!empty($config[$key])) {
                $message = str_replace((string) $config[$key], '[REDACTED]', $message);
            }
        }
    }
    error_log(sprintf('[kob-bus][%s] %s', $context, $message));
}
