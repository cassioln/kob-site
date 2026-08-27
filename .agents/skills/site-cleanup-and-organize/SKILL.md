---
name: site-cleanup-and-organize
description: Guia e protocolo especializado para auditoria, organização de pastas, eliminação de código/arquivos mortos (dead code & unused assets) e refatoração limpa no projeto kob-site (HTML, CSS, JS, PHP, Node/Serverless, Netlify, Vercel e Apache). Use sempre que precisar organizar a estrutura de arquivos, limpar sobras, auditar assets não utilizados ou refatorar a base de código com segurança.
metadata:
  version: 1.0.0
  project: kob-site
---

# Site Cleanup & Project Organizer (kob-site)

Você é um Arquiteto de Software e Engenheiro Especialista em Manutenibilidade, focado em manter a base de código do **kob-site** ultra-organizada, enxuta, sem arquivos órfãos e com arquitetura limpa e previsível.

Este guia sintetiza as melhores práticas de **Folder Structure Blueprint**, **Knip / Dead-Code Hunting**, **Refactoring Seguro** e **Clean Code (Uncle Bob)**, adaptadas especificamente para a arquitetura híbrida deste projeto.

---

## 🏛️ 1. Mapa e Blueprint de Arquitetura do Projeto

O projeto combina **Frontend Estático Moderno (HTML5/CSS3/Vanilla JS)** com uma camada de **API / Backend Híbrida (Node.js Serverless + PHP/MySQL)**.

### Estrutura Padronizada de Diretórios:

```
kob-site/
├── .agents/                    # Configurações de agentes e skills do projeto
│   └── skills/                 # Skills locais ativas
├── analytics/                  # Configurações e scripts de rastreamento (GA4, GTM)
├── api/                        # Handlers Serverless (Vercel/Netlify functions em .mjs)
├── assets/                     # Recursos estáticos públicos do frontend
│   ├── css/                    # Folhas de estilo (modularizadas ou principais)
│   ├── fonts/                  # Fontes web locais
│   ├── hero-frames/            # Sequência de frames para animações de scroll/canvas
│   ├── images/                 # Imagens públicas, ícones, logos, banners
│   ├── js/                     # Scripts frontend (módulos, validação, painéis)
│   └── videos/                 # Vídeos e mídias de alta resolução
├── docs/                       # Documentações técnicas e especificações do produto
├── netlify/                    # Configurações e functions específicas da Netlify
├── php/                        # Backend legado e serviços PHP
│   ├── db/                     # Conexões e scripts de banco de dados
│   ├── lib/                    # Classes, helpers e bibliotecas utilitárias PHP
│   ├── mysql/                  # Migrations, procedures e queries MySQL
│   └── tests/                  # Scripts e testes de integração PHP
├── server/                     # Módulos compartilhados do backend Node.js
│   ├── db/                     # Conexão e repositórios de dados Node
│   └── tests/                  # Testes automatizados do backend Node
├── test-results/               # Relatórios e capturas de testes (ignorado no git)
├── *.html                      # Páginas públicas do site (index, onibus, politicas...)
├── preview-email-*.html        # Templates/Previews isolados para renderização de e-mails
├── router.php                  # Roteador para servidor de desenvolvimento PHP local
├── netlify.toml / vercel.json  # Regras de deploy, redirecionamentos e headers
└── .htaccess                   # Configurações para servidores Apache
```

### Regras de Posicionamento de Novos Arquivos:
* **Novas Páginas Públicas:** Devem ficar na raiz (`*.html`) ou organizadas conforme regras de roteamento do `.htaccess` e `netlify.toml`.
* **Endpoints Serverless Node:** Devem ser declarados em `api/*.mjs` e importar lógica de negócio compartilhada de `server/`.
* **Endpoints & Helpers PHP:** Devem ficar estritamente sob a pasta `php/` (helpers em `php/lib/`, scripts de rotas em `php/`).
* **Assets e Mídias:** Nenhuma imagem, css ou js avulso deve residir na raiz; todos pertencem a subpastas de `assets/`.
* **Templates de E-mail / Ferramentas Internas:** Previews de teste devem ser identificáveis (`preview-email-*.html` ou agrupados) para não poluir rotas de produção.

---

## 🔍 2. Protocolo de Auditoria de Arquivos e Código Morto (Dead Code)

Antes de qualquer exclusão, realize uma varredura metódica nas 4 camadas:

### A. Auditoria de Assets Não Utilizados (Imagens, Fontes, Vídeos)
1. Listar todos os arquivos em `assets/images/`, `assets/fonts/`, `assets/videos/` e `assets/hero-frames/`.
2. Para cada asset, executar busca de referências nos arquivos `.html`, `.css`, `.js`, `.php`, `.mjs`, `.json`:
   ```bash
   # Exemplo de verificação de referência exata ou parcial:
   rg "nome-do-arquivo.png" -g "!test-results/**" -g "!node_modules/**"
   ```
3. Atenção para arquivos carregados dinamicamente via JS (ex: interpolação de caminho `assets/hero-frames/frame_${i}.jpg` ou nomes calculados). Se houver padrão gerado por loop, verificar a regra de template string antes de marcar como não utilizado.

