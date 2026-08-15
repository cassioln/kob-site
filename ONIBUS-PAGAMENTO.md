# Ônibus fretado — operação e deploy

A página `onibus.html` coleta o contato principal e os passageiros, calcula uma prévia do valor no navegador e envia o cadastro para uma API server-side. O valor definitivo é calculado novamente no servidor.

## Banco escolhido

A implementação usa PostgreSQL. **Banco provisionado e schema já aplicado** (2026-08-14):

| Item | Valor |
|---|---|
| Host | `db_kob.postgresql.dbaas.com.br` (`179.188.16.134`) |
| Porta | `5432`, acessível externamente |
| Usuário / base | `db_kob` / `db_kob` |
| Versão | PostgreSQL 15.6 |
| Tabelas | `bus_registrations`, `bus_passengers`, `bus_payment_proofs` |

### Certificado TLS expirado — leia antes de depurar

O servidor responde com **certificado expirado** (`CERT_HAS_EXPIRED`). É preciso
`PGSSL_REJECT_UNAUTHORIZED=false`, ou o driver recusa a conexão e nada é gravado.
A conexão segue cifrada; abre-se mão apenas da validação da cadeia. Remova a flag
quando a Locaweb renovar o certificado.

Cuidado com uma pegadinha do driver: em `pg` >= 9, o `sslmode` da URL vence o
objeto `ssl` e `require` é tratado como `verify-full`. Por isso
`buildPoolConfig()` remove `sslmode` da connection string e decide a política de
TLS em um só lugar — coberto por `server/tests/postgres-ssl.test.mjs`.

O fluxo grava:

- cadastro do grupo e status da reserva;
- passageiros relacionados ao cadastro;
- comprovante (JPG, PNG, WebP ou PDF, até 2 MB) vinculado ao cadastro;
- referência externa, order e payment ID do Mercado Pago;
- valor em centavos, sem confiar no valor exibido no navegador.

CPF e demais dados de passageiros ficam apenas no banco operacional; não entram em analytics, URLs ou logs da aplicação.

## Variáveis de ambiente

Configure na hospedagem, nunca no HTML:

- `DATABASE_URL`: conexão PostgreSQL com SSL quando suportado;
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token privado do ambiente escolhido (sandbox ou produção).

O arquivo `.env.example` contém apenas o formato. Não copie um token real para ele.

## Mercado Pago

A função cria `POST /api/create-pix-order` usando `processing_mode: automatic`, Pix (`id: pix`, `type: bank_transfer`) e uma chave `X-Idempotency-Key` por tentativa.

Configure no Mercado Pago a notificação do tópico Order para:

```text
https://SEU-DOMINIO/api/mercadopago-webhook
```

O webhook consulta a order no Mercado Pago antes de atualizar o banco. Assim, uma notificação forjada não confirma a vaga sozinha. Os estados internos são `payment_pending`, `paid_awaiting_proof`, `confirmed`, `payment_failed`, `cancelled` e `refunded`.

`GET /api/bus-registration-status?id=UUID` expõe somente o status operacional para o polling da página. `POST /api/bus-payment-proof` recebe o comprovante em base64, valida MIME, assinatura binária, tamanho e calcula SHA-256 antes de gravar em PostgreSQL.

## Confirmação automática (mudou em 2026-08-14)

O fluxo **não exige mais comprovante**. Pagamento aprovado vira `confirmed` direto.

Antes, o pagamento era feito por fora (Google Forms) e declarado pelo usuário: o
comprovante era a única evidência disponível, então `map_provider_status()`
devolvia `paid_awaiting_proof` e a vaga só fechava depois do upload.

Hoje o webhook consulta a order autenticada na API do Mercado Pago. Essa é uma
fonte mais confiável que um arquivo enviado pelo cliente, então exigir o
comprovante virava atrito sem ganho de segurança.

O que foi removido:

- o `<div class="bus-proof-upload">` de `onibus.html`;
- `submitProof()`, `readFileAsBase64()` e o estado `paid_awaiting_proof` do
  polling em `assets/js/onibus.js`;
- a checagem `hasPaymentProof` nos dois webhooks PHP e no `server/http.mjs`.

