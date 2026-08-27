# Project Folders Structure Blueprint — Kriativos On Board (kob-site)

> **Document Version:** 1.1.0
> **Last Updated:** 2026-08-27
> **Repository:** `cassioln/kob-site`
> **Primary Technology Stack:** HTML5 / Modern CSS / Vanilla JS (Frontend) + PHP 8.0 / MySQL (Locaweb Production Backend) + Node.js (E2E Tests & Analytics Governance)

---

## 1. Structural Overview

O **Kriativos On Board (kob-site)** é uma aplicação web de alto desempenho que combina uma landing page rica e imersiva para evento temático (cruzeiro gamer), páginas satélites de conversão e transporte fretado, um sistema de gestão de reservas com checkout Pix via Mercado Pago, painel administrativo operacional e pipeline de conformidade com LGPD e Web Analytics.

### Princípios Arquiteturais:
1. **Zero-Build Frontend:** O site público utiliza HTML5 semântico, CSS modular nativo e Vanilla JavaScript sem a necessidade de bundlers pesados, garantindo carregamento instantâneo e publicação direta via CDN/FTP.
2. **Backend de Produção Oficial (Apache / Locaweb - `php/mysql/`):** Camada de produção oficial em PHP 8.0 + MySQL Percona 5.7, consumida através de rewrites do `.htaccess` e roteada localmente via `router.php`.
3. **Isolamento de Domínio e Operações:**
   * **Landing Page Principal:** `index.html` (experiência institucional, galeria responsiva, atrações, compra de cabines).
   * **Sistema de Ônibus Fretado:** `onibus.html` (checkout e cadastro de passageiros) e `painel-onibus.html` (gestão operacional de frota e exportação).
   * **Políticas & Compliance:** `politica-de-privacidade.html`, `politica-de-cookies.html`, `termos-de-transporte.html`.
4. **Governança Estrita de PII & Analytics:** Dados sensíveis (CPF, documentos) nunca entram em dataLayers de analytics ou URLs. Toda a infraestrutura de medição (`analytics/`) possui testes automatizados de PII.

---

## 2. Directory Visualization

