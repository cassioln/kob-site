<?php

/**
 * Router para o servidor embutido do PHP (`php -S localhost:8080 router.php`).
 *
 * Mapeia as rotas `/api/*` para `php/mysql/*.php`, espelhando o comportamento
 * do `.htaccess` da Locaweb em desenvolvimento local.
 */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri = rawurldecode((string) $uri);

// Rotas de API
if (preg_match('#^/api/([a-zA-Z0-9_-]+)/?$#', $uri, $matches)) {
    $endpoint = $matches[1];
    $target = __DIR__ . '/php/mysql/' . $endpoint . '.php';
    if (file_exists($target)) {
        require $target;
        return true;
    }
}

// Arquivos estáticos existentes (HTML, CSS, JS, imagens, etc.)
$filePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    return false; // Deixa o PHP servir o arquivo estático diretamente
}

// Fallback para raiz ou URLs amigáveis
if ($uri === '/' || $uri === '') {
    require __DIR__ . '/index.html';
    return true;
}

return false;