O que foi **mantido de propósito**:

- `POST /api/bus-payment-proof` e a tabela `bus_payment_proofs` continuam
  existindo, sem uso na interface. Servem para anexar um comprovante manualmente
  em caso excepcional (contestação, pagamento fora do fluxo) sem precisar de
  migração de banco;
- o estado `paid_awaiting_proof` permanece no ENUM e nas listas de status. Ele
  não é mais produzido pelo fluxo normal, mas cadastros antigos podem tê-lo
  gravado e o código precisa continuar lendo esses registros;
- o CSS `.bus-proof-upload` em `assets/css/onibus.css`, órfão. Fica disponível
  caso o painel volte a ser usado para o caso manual.

## Regra das crianças (corrigida em 2026-08-14)

Crianças de até 5 anos são **adicionais ao grupo e não pagam**: viajam no colo de
um pagante. Logo cada criança precisa de um colo disponível:

    criancas <= pagantes

`passenger_count` conta só os **pagantes**. O valor cobre `passenger_count`
integral; as crianças entram sem assento e sem custo.

| Pagantes | Máx. crianças | A bordo | Cobrado |
|---|---|---|---|
| 1 | 1 | 2 | R$ 120 |
| 4 | 4 | 8 | R$ 480 |
| 7 | 7 | 14 | R$ 840 |

Interpretações erradas já cometidas aqui, para não repetir:

- `passenger_count - 1` permitia 3 crianças com 1 adulto (3 colos por pessoa);
- `floor(total / 2)` tratava crianças como subconjunto do total e cobrava a
  menos (4 pessoas com 2 crianças cobrava 2 passagens em vez de 4).

Aplicada em cinco camadas, nunca só no navegador: `assets/js/onibus.js`,
`php/lib/validation.php`, `server/bus-payment.mjs`, as triggers de
`php/db/001_bus_registrations_mysql.sql` e o CHECK de
`server/db/001_bus_registrations.sql`.

O campo fica **sempre visível**: com 1 pagante ainda cabe 1 criança no colo.

## Janela de atenção de 10 minutos (2026-08-14)

O Pix do Mercado Pago vale **24h** (medido: `date_of_expiration` em
`transactions.payments[0]`, não na order nem em `payment_method`). Mas exibir
"expira em 23h 59min" não cria urgência nenhuma e a pessoa abandona a aba com a
vaga em aberto.

O painel mostra um contador de **10 minutos em mm:ss**. Ao zerar, o código
reconsulta o servidor e só então abre o `<dialog>` "Você ainda está aí?":

- **Continuar pagamento** → devolve outros 10 minutos e retoma o polling;
- **Cancelar transação** → apenas volta para `index.html`. Não cancela nada no
  Mercado Pago nem no banco: a cobrança pode seguir válida se a pessoa já pagou.

O contador **não decide nada**. A reconsulta antes de abrir o aviso evita alarme
falso em quem pagou nos últimos segundos — coberto por teste.

## Confirmação da vaga (2026-08-14)

Quando o pagamento é identificado, `#confirmation-panel` **substitui** o painel
de pagamento (`#payment-panel` vai para `hidden`).

Antes a confirmação era uma linha de texto no rodapé de uma coluna, com o mesmo
peso visual de um link, enquanto um QR gigante e o título "Agora falta o Pix"
continuavam no ar. A hierarquia dizia o oposto do estado real e convidava a
pagar de novo.

A seção traz selo animado, título display, valor pago, código curto da reserva
(primeiro bloco do UUID), manifesto numerado com os nomes, aviso das crianças,
próximos passos e um botão de imprimir com `@media print`.

**Os nomes vêm do que o usuário digitou nesta sessão**, guardados em
`confirmedSnapshot` quando o Pix é gerado. `GET /api/bus-registration-status`
continua devolvendo **apenas** `status` e `statusDetail`: é consultado só com o
UUID e não deve expor nome, CPF, e-mail ou WhatsApp.

## Runtime: pendência bloqueante

> **RESOLVIDO em 2026-08-14.** O roteamento `/api/*` foi implementado no
> `.htaccess` e o deploy passou a excluir o código que não executa neste host.
> Esta seção fica como registro do diagnóstico. Ver "Roteamento e proteção"
> abaixo para o estado atual.