```
kob-site/
├── .agents/                                # Configurações e skills do ecossistema de IA
│   ├── mcp_config.json                     # Configuração de servidores MCP locais
│   └── skills/                             # Custom Skills e pacotes de agentes
│       ├── clean-code/
│       ├── folder-structure-blueprint-generator/
│       ├── impeccable/
│       ├── knip/
│       ├── lgpd-brasil/
│       ├── multi-step-form-design/
│       ├── refactor/
│       ├── seo-audit/
│       ├── seo-competitor-pages/
│       ├── site-cleanup-and-organize/
│       └── target-serp/
├── .github/
│   └── workflows/                          # Pipelines de CI/CD (GitHub Actions)
│       └── deploy.yml
├── analytics/                              # Infraestrutura de medição, tags e conformidade PII
│   ├── ga4/                                # Schemas e definições de eventos GA4
│   ├── gtm/                                # Contêineres e configurações GTM
│   │   ├── canonical/
│   │   ├── import/
│   │   └── raw/
│   ├── scripts/                            # Validadores de configuração de analytics
│   │   └── validate-config.mjs
│   └── tests/                              # Testes automatizados de eventos e PII (Playwright)
│       └── helpers/
├── assets/                                 # Recursos estáticos públicos do frontend
│   ├── css/                                # Folhas de estilo modulares
│   │   ├── cookie-consent.css
│   │   ├── main.css
│   │   ├── onibus.css
│   │   └── painel-onibus.css
│   ├── fonts/                              # Fontes web otimizadas (WOFF2)
│   │   ├── chantal-bold.woff2
│   │   ├── chantal-medium.woff2
│   │   ├── gobold-extra2-italic.woff2
│   │   └── gobold-extra2.woff2
│   ├── hero-frames/                        # Frames para animação de scroll no hero (0001 a 0060)
│   ├── images/                             # Imagens otimizadas categorizadas por domínio
│   │   ├── brand/                          # Logos, selos e isotipos
│   │   ├── cabins/                         # Fotos das cabines do navio
│   │   ├── creators/                       # Fotos dos criadores de conteúdo convidados
│   │   ├── drinks/                         # Pacotes de bebidas
│   │   ├── gallery/                        # Fotos em alta resolução da edição anterior
│   │   │   └── 2025/
│   │   │       └── thumbs/                 # Thumbnails responsivos gerados dinamicamente
│   │   ├── hero/                           # Backgrounds do hero
│   │   ├── partners/                       # Logos de patrocinadores e parceiros
│   │   ├── ship/                           # Fotos da estrutura do MSC Musica
│   │   ├── story/                          # Imagens da narrativa e cartas do evento
│   │   │   └── cards/
│   │   ├── tour-thumbs/                    # Thumbnails do tour 360° virtual
│   │   └── transport/                      # Banners e OG images do transporte fretado
│   ├── js/                                 # Scripts interativos do frontend
│   │   ├── cookie-consent.js               # Gerenciador de consentimento LGPD
│   │   ├── main.js                         # Controladores da landing page principal
│   │   ├── onibus.js                       # Formulário multi-step de reserva de ônibus
│   │   └── painel-onibus.js                # Painel de controle de frota e exportação
│   └── videos/                             # Vídeos otimizados (MP4 / WebM)
├── docs/                                   # Documentação técnica e visualizador de e-mails
│   ├── email-previews/                     # Templates e visualizador interativo de e-mails
│   │   ├── preview-emails.html             # Visualizador desktop/mobile
│   │   ├── preview-email-admin.html
│   │   ├── preview-email-confirmacao.html
│   │   ├── preview-email-passageiro.html
│   │   └── preview-email-pix.html
│   ├── superpowers/                        # Planos e especificações de features
│   │   ├── plans/
│   │   └── specs/
│   ├── ANALYTICS-PREREQUISITES.md          # Pré-requisitos de analytics e GA4/GTM
│   ├── DESIGN.md                           # Design system, tokens e direção de arte
│   ├── ONIBUS-PAGAMENTO.md                 # Arquitetura do checkout Pix e banco
│   └── PRODUCT.md                          # Contexto de negócio e produto
├── php/                                    # Backend de Produção PHP 8.0 + MySQL
│   ├── db/                                 # Migrations SQL e scripts de banco de dados
│   │   ├── 001_bus_registrations_mysql.sql
│   │   ├── 002_add_bus_number.sql
│   │   ├── 003_add_bus_settings.sql
│   │   ├── 004_add_fleet_assignment_status.sql
│   │   ├── 005_add_vip_reservations.sql
│   │   ├── 006_remove_legacy_vip_reservations.sql
│   │   ├── 007_rename_pandemic_legacy.sql
│   │   └── 008_normalize_contact_data.php
│   ├── lib/                                # Utilitários, geradores de PDF e helpers
│   │   ├── admin-email.php
│   │   ├── boarding-pdf.php
│   │   ├── bus-fleet.php
│   │   ├── confirmation-email.php
│   │   ├── contact-display.php
│   │   ├── db.php
│   │   ├── email-parts.php
│   │   ├── group-names.php
│   │   ├── mercadopago.php
│   │   ├── mp-signature.php
│   │   ├── passenger-email.php
│   │   ├── pdf.php
│   │   ├── pix-email.php
│   │   ├── receipt-pdf.php
│   │   ├── smtp.php
│   │   ├── validation.php
│   │   ├── vip-reservations.php
│   │   └── xlsx.php
│   ├── mysql/                              # Endpoints HTTP da API (Produção Locaweb)
│   │   ├── bus-admin-data.php
│   │   ├── bus-admin-reconcile.php
│   │   ├── bus-admin-xlsx.php
│   │   ├── bus-fleet-assign.php
│   │   ├── bus-fleet-auto-balance.php
│   │   ├── bus-fleet-lock.php
│   │   ├── bus-manifest.php
│   │   ├── bus-payment-proof.php
│   │   ├── bus-registration-status.php
│   │   ├── bus-settings-update.php
│   │   ├── bus-vip-create.php
│   │   ├── bus-vip-delete.php
│   │   ├── create-pix-order.php
│   │   ├── mercadopago-webhook.php
│   │   └── lib/                            # Helpers específicos do MySQL
│   └── tests/                              # Suíte de testes de integração PHP
│       ├── boarding-pdf.test.php
│       ├── bus-fleet-balance.test.php
│       ├── bus-fleet-lock.test.php
│       ├── contact-display.test.php
│       ├── double-check-lock.php
│       ├── pending-reconciliation.test.php
│       ├── validation.test.php
│       ├── vip-reservations.test.php
│       └── xlsx.test.php
├── server/                                 # Camada de lógica compartilhada Node.js
│   ├── bus-payment.mjs
│   ├── cors.mjs
│   ├── http.mjs
│   ├── mercadopago.mjs
│   └── tests/                              # Testes automatizados do backend Node
│       ├── bus-payment.test.mjs
│       ├── cors.test.mjs
│       ├── group-names.test.mjs
│       ├── mp-signature.test.mjs
│       └── xlsx-coluna-letra.test.mjs
├── .htaccess                               # Regras Apache, versão do PHP e rewrites de API
├── index.html                              # Landing page principal do evento
├── onibus.html                             # Página de reserva do transporte fretado
├── painel-onibus.html                      # Painel administrativo de gestão de frota
├── politica-de-cookies.html                # Política de cookies (LGPD)
├── politica-de-privacidade.html            # Política de privacidade (LGPD)
├── termos-de-transporte.html               # Termos de transporte fretado
├── whatsapp.html                           # Redirecionamento canônico de WhatsApp
├── preview.sh                              # Script para subida do servidor de preview local
├── router.php                              # Router para desenvolvimento local (`php -S`)
├── package.json                            # Scripts de teste, lint e dependências Node
├── knip.json                               # Configuração de auditoria de dead code / knip
├── robots.txt / sitemap.xml                # Configurações de indexação SEO
├── README.md                               # Guia de início rápido e visão geral
└── Project_Folders_Structure_Blueprint.md  # Blueprint da estrutura de pastas
```

