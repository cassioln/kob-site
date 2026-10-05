# Plano da legenda editorial

- [x] Substituir somente o estilo do título, aviso, ação e popover; preservar controles e lógica do player.
- [x] Atualizar a URL de cache do CSS nas três páginas do Manual.
- [x] Validar testes de comportamento, contraste e capturas desktop/mobile dos três idiomas.
- [ ] Concluir revisão independente e documentação da superfície.
- [ ] Commitar, publicar e confirmar o workflow e os arquivos de produção.

Direção: docs/superpowers/specs/2026-10-05-live-lower-third-overdrive.md. Escopo local ao componente, com escolha visual delegada pelo usuário.

Confirmação visual: 18 capturas com PT/EN/ES, desktop1440/850/2384 e celular390. Reservar espaço para a aba Assuntos resolveu a sobreposição da ação em telas intermediárias. Contrastes sem sombra: título3.85:1, texto13.03:1, destaque6.93:1 e ação9.88:1. Vídeo/API simulados.

Publicação: incluir todos os CSS/JS antes do HTML, inclusive módulos que pertencem a uma publicação anterior substituída. O fixture cobre arquivos alterados/novos/renomeados/excluídos, caminhos Unicode, histórico indisponível, módulos sem alteração no diff e ausência de arquivos públicos. Excluir docs/superpowers do FTP para não publicar os contratos internos de direção.

Última orientação: subir a aba Assuntos para 25% da altura, respeitando o limite que mantém a aba inteira em telas pequenas. Um trace de falha confirmou scrollLeft=418/309 na gaveta recolhida; overflow:clip impede esse deslocamento horizontal. Acrescentar verificações de estado recolhido, scrollLeft=0, posição da aba e espaço livre para Mais detalhes.

Validação final: 44 testes da live passaram em 1.7 min, incluindo PT/EN/ES, posição de25%, ausência de rolagem horizontal da gaveta, tooltip, toque/teclado, redução de movimento, fullscreen e antecipação do assunto. A verificação do hover manteve suas asserções, esperando o término do deslocamento antes de transferir o mouse; cinco repetições passaram. API do YouTube simulada.
