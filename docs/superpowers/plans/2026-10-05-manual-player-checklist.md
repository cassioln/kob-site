# Manual: player e checklist — plano de implementação

> Execução inline autorizada pelo usuário; não exige nova escolha de execução.

**Goal:** checklist somente lateral, controles desktop internos e progresso/avisos por assunto, testados e publicados.
**Architecture:** HTML estático PT/EN/ES com uma fonte DOM de checklist, módulos ES para timeline e janela de orientação; YouTube IFrame API existente.
**Tech Stack:** HTML, CSS, JavaScript, Node test, Playwright, Apache e GitHub Actions/FTP.

## Restrições
- Preservar o texto do usuário e os 25 IDs de checklist/storage v1.
- Desktop >768px; mobile controles externos.
- Sem nova dependência, sem envio efetivo de mensagens/email em testes.
- Regras MSC registradas permanecem nos avisos/FAQ.

## Tarefas
- [x] Remover seção preparação nas três páginas; mover a lista canônica para o aside, reset e progresso únicos. Remover espelhamento JS, atualizar links de abertura/hash e snapshots/exportações. Acrescentar Compartilhar/Share/Compartir.
- [x] Criar módulo de timeline puro com intervalo/elapsed/seek e testes primeiro/último/limites. Integrar atualização pausada, reprodução contínua e scrub relativo.
- [x] Mover controles e assunto conforme breakpoint; desenhar ícones, expansão grid e circle-play. Aviso acima do vídeo com janela paralela acessível alimentada pelo FAQ vigente.
- [x] Analisar legendas/transcrição, registrar assuntos/timestamps novos comprovados e manter paridade do índice noscript e buscas.
- [x] Adaptar testes existentes e adicionar cobertura direta dos requisitos; executar Node e três suítes Manual Playwright, captura batelada em PT/EN/ES e desktop/mobile/intermediário.
- [ ] Revisar diff e artefatos, commitar/push main, verificar workflow e rotas em produção; marcar objetivo completo somente após evidência atual.
