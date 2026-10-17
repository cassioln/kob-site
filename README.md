# 🚢 Kriativos On Board 2026 — Manual do Repositório

> **Guia definitivo de arquitetura, regras de negócio, design system e desenvolvimento para desenvolvedores e agentes de IA.**

---

## 🧭 1. Visão Geral do Produto

O **Kriativos On Board (kob-site)** é a plataforma web oficial do **Kriativos On Board 2026** — o primeiro e maior cruzeiro temático de jogos de tabuleiro e RPG do Brasil, realizado a bordo do transatlântico **MSC Musica** (20 a 23 de novembro de 2026, Santos-SP a Búzios-RJ).

### Objetivos e Páginas Principais:
1. **Landing Page Principal ([`index.html`](./index.html)):** Experiência imersiva que apresenta o evento, o navio, as atrações, criadores convidados, cronograma, galeria histórica e tabela de lotes de cabines com conversão para WhatsApp.
2. **Sistema de Ônibus Fretado ([`onibus.html`](./onibus.html)):** Fluxo multi-step de reserva de transporte rodoviário fretado (SP ⇄ Santos), cálculo automático de valores, checkout Pix via Mercado Pago e upload de comprovante.
3. **Painel de Gestão Operacional ([`painel-onibus.html`](./painel-onibus.html)):** Dashboard administrativo autenticado para acompanhamento de reservas em tempo real, balanceamento de frota, alocação de passageiros por ônibus e exportação de manifestos em XLSX/PDF.

   **Editar reserva:** o lápis em cada reserva (lista e cards da Frota) abre um modal com
   todos os passageiros. Dá para corrigir nome, CPF, contato, faixa etária e grupo (o nome do grupo fica
   no cabeçalho do modal, travado até clicar em **Alterar grupo**), e marcar
   **Desistiu** (com motivo opcional) em reservas confirmadas, exceto VIP: reserva VIP não
   tem desistência e o modal traz o botão vermelho **Remover reserva VIP** (com confirmação),
   que substituiu o botão "−" dos cards. Reserva de uma pessoa só (VIP ou solo) abre já
   expandida, sem recolher. Quem desiste libera o assento
   (criança de colo não ocupa) e sai da chamada de embarque, mas continua na lista e no
   Excel. Nos cards da Frota, pagante que desistiu vira meeple vermelho (depois dos roxos) e,
   no tooltip, aparece com o nome vermelho e tachado e "Desistência" no lugar da faixa etária;
   reservas VIP aparecem primeiro. Remover VIP em ônibus bloqueado avisa antes de confirmar. Se o responsável desiste, o modal pede um novo, adulto 18+. Valores e status de
   pagamento não mudam. Cada salvamento fica em `bus_registration_edits` e, quando há
   desistência ou troca de responsável, a organização recebe um e-mail. Migração:
   [`php/db/010_registration_edit.sql`](./php/db/010_registration_edit.sql) (também criada
   pelo próprio painel no primeiro acesso, se o usuário do banco tiver permissão).

   A **Lista de embarque** abre como painel deslizante pelo botão **Lista de
   embarque** no topo, com a identidade do Checklist de Bordo, mantendo Reservas
   e Frota na tablist. No painel completo ela não abre sozinha; só o atalho
   `?chamada=1` e o modo sem rede abrem direto na chamada. Oferece chamadas independentes
   de ida e volta, busca, filtros e contagens por ônibus/grupo. Cada pessoa tem
   dois checks com rótulos visíveis: Ida roxa e Volta verde, em botões de
   60 × 80 px com glyph de 40 px. O trecho ativo pode ser marcado pelo próprio
   check ou pela linha inteira; o outro fica desabilitado e esmaecido.
   O cabeçalho fixo reúne acesso offline (nuvem), atualizar e fechar em botões
   de ícone de 44 px, além de Ida/Volta com setas e texto. Ida, Volta e o
   combobox de ônibus dividem a linha em 25% / 25% / 50%. O combobox,
   fechado, mede 52 px com texto de 13 px; até 374 px, 48 px e 12 px.
   O menu aberto usa texto de 18 px e opções de pelo menos 56 px. Oferece
   setas, Home/End, Enter, Escape, Tab e busca por digitação. Em espanhol até
   374 px, o campo fechado mostra “Todos”; a opção aberta mantém o nome completo.
   Todos, Faltantes e A bordo usam tabs com sublinhado de seleção e navegação
   por setas, Home e End, acima da busca. O resumo permanece visível durante
   a rolagem. A barra sempre mostra a ida como base roxa e sobrepõe o retorno
   em verde, com legendas para ambos em pt/en/es; o resumo acompanha o trecho
   ativo. O idioma segue a página, sem seletor dentro do slider.
   VIPs e reservas solo de um passageiro ficam em blocos próprios por ônibus,
   com código e checks individuais; reservas com várias pessoas mantêm seu grupo.
   A classificação usa a lista completa, sem transformar grupos em solo ao filtrar.
   Os títulos reutilizam o meeple do Planejamento: VIP laranja, solo azul e grupo roxo.
   Grupos mostram “Responsável: nome” no cabeçalho, antes da reserva; a indicação
   não aparece em cards individuais, VIPs ou solos. Crianças de colo têm o
   meeple rosa de 14 px ao lado do nome e mantêm o rótulo textual.
   O rodapé fixo **Exportar**, com seta para cima, fica recolhido; tocar nele
   sobe **Copiar, E-mail, Excel e PDF** de baixo para cima. Todas as saídas incluem todos os ônibus e ambos os trechos,
   independentemente dos filtros. E-mail abre somente um rascunho, com `.eml`
   completo para listas grandes; clipboard indisponível oferece texto selecionável.
   Excel e PDF são arquivos reais gerados pela API com nova leitura do MySQL.
   Avisos de carregamento, sucesso e erro flutuam no centro do slider e não
   ampliam o rodapé. Nenhuma mensagem é enviada automaticamente.
   A presença é gravada no MySQL por `/api/bus-boarding`, com o token administrativo
   existente e controle de revisão entre dispositivos; a atualização automática ocorre
   a cada oito segundos com a chamada aberta. A lista mínima e a fila de marcações
   ficam no IndexedDB, separadas por hash do acesso, sem CPF ou dados financeiros.
   Cada check é persistido no dispositivo antes do envio; a linha troca
   "Aguardando embarque" por "Sincronizando" (com rede) ou "Aguardando conexão"
   (sem rede) até o banco confirmar e mostrar "Confirmado às…". Contadores
   incluem a seleção local. Todos os avisos (pendências, conflitos, acesso
   expirado, erro de armazenamento ou de primeira conexão, pessoas sem ônibus)
   ficam no menu do ícone de nuvem, que funciona como central de notificações:
   verde online, amarelo com conexão instável, vermelho com traço sem conexão,
   número com as marcações aguardando envio e um ponto para os demais avisos.
   Avisos que exigem ação fazem a nuvem pulsar uma vez e são anunciados ao leitor
   de tela, sem abrir o menu sozinho.
   A fila sobrevive a recarga/fechamento e reenvia com conexão e chamada aberta.
   Conflitos exigem escolha explícita no menu da nuvem; sair com pendências pede
   confirmação. Sem armazenamento disponível, novas marcações ficam bloqueadas com aviso.
   Trocar o trecho durante uma gravação mantém a resposta vinculada ao trecho
   original; os anúncios acessíveis identificam pessoa e trecho em pt/en/es.
   A área de chamada oferece português, inglês e espanhol, selecionados por
   `?lang=pt`, `?lang=en` ou `?lang=es`, com a língua da página como padrão.
   A composição e os resultados de QA estão na
   [especificação da lista de embarque](./docs/superpowers/specs/2026-10-15-lista-embarque-design.md)
   na [especificação de exportação](./docs/superpowers/specs/2026-10-16-embarque-exportar-design.md)
   e na [especificação offline](./docs/superpowers/specs/2026-10-16-embarque-offline-design.md).

   **Usar no celular/tablet sem sinal:** com internet, abrir a chamada; ela se
   prepara sozinha para uso offline (sem botão). Conferir o ✓ no ícone de nuvem
   do cabeçalho, que indica **Pronto neste dispositivo**.
   O app instalável **Busão KOB - Lista de Embarque** (nome curto "Busão KOB",
   ícone com a frente do ônibus) abre `painel-onibus.html?chamada=1`, sem
   carregar Reservas/Frota. Para instalar, use **Instalar** no menu da nuvem
   (Android/Chrome) ou adicione à tela inicial pelo menu do navegador (no
   iPhone/iPad, Compartilhar → Adicionar à Tela de Início). No Android, instale
   pelo **Chrome**. No Samsung Internet a instalação pode ser bloqueada pelo
   Google Play Protect ("App de risco bloqueado"); pelo Chrome o mesmo app
   instala sem esse aviso. Quem instalou uma versão anterior precisa remover o
   atalho e instalar de novo para ver o nome e o ícone novos. No iPhone/iPad,
   abra o atalho com internet e entre; a chamada se prepara sozinha. Confira o ✓
   na nuvem. O navegador pode separar os dados do Safari e do app. Não limpar os
   dados do site antes de enviar a fila. Depois do primeiro preparo, o
   armazenamento persistente é solicitado automaticamente, sem garantia contra
   remoção pelo sistema/usuário. Primeiro uso e exportações precisam de conexão.
   A sincronização não depende de execução em segundo plano com o app fechado.

   **Publicação:** enviar a página, os novos CSS/JS, `.htaccess`, `embarque-sw.js`,
   os manifestos `embarque.webmanifest` em pt/en/es e o ícone SVG de embarque, além de
   `php/mysql/bus-boarding.php`, `php/lib/bus-boarding.php` e os geradores
   `php/lib/boarding-rollcall-{pdf,xlsx}.php`. A tabela aditiva é criada de forma
   idempotente no primeiro acesso autenticado. Se o usuário do banco não tiver
   permissão `CREATE`, um administrador deve aplicar
   `php/db/009_bus_boarding_checkins.sql` antes da publicação. `php/db` continua
   excluído do FTP; o bootstrap da API não depende desse diretório no servidor.
   Nenhuma presença existente é reinicializada por deploy ou recarga. O service
   worker exige HTTPS em produção (localhost funciona para testes), armazena
   somente assets explícitos e nunca respostas de API ou URLs com chave.
   Ao atualizar o shell, manter a mesma versão nos assets HTML e em
   `embarque-sw.js`; atualizações aguardam o encerramento das sessões abertas.

   **Teste de persistência:** `php php/tests/bus-boarding.test.php` valida os
   payloads. Para integrar com banco descartável, definir `KOB_BOARDING_TEST_DSN`
   apontando para um banco chamado exatamente `kob_boarding_test`, com usuário
   `root` e senha vazia. O teste recria tabelas exclusivamente nesse banco.
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
# Iniciar o servidor local (porta 8085):
./preview.sh
# Ou diretamente via PHP:
php -S localhost:8085 router.php
```
> Acesse: `http://localhost:8085` (não abra via `file://` para evitar bloqueios de CORS e módulos JS).

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
