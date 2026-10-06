# Avisos da live — Implementation Plan

**Goal:** sincronizar os 23 avisos existentes à fala correspondente.

**Architecture:** `noticeSeconds` no acervo de assuntos; predicado puro
`isNoticeDue(topic, seconds)` no módulo de timeline; controlador calcula a
visibilidade em toda atualização do player, sem latch de quatro segundos.

**Tech Stack:** JavaScript ES modules, CSS, HTML PT/EN/ES, Playwright e Node.

## Global Constraints

- Base `feat/manual-faq-nav-sticky-scrollspy`, commit `8e4e391`.
- Sem novas dependências, mudanças nas regras vigentes ou redesign.
- Tempos absolutos das legendas pt-orig; término na fronteira do próximo assunto.
- Sem aviso temporizado quando a API não fornece o relógio.
- Ícone SVG; rótulos `ATUALIZAÇÃO`, `UPDATE`, `ACTUALIZACIÓN`.

## Execução nesta sessão

- [x] Registrar 23 `noticeSeconds` e relatório com início, fim e âncora de fala.
  Arquivos: `assets/js/manual-de-bordo-live-data.js`, `docs/reports/2026-10-06-avisos-live.md`.
- [x] Exportar `isNoticeDue(topic, seconds)` usando `topicBounds`; atualizar
  `syncNotice` em `assets/js/manual-de-bordo-live.js` para reavaliar o instante
  atual, ocultar detalhes obsoletos e preservar a opção de recolhimento.
- [x] Compartilhar o SVG/rótulo entre aviso do vídeo e resultado da busca.
  Ajustar apenas alinhamento do ícone em `assets/css/manual-de-bordo.css`.
  Atualizar versões dos assets alterados nas três páginas e imports.
- [x] Adaptar testes antigos que esperavam quatro segundos. Testar os
  instantes mapeados, seeks nos dois sentidos, fim do assunto, fallback,
  mobile recolhido e PT/EN/ES. Rodar `node --test analytics/tests/live-notice-timing.test.mjs`
  e a suíte `analytics/tests/manual-live.spec.js` em preview local.
- [x] Criar convite WhatsApp com `GROUP_INVITE_CUES`, janela de 12 s e
  `isGroupInviteDue(seconds)` na timeline. Posicionar em `updateDimensions`
  no topo à esquerda (desktop) ou acima do título (mobile). Testar menções
  excluídas, janelas sobrepostas, novo destino por clique e movimento reduzido.
- [x] Conferir capturas desktop/mobile, diff, erros de JavaScript e `git diff --check`.

## Apoios adicionais

Mapeamento das 31 propostas em `docs/reports/2026-10-06-apoio-live-propostas.md`.
Não implementar a nova categoria antes da aprovação individual solicitada
pelo mantenedor. Primeira proposta: transfer da Viação Cometa.
