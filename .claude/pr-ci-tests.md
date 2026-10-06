## Resumo

Novo workflow **Testes** (`.github/workflows/tests.yml`), separado do deploy por FTP. Em todo PR para a `main`, numa máquina limpa do GitHub:

1. instala Node 22, as dependências (`npm ci`) e o Chromium do Playwright, com cache;
2. roda `npm run test:server` (unitários em Node, incluindo os trechos PHP) e `npm run test:analytics` (os ~180 testes de navegador);
3. marca as falhas direto no PR e, quando algo falha, anexa screenshots, vídeos e traces (artefato `playwright-falhas`, guardado por 7 dias).

Detalhes:
- PR em rascunho não roda; roda ao marcar "Ready for review".
- Um push novo no PR cancela a rodada anterior.
- Dá para rodar manualmente em Actions → Testes → Run workflow.
- O repositório é público, então os minutos de Actions são gratuitos no plano Free.
- O deploy não muda (`.github/` já é excluído do FTP).

## Depois do merge: bloquear merge com teste vermelho

Settings → Branches → regra para `main` → **Require status checks to pass before merging** → selecionar **Testes (servidor + navegador)**. O check só aparece na busca depois que o workflow rodou pelo menos uma vez. Para valer também para você como admin, marque a opção que impede o bypass.

## Observação

Enquanto o #27 não entrar, a `main` tem as 10 falhas antigas: se este PR rodar antes, ele mesmo fica vermelho. Melhor mergear o #27 primeiro.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
