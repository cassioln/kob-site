# 🚢 Kriativos On Board 2026 — Manual do Repositório

> **Guia definitivo de arquitetura, regras de negócio, design system e desenvolvimento para desenvolvedores e agentes de IA.**

---

## 🧭 1. Visão Geral do Produto

O **Kriativos On Board (kob-site)** é a plataforma web oficial do **Kriativos On Board 2026** — o primeiro e maior cruzeiro temático de jogos de tabuleiro e RPG do Brasil, realizado a bordo do transatlântico **MSC Musica** (20 a 23 de novembro de 2026, Santos-SP a Búzios-RJ).

### Objetivos e Páginas Principais:
1. **Landing Page Principal ([`index.html`](./index.html)):** Experiência imersiva que apresenta o evento, o navio, as atrações, criadores convidados, cronograma, galeria histórica e tabela de lotes de cabines com conversão para WhatsApp.
2. **Sistema de Ônibus Fretado ([`onibus.html`](./onibus.html)):** Fluxo multi-step de reserva de transporte rodoviário fretado (SP ⇄ Santos), cálculo automático de valores, checkout Pix via Mercado Pago e upload de comprovante.
3. **Painel de Gestão Operacional ([`painel-onibus.html`](./painel-onibus.html)):** Dashboard administrativo autenticado para acompanhamento de reservas em tempo real, balanceamento de frota, alocação de passageiros por ônibus e exportação de manifestos em XLSX/PDF.
4. **Páginas Legais & Compliance:** [`politica-de-privacidade.html`](./politica-de-privacidade.html), [`politica-de-cookies.html`](./politica-de-cookies.html), [`termos-de-transporte.html`](./termos-de-transporte.html).

---

## 🏛️ 2. Arquitetura Técnica & Stack

