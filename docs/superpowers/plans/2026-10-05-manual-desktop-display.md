# Manual Desktop Display Implementation Plan

> Execução inline pelo agente principal, dentro dos pedidos diretos do usuário e da autorização de publicação vigente.

**Goal:** aplicar cinco refinamentos desktop com barra total discreta e manter mobile estável.
**Architecture:** HTML PT/EN/ES, CSS local do Manual e sincronização no módulo existente do player; progress sem interação, nenhum novo player.
**Tech Stack:** HTML, CSS, JavaScript, Node e Playwright.

## Restrições
- Breakpoint desktop >768 px; identidade, conteúdo e mobile preservados.
- Cópia isolada no worktree manual-desktop-player; alterações pendentes do checkout principal não entram na publicação.
- Sem nova dependência nem raster; nenhuma mensagem enviada por email/WhatsApp.

## Implementação e validação
- [ ] Ajustar CSS do assunto, ordem do próximo controle e visibilidade desktop/mobile dos links; adicionar progress total e rotas localizadas nas três páginas.
- [ ] Integrar atualização da duração total/tempo restante sem tocar no seek relativo; adaptar teste de header e acrescentar testes diretos dos novos comportamentos.
- [ ] Executar testes do Manual, revisar capturas bateladas em PT/EN/ES nas larguras 390, 850 e 1440 px, revisar diff e preservar o checkout principal.
- [ ] Publicar somente os commits deste worktree; confirmar o Actions e o conteúdo servido em produção.