---

## 3. Key Directory Analysis

| Diretório | Responsabilidade Principal | Tecnologias | Convenções & Padrões |
| :--- | :--- | :--- | :--- |
| **`assets/css/`** | Estilos visuais e layout responsivo. | Vanilla CSS, CSS Variables | Um arquivo CSS por página/módulo (`main.css`, `onibus.css`, etc.). Sem dependência de Tailwind/Sass. |
| **`assets/js/`** | Comportamento interativo e comunicação assíncrona. | Vanilla JS (ES6+) | Módulos auto-contidos via IIFE ou classes limpas. Tratamento explícito de erros e loaders de UI. |
| **`assets/images/`** | Mídias gráficas categorizadas por domínio. | WebP, JPG, SVG, PNG | Subpastas estritas por tema (`cabins/`, `creators/`, `gallery/`, `brand/`). |
| **`php/mysql/`** | Endpoints de produção acessados pelo frontend. | PHP 8.0 + PDO MySQL | `declare(strict_types=1);`, autenticação via token Bearer quando administrativo, respostas JSON. |
| **`php/lib/`** | Biblioteca de classes e helpers reutilizáveis. | PHP 8.0 | Funções puras e classes de domínio (geração de PDF nativo sem lib externa, envio SMTP, sanitização). |
| **`php/tests/`** | Testes de integração e validação de regras de negócio. | PHP CLI | Scripts executáveis diretamente via terminal (`php php/tests/*.php`). |
| **`server/`** | Regras de negócio e contratos de validação Node. | Node.js ESM (`.mjs`) | Validações rigorosas de schema, CORS dinâmico por allowlist, suíte com `node --test`. |
| **`analytics/`** | Governança de tags, eventos e auditoria de PII. | Playwright, JSON Schema | Schemas declarativos de eventos e testes para garantir que nenhum CPF/email vaze em tags. |
| **`docs/`** | Especificações de negócio e arquitetura. | Markdown | Planos de execução e documentação de APIs em `docs/superpowers/`. |

---

## 4. File Placement Patterns

| Tipo de Arquivo | Onde Deve Ser Criado | Exemplo de Caminho |
| :--- | :--- | :--- |
| **Nova Página Pública** | Raiz do repositório | `novo-evento.html` |
| **Novo Endpoint de Produção (PHP)** | `php/mysql/` | `php/mysql/bus-novo-recurso.php` |
| **Nova Classe/Helper PHP** | `php/lib/` | `php/lib/novo-helper.php` |
| **Nova Migration MySQL** | `php/db/` (sequencial) | `php/db/009_nova_tabela.sql` |
| **Novo Teste Backend PHP** | `php/tests/` | `php/tests/novo-recurso.test.php` |
| **Novo Módulo Compartilhado Node** | `server/` | `server/novo-servico.mjs` |
| **Novo Teste Node** | `server/tests/` | `server/tests/novo-servico.test.mjs` |
| **Nova Folha de Estilo** | `assets/css/` | `assets/css/novo-modulo.css` |
| **Novo Script Frontend** | `assets/js/` | `assets/js/novo-modulo.js` |
| **Nova Imagem/Asset** | `assets/images/<categoria>/` | `assets/images/brand/novo-selo.webp` |

