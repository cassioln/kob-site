## Resumo

Leva para o mobile (até 768px) as funções que a live de embarque já tinha no desktop, seguindo a direção A aprovada no protótipo. O desktop não muda.

- **Título do assunto** sobre o vídeo, com a mesma troca antecipada do desktop.
- **Anterior / Próximo** mostram o nome do assunto (no mobile não existe hover).
- **Linha do tempo da live inteira** com um ponto por assunto: arrastar o dedo mostra hora e título, soltar pula para o assunto.
- **Assuntos** vira um botão largo embaixo do vídeo (sai a aba vertical que cobria a imagem) e abre uma folha de baixo que começa logo abaixo do vídeo; buscar ou arrastar para cima abre em tela cheia; escolher um assunto mantém a folha aberta.
- **Aviso "Regra atualizada"** vira uma faixa fina sob o vídeo, com "Mais detalhes ›" logo depois do texto; os detalhes abrem como folha de baixo com fundo escurecido.
- Textos novos em PT, EN e ES; versões de cache em `20261005-mobile-live`.

Também inclui `cff291a` — correção das regras de itens proibidos/permitidos no FAQ da home (PT, EN, ES).

## Testes

- [x] Preview em 375px, 768px e desktop; textos conferidos em EN e ES.
- [x] Testes unitários da live (`node --test server/tests/manual-live*.test.mjs`): 8/8.
- [ ] Reprodução real do YouTube no celular (o navegador do preview não toca o vídeo; o player foi testado com o estado "pronto" forçado).
- [ ] `npm run test:analytics` — não rodou no ambiente do agente (sandbox bloqueia o Chromium). Os testes que descreviam o layout mobile antigo foram atualizados e há um teste novo para o mobile.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
