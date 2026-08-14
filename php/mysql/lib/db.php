<?php

declare(strict_types=1);

/**
 * Variante MySQL da camada de dados — Kriativos OnBoard 2026 (ônibus fretado).
 *
 * Espelha php/lib/db.php (PostgreSQL) com as MESMAS funções públicas:
 * bus_config(), bus_pdo(), json_response(), read_json_body(), log_failure().
 *
 * A senha NUNCA fica aqui nem em public_html. Ela é lida de um arquivo
 * fora do document root: ~/kob-config/bus-secrets.php
 *
 * Compatível com PHP 8.0 (host Locaweb roda 8.0.10).
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
    // A home do usuário é o local REAL do arquivo na Locaweb e não depende de
    // onde este .php foi instalado. Caminhos relativos sozinhos são frágeis:
    // rodar de /tmp ou de uma subpasta diferente já os faz falhar.
    $homes = [getenv('HOME'), $_SERVER['HOME'] ?? null];
    // A extensão posix não existe em todo host; só usamos se disponível.
    if (function_exists('posix_getpwuid') && function_exists('posix_getuid')) {
        $pw = @posix_getpwuid(posix_getuid());
        if (is_array($pw) && isset($pw['dir'])) {
            $homes[] = $pw['dir'];
        }
    }
    foreach ($homes as $home) {
        if (is_string($home) && $home !== '') {
            $candidates[] = rtrim($home, '/') . '/kob-config/bus-secrets.php';
        }
    }
    // Este arquivo vive em php/mysql/lib/, um nível mais profundo que
    // php/lib/. Cobrimos os níveis acima para achar ~/kob-config tanto na
    // Locaweb (docroot = ~/public_html) quanto em execução local.
    $candidates[] = dirname(__DIR__, 4) . '/kob-config/bus-secrets.php';
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
                // Host real do Percona 5.7 da Locaweb (confirmado no painel).
                'db_host' => '186.202.152.70',
                'db_port' => 3306,
                'db_name' => 'db_kob_msql',
                'db_user' => 'db_kob_msql',
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

    if (!in_array('mysql', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('Driver pdo_mysql não está habilitado no servidor.');
    }

    $config = bus_config();
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        (int) $config['db_port'],
        $config['db_name']
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ];
    // Modo estrito evita truncamento silencioso de dados. Constante checada em
    // tempo de execução porque só existe quando pdo_mysql está carregado.
    //
    // Sem STRICT o Percona 5.7 do host (sql_mode=IGNORE_SPACE) aceita e TRUNCA
    // em silêncio: um CPF de 33 dígitos virava 14 caracteres sem erro algum.
    //
    // time_zone='+00:00' porque as colunas DATETIME do schema são declaradas
    // como UTC (MySQL não tem tipo com timezone). Usar '-03:00' aqui gravaria
    // horário de Brasília em coluna documentada como UTC — 3h de divergência.
    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $options[constant('PDO::MYSQL_ATTR_INIT_COMMAND')] =
            "SET sql_mode='STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION', time_zone='+00:00'";
    }

    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], $options);

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
    } catch (Throwable $ignored) {
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