---

## 5. Naming and Organization Conventions

### Nomenclatura de Arquivos:
* **Arquivos e Pastas:** `kebab-case` em minúsculas (ex: `painel-onibus.js`, `bus-registration-status.php`, `boarding-pdf.php`).
* **Migrations SQL:** Prefixo numérico de 3 dígitos com descrição em snake_case (ex: `001_bus_registrations_mysql.sql`, `008_normalize_contact_data.php`).
* **Arquivos de Teste:** Sufixo `.test.mjs`, `.test.php` ou `.spec.js` (ex: `group-names.test.mjs`, `whatsapp-redirect.spec.js`).

### Padrões de Código:
* **JavaScript / Node.js:**
  * Constantes globais e de configuração em `UPPER_SNAKE_CASE` (ex: `API_AUTO_BALANCE`, `MAX_ATTEMPTS`).
  * Variáveis e funções em `camelCase` (ex: `formatarMoeda()`, `validarPassageiro()`).
* **PHP:**
  * Modo estrito obrigatório no topo de todo arquivo: `declare(strict_types=1);`.
  * Funções utilitárias em `snake_case` (ex: `json_response()`, `format_currency_brl()`).
  * Constantes em `UPPER_SNAKE_CASE` (ex: `PROOF_MAX_BYTES`).

---

## 6. Navigation and Development Workflow

### Como Executar o Projeto Localmente:
1. **Servidor Local Unificado (com suporte a rotas `/api/*`):**
   ```bash
   ./preview.sh
   # Inicia em http://localhost:8080 servindo as páginas estáticas e roteando APIs para php/mysql/*.php
   ```
2. **Execução Direta via PHP CLI:**
   ```bash
   php -S localhost:8080 router.php
   ```

### Fluxo de Testes Automatizados:
```bash
# Executar todos os testes de servidor Node:
npm run test:server

# Executar validação de tags de Analytics e PII:
npm run validate:analytics
npm run test:analytics

# Executar suíte de testes de integração PHP:
for f in php/tests/*.php; do php "$f"; done

# Executar auditoria de código morto:
npm run lint:knip
```

---

## 7. Build and Deployment Architecture

* **Hospedagem de Produção (Locaweb):**
  * Servidor Apache com PHP 8.0 (`php80-script`) e MySQL 5.7.
  * O arquivo `.htaccess` gerencia o rewrite transparente de `/api/<endpoint>` para `php/mysql/<endpoint>.php`.
* **CI/CD:**
  * GitHub Actions configurado em `.github/workflows/deploy.yml` para publicação via FTP seguro.

---

## 8. Structure Templates

### Template: Novo Endpoint PHP (`php/mysql/meu-endpoint.php`)
```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/db.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(405, ['error' => 'Método não permitido.']);
    exit;
}

try {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode((string) $rawInput, true, 512, JSON_THROW_ON_ERROR);

    // Regra de negócio...
    json_response(200, ['ok' => true, 'data' => []]);
} catch (\Throwable $e) {
    error_log('[meu-endpoint] Erro: ' . $e->getMessage());
    json_response(500, ['error' => 'Erro interno ao processar requisição.']);
}
```

### Template: Novo Teste Node (`server/tests/meu-modulo.test.mjs`)
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('deve processar regra de negócio com sucesso', () => {
  const resultado = true;
  assert.equal(resultado, true);
});
```

---

## 9. Structure Enforcement & Governance

Para manter este blueprint respeitado nas próximas alterações:
1. **Auditoria Contínua:** Utilizar periodicamente a skill [`site-cleanup-and-organize`](./.agents/skills/site-cleanup-and-organize/SKILL.md) e `npm run lint:knip` para verificar novos assets órfãos ou código morto.
2. **Proteção de Assets na Raiz:** Nunca salvar arquivos `.png`, `.jpg`, `.css` ou `.js` diretamente na raiz do projeto.
3. **Validação de Sintaxe PHP:** Rodar periodicamente o linter em lote: `for f in php/mysql/*.php php/lib/*.php; do php -l "$f"; done`.
4. **Git Cleanliness:** Manter `.gitignore` atualizado contra artefatos locais de teste (`test-results/`), logs e caches do sistema.
