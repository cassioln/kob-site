## Resumo

Ajustes no player da live do Manual de Bordo, pedidos depois do #24/#25.

**Controles do mobile**
- A barra de progresso do assunto (tempo atual, barra, duração) fica no topo do dock, acima de Anterior / Play / Próximo.
- Anterior e Próximo têm a mesma altura do play/pause (56px). O nome do assunto fica em uma linha; quando não cabe, corre em loop (o mesmo letreiro do desktop, que aqui roda sem hover). Com movimento reduzido, fica parado com "…".

**Carregamento do vídeo (mobile e desktop)**
- Enquanto o YouTube carrega, a capa da live continua sobre o player, escurecida, com um indicador girando e "Carregando vídeo…" (EN/ES também), em vez da tela preta. Some com fade quando o vídeo começa.
- Se o autoplay for bloqueado (comum no iPhone), a capa sai 4s depois de o player ficar pronto; em erro ou API bloqueada, sai na hora; e há um limite de 15s.

**Aviso "Regra atualizada" (mobile)**
- Flutua sobre o topo do vídeo e só aparece depois de 4s de reprodução do assunto, sem empurrar o resto da página.
- Usa as cores do aviso do desktop (fundo claro, filete dourado, texto azul-marinho), com texto em 0,75rem.
- "Mais detalhes" mantém o visual do botão do desktop, mas fica como uma aba presa ao canto inferior direito do aviso, sem ocupar uma linha a mais.
- O botão "−" no canto superior direito recolhe o aviso para um selo amarelo `⚠ Atualização +` no canto superior esquerdo do vídeo, com o ícone de alerta pulsando suavemente; tocar no selo abre o aviso de novo. Fica recolhido entre assuntos e o selo dá um sinal quando chega uma regra nova.
- O desktop não muda.

Também inclui `1646872`, a atualização da nota do checklist (PT, EN, ES), e um merge do `main` atual (conflito só na linha de versão do CSS, resolvido com a versão nova).

Versões de cache: `20261006-live-loading`.

## Testes

- [x] Conferido no navegador (375px e desktop), com o player simulado: ordem e altura dos controles, letreiro, capa de carregamento (incluindo autoplay bloqueado), aviso flutuante, aba "Mais detalhes", recolher e reabrir.
- [x] Testes unitários da live: 8/8.
- [ ] `npm run test:analytics`: novos testes para botões/letreiro, capa de carregamento e aviso flutuante; testes antigos do aviso no mobile atualizados.
- [ ] Testar no celular com o YouTube de verdade (o navegador do preview não toca o vídeo).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