### B. Auditoria de Arquivos PHP vs. Node (`api/` vs `php/`)
Devido à coexistência de PHP e Node.js:
1. Verificar se o frontend (`assets/js/*.js` ou formulários `.html`) faz requisição AJAX/Fetch para o endpoint.
2. Checar regras de rewrite em `.htaccess`, `netlify.toml` e `vercel.json`.
3. Verificar se o arquivo PHP é apenas um teste descartável em `php/tests/` ou um serviço de produção ativo.

### C. Auditoria de CSS Órfão e Seletores Não Utilizados
1. Mapear classes e IDs declarados nos arquivos `assets/css/*.css`.
2. Verificar se classes utilitárias ou seletores ainda existem nos templates `.html` e nas injeções dinâmicas de `assets/js/*.js`.

### D. Auditoria de Scripts e Funções JavaScript
1. Identificar funções não invocadas e variáveis globais obsoletas.
2. Identificar arquivos JS que não estão incluídos em nenhuma tag `<script>` nos arquivos HTML nem importados via ES Modules.

---

## 🛡️ 3. Níveis de Confiança para Limpeza (Confidence Levels)

Classifique sempre os itens encontrados antes de agir:

| Nível de Confiança | Critério | Ação Recomendada |
| :--- | :--- | :--- |
| 🟢 **Alta Confiança (Seguro)** | Arquivo ou asset com **0 referências** em todo o repositório, sem correspondência em strings dinâmicas, logs ou testes. | Remover diretamente ou arquivar. |
| 🟡 **Média Confiança (Checagem)** | Arquivos de preview/teste (`preview-email-*.html`, `php/tests/*.php`), arquivos com nomes referenciados apenas em comentários ou documentações legadas. | Confirmar com o usuário ou mover para pasta de arquivo/teste dedicada. |
| 🔴 **Baixa Confiança (Crítico)** | Arquivos de infraestrutura (`.htaccess`, `router.php`, `netlify.toml`, `.env.example`), arquivos legais (`politica-de-privacidade.html`, `politica-de-cookies.html`) e assets de branding/SEO (favicons, og-image, sitemap, robots.txt). | **Nunca deletar** sem validação explícita de conformidade técnica e legal. |

---

## 🧼 4. Padrões de Clean Code e Refatoração Cirúrgica

Ao limpar ou refatorar o código existente, siga as regras de ouro:

1. **Preservação de Comportamento:** Refatorar altera a estrutura interna sem alterar a saída ou comportamento esperado pelo usuário.
2. **Eliminação de Código Comentado (Zombie Code):** Nunca mantenha blocos de código comentados *"para o caso de precisar depois"*. O Git mantém o histórico completo.
3. **Guard Clauses / Early Return:** Substitua aninhamentos profundos de `if/else` por retornos antecipados:
   ```javascript
   // ❌ EVITAR (Arrow Code / Aninhado):
   function processarPedido(pedido) {
     if (pedido) {
       if (pedido.itens.length > 0) {
         if (pedido.pagamentoAprovado) {
           return finalizar(pedido);
         }
       }
     }
     return null;
   }

   // ✅ APLICAR (Guard Clauses / Clean):
   function processarPedido(pedido) {
     if (!pedido || pedido.itens.length === 0) return null;
     if (!pedido.pagamentoAprovado) return null;
     return finalizar(pedido);
   }
   ```
4. **Princípio da Responsabilidade Única (SRP):**
   * Funções JavaScript no frontend devem ter escopo reduzido (< 40 linhas) e fazer uma única tarefa bem feita.
   * Lógicas de manipulação de DOM separadas de regras de validação ou chamadas de API.
5. **Nomes Intencionais e Legíveis:** Evite abreviações crípticas (`calcD()`, `chkUsr()`). Use nomes que declarem o objetivo (`calcularDescontoPix()`, `validarStatusPassageiro()`).

---

## 📋 5. Checklist de Execução para Faxina de Projeto

Ao executar uma faxina completa:

- [ ] **Etapa 1: Diagnóstico da Árvore**
  - Listar estrutura de pastas atual e identificar arquivos fora do lugar na raiz.
- [ ] **Etapa 2: Varredura de Código Morto & Assets**
  - Rodar buscas por assets em `assets/` sem chamadas no HTML/CSS/JS.
  - Verificar scripts JS e rotas PHP órfãos.
- [ ] **Etapa 3: Plano de Remoção e Reorganização**
  - Apresentar tabela com itens identificados, motivo da remoção e nível de confiança.
- [ ] **Etapa 4: Execução Cirúrgica**
  - Remover código comentado, logs de debug esquecidos e arquivos confirmadamente não usados.
  - Reorganizar arquivos dispersos para suas pastas padronizadas.
- [ ] **Etapa 5: Validação Pós-Limpeza**
  - Executar testes automatizados existentes (ex: `npx playwright test` ou testes PHP).
  - Verificar no navegador se páginas principais carregam assets e estilos sem erros 404 no console.
