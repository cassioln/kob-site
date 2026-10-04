import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import path from 'node:path';

function runPhpEndpoint(method, body = null) {
  const scriptPath = path.resolve('php/mysql/embarcados-contact.php');
  const phpCode = `
    $_SERVER['REQUEST_METHOD'] = '${method}';
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    ${body ? `$_POST = json_decode('${JSON.stringify(body).replace(/'/g, "\\'")}', true) ?: [];` : '$_POST = [];'}
    ob_start();
    register_shutdown_function(function() {
      $output = ob_get_clean();
      echo json_encode([
        'code' => http_response_code(),
        'body' => json_decode($output, true) ?: $output
      ]);
    });
    include '${scriptPath.replace(/\\/g, '/')}';
  `;

  const stdout = execFileSync('php', ['-r', phpCode], { encoding: 'utf-8' });
  return JSON.parse(stdout);
}

test('embarcados-contact: rejeita GET com status 405', () => {
  const res = runPhpEndpoint('GET');
  assert.equal(res.code, 405);
  assert.equal(res.body.ok, false);
});

test('embarcados-contact: rejeita submissão vazia com status 422 e mapa de validação', () => {
  const res = runPhpEndpoint('POST', {});
  assert.equal(res.code, 422);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.validation.name);
  assert.ok(res.body.validation.email);
  assert.ok(res.body.validation.message);
});

test('embarcados-contact: aceita submissão válida com status 200', () => {
  const res = runPhpEndpoint('POST', {
    name: 'Kriativo a Bordo',
    email: 'kriativo@exemplo.com.br',
    whatsapp: '11988887777',
    topic: 'Jogos no Crystal Lounge',
    message: 'Gostaria de tirar uma dúvida sobre levar jogos próprios.'
  });
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.message.includes('sucesso'));
});

test('embarcados-contact: protege contra bots via honeypot retornando 200 silencioso', () => {
  const res = runPhpEndpoint('POST', {
    website: 'http://spambot.evil.org',
    name: 'Bot',
    email: 'bot@spam.com'
  });
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
});
