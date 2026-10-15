# Encerramento das reservas do Busão — Implementation Plan

> Execução neste chat, preservando reservas e pagamentos existentes.

**Goal:** Encerrar novas vendas do fretado e informar vagas esgotadas em todas as chamadas públicas PT, EN e ES.

**Architecture:** O estado fechado fica explícito no HTML e nos endpoints públicos de criação de Pix. O cadastro permanece inacessível; uma sessão de pagamento existente pode ser recuperada. Consultas, webhooks, comprovantes e administração continuam disponíveis. Os avisos usam a identidade atual do site, sem alterar os termos de contratos existentes.

**Tech Stack:** HTML, CSS, JavaScript, PHP, Node.js e Playwright.

## Constraints
- Não executar SonarQube.
- Preservar as alterações atuais da main e os ids de FAQ e busca.
- Manter paridade PT, EN e ES e reconstruir os índices de busca.
- Não criar lista de espera nem anunciar novos ônibus ou novas vagas.

## Entregas e verificação
- [x] Fechar a criação pública de reservas antes de qualquer operação de banco ou pagamento; testar HTTP 409 sem dependências de produção.
- [x] Destacar vagas esgotadas na hero e substituir o cadastro por um aviso; testar bloqueio sem JavaScript e preservação da recuperação de uma reserva existente.
- [x] Revisar home, Manual, navegação, FAQs, links, metadados, termos e aviso atualizado da live nos três idiomas; preservar a transcrição histórica da gravação.
- [x] Reconstruir os índices e verificar que a busca informa o esgotamento.
- [ ] Conferir desktop/mobile e fluxo de reserva existente; executar CI, publicar e verificar os arquivos e o bloqueio públicos.