O projeto adota uma arquitetura focada em performance máxima, simplicidade operacional e custo zero de build:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND ESTÁTICO                               │
│  HTML5 Semântico + Vanilla CSS (Design Tokens) + Vanilla JS (Zero-Build)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Chamadas AJAX / Fetch (/api/*)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND PRODUÇÃO (APACHE + PHP LOCAWEB)                 │
│  • Apache 2.4 com .htaccess (roteamento /api/* -> php/mysql/*.php)          │
│  • PHP 8.0 (strict_types=1, pdo_mysql, curl, mbstring, openssl)             │
│  • MySQL 5.7 (Percona / 6 Triggers de integridade e regras de negócio)      │
│  • php/mysql/*.php (Endpoints da API) + php/lib/*.php (Classes utilitárias) │
│  • Segredos e chaves em bus-secrets.php fora do document root                │
└─────────────────────────────────────────────────────────────────────────────┘
```

* **Frontend Zero-Build:** Não utiliza bundlers (Webpack/Vite) nem frameworks pesados (React/Vue). O deploy é estático, direto e com carregamento instantâneo.
* **Backend de Produção Oficial (Locaweb):** PHP 8.0 com MySQL 5.7 em `php/mysql/`. O arquivo `.htaccess` roteia automaticamente as requisições `/api/<endpoint>` para `php/mysql/<endpoint>.php`.
* **Suíte de Testes e Governança:** Módulos em `server/` fornecem suíte de testes de unidade e regras de negócio via `node --test`, além de testes E2E/LGPD via Playwright em `analytics/tests/`.
* **Segurança e Isolamento:** Credenciais e tokens de API em produção ficam no arquivo `bus-secrets.php` fora do document root do servidor web.

---

## 📚 3. Índice Completo de Documentações

Todas as documentações especializadas do projeto estão organizadas em `docs/` e na raiz:

| Documento | Localização | Para que serve |
| :--- | :--- | :--- |
| **Blueprint de Pastas** | [`Project_Folders_Structure_Blueprint.md`](./Project_Folders_Structure_Blueprint.md) | Guia detalhado da árvore de diretórios, convenções de código, regras de posicionamento de novos arquivos e templates de código. |
| **Contexto do Produto** | [`docs/PRODUCT.md`](./docs/PRODUCT.md) | Definição de personas, tom de voz da marca, objetivos de conversão, princípios de acessibilidade e anti-referências. |
| **Design System & Tokens** | [`docs/DESIGN.md`](./docs/DESIGN.md) | Cores oficiais da marca KOB, tipografia, espaçamentos, raios de borda, micro-animações e componentes da interface. |
| **Manual de Pagamentos & Banco** | [`docs/ONIBUS-PAGAMENTO.md`](./docs/ONIBUS-PAGAMENTO.md) | Arquitetura completa do checkout de ônibus, integração Mercado Pago Pix, webhooks, idempotência, migrations MySQL e regras de concorrência. |
| **Governança de Analytics & PII** | [`docs/ANALYTICS-PREREQUISITES.md`](./docs/ANALYTICS-PREREQUISITES.md) | Contratos de dados GA4/GTM, parametrização UTM, allowlist de eventos e testes automatizados contra vazamento de dados sensíveis (PII). |
| **Visualizador de E-mails** | [`docs/email-previews/`](./docs/email-previews) | Ferramenta interativa (`preview-emails.html`) para inspecionar os templates de e-mail transacional (Pix pendente, confirmação, passageiro, administrativo). |
| **Planos & Specs Técnicas** | [`docs/superpowers/`](./docs/superpowers) | Planos de implementação e especificações detalhadas de features históricas e em andamento. |

---

## 📁 4. Estrutura de Diretórios

```
kob-site/
├── .agents/                    # Skills e configurações de agentes de IA locais
├── .github/workflows/          # Pipelines de CI/CD para deploy automatizado (FTP Locaweb)
├── analytics/                  # Configurações GA4/GTM, schemas e testes de PII
│   ├── ga4/                    # Definições de eventos GA4
│   ├── gtm/                    # Exportações e contêineres GTM
│   ├── scripts/                # Validadores de configuração
│   └── tests/                  # Testes Playwright de eventos e PII
├── assets/                     # Recursos estáticos públicos do frontend
│   ├── css/                    # Folhas de estilo modulares (main, onibus, painel)
│   ├── fonts/                  # Fontes locais WOFF2 (Chantal, Gobold)
│   ├── hero-frames/            # Frames sequenciais para animação de scroll no hero
│   ├── images/                 # Imagens organizadas estritamente por tema
│   │   ├── brand/              # Logos e ícones
│   │   ├── cabins/             # Fotos de cabines
│   │   ├── creators/           # Fotos dos convidados
│   │   ├── drinks/             # Pacotes de bebidas
│   │   ├── gallery/2025/       # Galeria histórica e thumbs dinâmicos
│   │   ├── partners/           # Logos de parceiros
│   │   ├── ship/               # Fotos da estrutura do navio
│   │   ├── story/              # Cartas temáticas e narrativa
│   │   ├── tour-thumbs/        # Thumbnails do tour 360°
│   │   └── transport/          # Mídias e banners do transporte
│   ├── js/                     # Scripts Vanilla JS modulares
│   └── videos/                 # Vídeos comprimidos (MP4/WebM)
├── docs/                       # Manuais técnicos, design system e previews
│   ├── email-previews/         # Templates e visualizador de e-mails
│   └── superpowers/            # Specs e planos de implementação
├── php/                        # Backend oficial de produção (PHP 8.0 + MySQL)
│   ├── db/                     # Migrations e scripts SQL sequenciais
│   ├── lib/                    # Classes utilitárias (PDF, SMTP, validação)
│   ├── mysql/                  # Endpoints de produção da API
│   └── tests/                  # Testes de integração PHP
├── server/                     # Módulos Node compartilhados e suíte de testes
│   └── tests/                  # Testes automatizados node --test
├── .htaccess                   # Configuração Apache Locaweb (versão PHP e rewrites)
├── index.html                  # Landing page principal
├── onibus.html                 # Página de reserva do ônibus
├── painel-onibus.html          # Painel de gestão da frota
├── preview.sh                  # Servidor local de desenvolvimento
├── router.php                  # Roteador embutido para PHP CLI
├── knip.json                   # Configuração de auditoria de dead code / knip
├── package.json                # Dependências de teste e validação
└── robots.txt / sitemap.xml    # Indexação e SEO
```

---

## 🎨 5. Design System & Identidade Visual

O design do KOB 2026 equilibra o clima **lúdico/nerd** dos jogos de tabuleiro com a imponência de um cruzeiro de luxo.

### Paleta de Cores Oficial:
* **Ocean Abyss (`#041d3a`) / Ocean Navy (`#082f57`):** Fundos profundos e elegantes inspirados no oceano noturno.
* **Ocean Blue (`#00aeef`) / Ocean Cyan (`#29c3f5`):** Ciano vibrante para destaques, links e elementos de água.
* **Kriativa Purple (`#7b1fa2`) / Deep (`#57127a`):** Roxo principal da marca — utilizado em **Ações Principais e Botões de Conversão (CTAs)**.
* **Kriativa Magenta (`#e5007e`) / Magenta Glow (`#ff5aa8`):** Acento dinâmico para badges, alertas e efeitos de brilho.
* **Sunset Gold (`#ffc20e`) / Deep (`#f7941e`):** Laranja e amarelo para sensação de celebração e calor.

### Tipografia:
* **Títulos e Display:** `'Bricolage Grotesque'`, sans-serif display moderna e expressiva.
* **Corpo de Texto:** `'Hanken Grotesk'` / `'Overpass'`, legível e com alto contraste em telas mobile.
* **Acentos de Marca:** `'Chantal'` e `'Gobold'` (fontes locais em `assets/fonts/`).

### Componentes Exclusivos da Interface:
1. **Hero Frame Scrubbing:** Sequência de frames WebP renderizada via `<canvas>` de acordo com o scroll do usuário.
2. **Galeria Constelação:** Grid responsivo que consome WebPs full-size com thumbnails otimizados em `assets/images/gallery/2025/thumbs/`.
3. **Tour 360° Virtual:** Iframe com preview dinâmico dos ambientes do MSC Musica.
4. **Cards Narrativos Super Trunfo:** Cards interativos em `assets/images/story/cards/` ilustrando a experiência a bordo.

---

## 🛡️ 6. Regras Críticas & Gotchas do Projeto

Ao realizar alterações no código, **sempre respeite as seguintes regras inegociáveis**:

1. **Diretiva de Versão do PHP na Locaweb (`.htaccess`):**
   * **NUNCA remova** o bloco inicial do `.htaccess`:
     ```apache
     ##### LOCAWEB - NAO REMOVER #####
     AddHandler php80-script .php
     suPHP_ConfigPath /home/kriativosonboard2/
     ##### LOCAWEB - NAO REMOVER #####
     ```
   * *Motivo:* Sem essas linhas, a Locaweb rebaixa a execução para PHP 5.2.17 e todos os endpoints quebram com HTTP 500.
2. **Proteção Rigorosa de Dados Pessoais (LGPD / PII):**
   * CPF, e-mail, telefone e dados de passageiros **nunca** devem ser enviados para dataLayers de analytics, URLs públicas ou logs.
   * A suíte `npm run test:analytics:pii` valida essa proteção continuamente.
3. **Cálculo de Preço Server-Side:**
   * O valor da reserva de ônibus exibido no frontend é apenas uma estimativa visual. O backend recalcula o valor real com base no número de passageiros e tipo de assento antes de gerar a cobrança Pix.
4. **Idempotência no Checkout Pix:**
   * Toda criação de pedido envia um cabeçalho `X-Idempotency-Key` único para evitar cobranças duplicadas em caso de reenvio de formulário.
5. **Assets Órfãos e Código Zumbi:**
   * Nunca deixe código comentado ou assets não utilizados. Execute periodicamente a skill [`site-cleanup-and-organize`](./.agents/skills/site-cleanup-and-organize/SKILL.md) e `npm run lint:knip`.

---

## 💻 7. Desenvolvimento Local & Testes

### Como Subir o Ambiente de Desenvolvimento:
O projeto inclui um servidor local embutido que serve os arquivos estáticos e emula os rewrites de `/api/*` para `php/mysql/*.php`:

```bash
# Iniciar o servidor local (porta 8080):
./preview.sh
# Ou diretamente via PHP:
php -S localhost:8080 router.php
```
> Acesse: `http://localhost:8080` (não abra via `file://` para evitar bloqueios de CORS e módulos JS).

### Execução de Testes Automatizados:

```bash
# 1. Executar todos os testes do backend Node:
npm run test:server

# 2. Validar configurações de Analytics e PII:
npm run validate:analytics

# 3. Executar testes end-to-end com Playwright:
npm run test:analytics

# 4. Lint de sintaxe PHP em lote:
for f in php/mysql/*.php php/lib/*.php; do php -l "$f"; done

# 5. Executar testes unitários do backend PHP:
for f in php/tests/*.php; do php "$f"; done

# 6. Auditoria de código morto e dependências:
npm run lint:knip

# 7. Rodar bateria completa de testes:
npm test
```

---

## 🚀 8. Publicação & Deploy

* **Produção (Hospedagem Locaweb):**
  * O deploy é acionado automaticamente via GitHub Actions ([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)) ao realizar push na branch principal.
  * O workflow publica o conteúdo estático e os scripts PHP diretamente para o `public_html/` via FTP seguro com exclusão automática de arquivos de desenvolvimento (`analytics/`, `server/`, `node_modules/`, `.git/`, etc.).
