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

test('embarcados-contact: formulário congelado retorna 503 sem coletar dados', () => {
  const res = runPhpEndpoint('POST', {});
  assert.equal(res.code, 503);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'service_disabled');
});

test('embarcados-contact: não promete envio nem inscrição mesmo com dados válidos', () => {
  const res = runPhpEndpoint('POST', {
    name: 'Kriativo a Bordo',
    email: 'kriativo@exemplo.com.br',
    whatsapp: '11988887777',
    topic: 'Jogos no Crystal Lounge',
    message: 'Gostaria de tirar uma dúvida sobre levar jogos próprios.',
    newsletter: { email: true, whatsapp: true }
  });
  assert.equal(res.code, 503);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'service_disabled');
  assert.equal(res.body.contact_url, 'https://api.whatsapp.com/send?phone=5513981580498');
  assert.equal(res.body.message, undefined);
});

test('embarcados-contact: honeypot também não simula envio', () => {
  const res = runPhpEndpoint('POST', {
    website: 'http://spambot.evil.org',
    name: 'Bot',
    email: 'bot@spam.com'
  });
  assert.equal(res.code, 503);
  assert.equal(res.body.ok, false);
});

test('embarcados-contact: OPTIONS não processa submissão', () => {
  const res = runPhpEndpoint('OPTIONS');
  assert.equal(res.code, 204);
});