A hospedagem atual **não executa este backend Node**. Verificado em 2026-08-14:
`kriativosonboard.com.br` responde `Server: Apache` servindo HTML estático, e
`.github/workflows/deploy.yml` publica por **FTP em `public_html` na Locaweb**.

| Camada | Roda na Locaweb hoje? |
|---|---|
| `onibus.html`, `assets/css/onibus.css`, `assets/js/onibus.js` | Sim |
| `server/*.mjs` | Não |
| `api/*.mjs` (Vercel) | Não |
| `netlify/functions/*.mjs` | Não |

O banco aceita conexão externa, então serve aos dois cenários. Opções:

1. **PHP/PDO pgsql na Locaweb** — mesmo domínio, sem CORS, usa o deploy FTP atual.
   Exige reescrever os endpoints e guardar a senha **fora de `public_html`**.
2. **API Node em subdomínio** (Vercel/Netlify) — aproveita este código, exige CORS.
3. **Migrar o site inteiro** para Vercel/Netlify — aproveita tudo sem alteração.

Enquanto isso não for decidido, a página coleta os dados mas `POST /api/create-pix-order`
retorna 404 em produção. Não anuncie a página antes de resolver o runtime.

## Roteamento e proteção (implementado em 2026-08-14)

O frontend chama `/api/<endpoint>`; os arquivos reais são `php/mysql/*.php`.
Sem reescrita as rotas retornavam 404, porque o host serve o repositório como
conteúdo estático. O `.htaccess` passou a fazer essa ligação:

```apache
RewriteRule ^api/create-pix-order/?$ php/mysql/create-pix-order.php [QSA,L]
```

`QSA` é obrigatório: `bus-registration-status?id=UUID` depende da query string.

Validado com **Apache 2.4.66 local**, servindo o `.htaccess` real e usando
stubs CGI no lugar do PHP para ler `QUERY_STRING` e `REQUEST_METHOD`:

| Verificação | Resultado |
|---|---|
| 4 rotas `/api/*` resolvem para o `.php` correto | 200 |
| `id=UUID-PROVA-42` chega ao script | `QUERY_STRING=id=UUID-PROVA-42` |
| `POST` sobrevive ao rewrite | `REQUEST_METHOD=POST` |
| `php/lib/`, `php/mysql/lib/`, `php/db/`, `server/`, `netlify/`, `api/*.mjs` | 403 |
| `php/*.php` (endpoints PostgreSQL, código morto aqui) | 403 |
| `.env`, `.env.example`, `package.json` | 403 |
| `/`, `index.html`, `onibus.html`, assets | 200 |

Total: 25 asserções, 0 falhas.

### Armadilha: `<DirectoryMatch>` é ilegal em `.htaccess`

A primeira versão usava `<DirectoryMatch>` para negar os diretórios. Isso
derruba **todas** as requisições com `HTTP 500` e
`<DirectoryMatch not allowed here` no `error_log` — a diretiva só vale em
configuração de servidor. Em `.htaccess`, proteção por caminho precisa de
`mod_rewrite` (`[F,L]`); `<FilesMatch>`, ao contrário, é permitido.

Bloquear os diretórios de apoio **não** quebra os endpoints: um `require` do
PHP é resolvido no filesystem e não passa pelo controle de acesso do Apache.

### Deploy

O FTP publica a raiz do repositório, então tudo que não é preciso em produção
foi excluído no workflow: `analytics/`, `server/`, `api/`, `netlify/`,
`php/db/`, `node_modules/`, `package*.json`, `.env*` e os `.md` internos.
Nenhum HTML referencia esses caminhos — verificado.

O `.htaccess` continua bloqueando os mesmos caminhos, de propósito: se um
arquivo chegar ao host por upload manual ou por mudança no workflow, a
proteção não depende só da lista de exclusão.

### Segredos: nada a configurar no GitHub

