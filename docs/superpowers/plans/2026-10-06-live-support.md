# Live Support Implementation Plan

> Execução nesta sessão, usando a aprovação já dada ao relatório; sem delegação.

**Goal:** aplicar somente os nove apoios aprovados, com os textos corrigidos.

**Architecture:** acervo localizado e função pura `supportAt(seconds)` em um
módulo próprio. O controlador combina o apoio com a atualização existente
num único aviso, sem substituir o texto vigente ou recriar controles por tick.

**Tech Stack:** ES modules, HTML/CSS PT/EN/ES, Node e Playwright existentes.

## Global Constraints

- Branch `code-ia/live-notice-transcript-timing`.
- IDs aprovados: 01, 02, 03, 05, 08, 09, 10, 15, 18. Nenhum outro apoio.
- Duração: 12 segundos de vídeo por fala, com todos os momentos aprovados.
- Link MSC for Me exatamente como fornecido; demais destinos do relatório.
- Preservar 17 convites e as atualizações autorizadas; a revisão editorial posterior retirou uma das 23, restando 22.
- Sem dependências novas, merge ou deploy nesta entrega.

## 1. Acervo e tempo

Arquivos: `assets/js/manual-de-bordo-live-support.js`,
`analytics/tests/live-notice-timing.test.mjs`.

- [x] Acrescentar teste de IDs aprovados, paridade PT/EN/ES, destinos,
  início/fim exclusivo de cada janela e tempos não aprovados.
- [x] Exportar `SUPPORT_NOTICES`, `SUPPORT_DURATION = 12` e
  `supportAt(seconds)`, retornando o aviso com uma ocorrência ativa
  ou `null` para tempo inválido/fora das janelas.
- [x] Rodar `node --test analytics/tests/live-notice-timing.test.mjs`.

## 2. Composição do player

Arquivos: `assets/js/manual-de-bordo-live.js`,
`assets/css/manual-de-bordo.css`, três páginas `manual-de-bordo.html`.

- [x] Em `syncNotice`, calcular atualização e apoio a partir do relógio. Usar
  chave `${update?.id ?? ''}:${support?.id ?? ''}` para renderizar somente
  quando o conteúdo muda.
- [x] Renderizar label com SVG de informação, corpo aprovado e ação externa
  ou botão FAQ. Manter o texto/FAQ da atualização; deduplicar FAQ idêntico.
- [x] Localizar selo recolhido e nomes acessíveis. Devolver foco ao play/pause
  antes de remover um controle focado; não fechar guia em todo tick.
- [x] No mobile, limitar/rolar o corpo do aviso com espaço real para ação,
  convite e assunto, sem alterar a altura do vídeo por estado.
- [x] Atualizar cache dos assets para `20261006-live-support`.
- [x] Aplicar o ajuste adicional do convite: fundo verde, marca e texto
  brancos, fonte display do assunto em tamanho menor; validar contraste,
  hover/foco e posição nas três línguas.

## 3. Validação e documentação

Arquivos: `analytics/tests/manual-live.spec.js`,
`docs/reports/2026-10-06-apoio-live-propostas.md`.

- [x] Testar todas as entradas nos dois sentidos em desktop/mobile, textos
  PT/EN/ES, externo apenas após clique, popover mantendo URL, coexistência
  com atualização/convite, foco, recolhimento e fallback sem API.
- [x] Rodar a suíte Playwright da live no preview local 4175.
- [x] Inspecionar um lote de capturas nos quatro tamanhos e três línguas;
  corrigir problemas reais em lote e confirmar no máximo uma vez.
- [x] Registrar nove aprovados/aplicados e 22 dispensados, preservar o
  histórico e conferir `git diff --check`; commitar a entrega validada.

**Resultado:** 7 testes Node e 63 testes do player passaram; inspeção visual concluída nos quatro tamanhos e três idiomas. Relatório atualizado; alterações preparadas para commit na branch solicitada.

## Ajuste editorial solicitado após a entrega

- [x] Em `manual-de-bordo-live-data.js`, remover `notice` e `noticeSeconds`
  de `chapter-1702`, preservando assunto, transcrição e FAQ. Restam 22
  atualizações. Usar a mesma nova versão desse módulo no controlador e na
  timeline.
- [x] Em `manual-de-bordo-live-support.js`, registrar `emphasis` PT/EN/ES
  apenas nas chamadas de Cometa, download do Guru e monitoria Encounter.
  Manter `texts` completos e intactos. No renderer, criar `<strong>` com
  `textContent` para o prefixo, sem inserir HTML do acervo.
- [x] Remover o rótulo visível de apoio, conservando os selos recolhidos e
  nomes acessíveis. Fazer o negrito herdar cor e tamanho do texto do aviso.
- [x] Atualizar assertions: atualização de aeroportos ausente, 22 avisos,
  apoios sem rótulo, texto completo preservado e destaque localizado.
  Rodar Node e testes do player relacionados aos avisos/apoios; conferir
  capturas desktop/mobile em PT/EN/ES e `git diff --check`.
- [x] Atualizar relatório/spec, cache dos três HTMLs e salvar na mesma branch.

**Validação da revisão editorial:** 7 testes Node e 10 testes do player relacionados passaram. Dezoito capturas desktop/mobile em PT/EN/ES sem overflow, sobreposição ou perda de legibilidade.