Os secrets do Actions (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`) servem apenas ao
transporte. As credenciais de runtime são lidas de `~/kob-config/bus-secrets.php`,
fora do document root — um secret de Actions **não** vira variável de ambiente
na Locaweb. Por isso `DB_KOB_PASSWORD` não tinha efeito algum e foi removido.

## Runtime: decidido — PHP 8.0 + MySQL na Locaweb

Validado de ponta a ponta **no host real** em 2026-08-14. O que foi medido:

| Camada | Estado |
|---|---|
| Apache + PHP | `8.0.10` com `pdo_mysql`, `openssl`, `curl`, `fileinfo`, `mbstring` |
| Banco | Percona `5.7.32` em `186.202.152.70:3306`, base `db_kob_msql` |
| Mercado Pago | order Pix real criada do servidor, QR PNG válido |
| Endpoints | `php/mysql/*.php`, 5/5 válidos em `php80 -l` |

### Por que MySQL e não o PostgreSQL que também existe

O PostgreSQL 15.6 (`db_kob.postgresql.dbaas.com.br`) **funciona com Node, não com
o PHP deste host**: exige `scram-sha-256` e a `libpq` da Locaweb é `9.5` (2016),
que falha com `authentication method 10 not supported`. Não há contorno sem root.
Já o `pdo_mysql` usa mysqlnd compilado no PHP 8.0 e não depende dessa lib.

### Percona 5.7: as triggers são obrigatórias

O MySQL 5.7 **aceita e ignora** `CHECK constraints` — só 8.0.16+ as aplica. Por
isso `php/db/001_bus_registrations_mysql.sql` traz 6 triggers com
`SIGNAL SQLSTATE '45000'`. Testado no banco real: grupo só de crianças, status
inválido, 999 passageiros, valor negativo, CPF duplicado, comprovante de 3 MB e
MIME `.exe` — todos bloqueados, em `INSERT` e em `UPDATE`.

Aplique o schema com o utilitário, **não** com um cliente qualquer:

```bash
node php/db/apply-mysql-schema.mjs           # aplica
node php/db/apply-mysql-schema.mjs --verify  # confere
```

`DELIMITER $$` é comando do cliente `mysql`, não do servidor: enviar o arquivo
inteiro por um driver cria as tabelas mas **não** as triggers, deixando o banco
sem validação alguma. O utilitário separa os blocos e falha se houver menos de
6 triggers.

### Duas armadilhas do host que já custaram tempo

1. `sql_mode` padrão é `IGNORE_SPACE`, sem `STRICT`: um CPF de 33 dígitos era
   **truncado em silêncio** para 14 caracteres. `php/mysql/lib/db.php` força
   `STRICT_ALL_TABLES` por sessão.
2. `time_zone` precisa ser `+00:00`. As colunas `DATETIME` são documentadas como
   UTC; usar `-03:00` gravava horário de Brasília — 3 h de divergência.

### Sandbox do Mercado Pago exige e-mail @testuser.com

Em ambiente de teste, `payer.email` que não termine em `@testuser.com` recebe
`400 invalid_email_for_sandbox`. Em produção usa-se o e-mail real do contato.
`mp_request()` agora registra o `code` do provedor em `error_log` — antes todo
erro virava a mesma frase genérica e a depuração ficava cega.

## Netlify e Vercel (alternativa Node)

- Netlify: `netlify.toml` aponta para `netlify/functions` e redireciona `/api/*` para as funções.
- Vercel: os adaptadores em `api/` são reconhecidos como funções Node.

Como o comprovante é armazenado em `bytea`, mantenha a política de retenção do evento sob controle e faça backup do PostgreSQL. O limite intencional de 2 MB evita transformar o banco em armazenamento de mídia.

A hospedagem precisa permitir que a função Node acesse o PostgreSQL. Se o banco do plano bloquear conexões externas, não coloque a senha no frontend: nesse caso, use a API PHP da própria hospedagem para o banco ou um PostgreSQL gerenciado com acesso restrito.

## Testes locais

```bash
npm run test:server
npx playwright test analytics/tests/bus-payment.spec.js
```

Os testes de navegador mockam a resposta do Mercado Pago; eles não movimentam dinheiro. Antes de produção, faça uma transação sandbox e confira: cadastro no banco, order vinculada, evento de webhook e transição para pago.
