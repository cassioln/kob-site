# Menu mobile da home e letreiro dos assuntos

Escopo autorizado: refinamento solicitado pelo usuário nas homes PT/EN/ES e nos controles da live do Manual. Publicar após validar. Manter desktop, conteúdo e efeitos anteriores fora desse escopo.

## Menu da home

- No breakpoint do menu sanduíche (até 1320 px), ocultar o CTA do Manual no header.
- Remover o link simples do Manual da lista do drawer e reutilizar o CTA traduzido acima da reserva, num grupo vertical de ações com largura total e altura igual de 64 px.
- Idiomas continuam no header, com três controles de 44 × 44 px, cantos, borda e superfície iguais ao botão do menu. O grupo não terá fundo próprio; idioma ativo terá destaque legível.
- Preservar destinos, preferência de idioma, fechamento por Escape, foco e atributos de analytics da reserva. Drawer com rolagem em alturas pequenas.

## Letreiro da live

- Nome longo percorre horizontalmente somente quando o botão do assunto é expandido por hover ou foco no desktop. Nomes curtos ficam estáticos. Largura máxima do botão expandido cai cerca de 40%: 300 → 180 px no desktop e 230 → 138 px entre 769 e 1000 px (área do texto 130/88 px).
- Medir a diferença entre largura real do texto e área visível; usar transform, velocidade aproximada de 24 px/s, pausa inicial/final e retorno suave. Recalcular após trocar assunto, carregar fontes ou redimensionar.
- Manter um único texto no DOM, nome completo em aria-label/title e a ordem dos ícones atual. Redução de movimento mantém texto estático com reticências; celular preserva controles compactos.
- Parar a animação ao recolher o botão ou ocultar a página. Nenhuma nova dependência.

## Cor e detalhes da live

- Direção atual: controles no roxo #71206c, play/pause branco e ações secundárias claras com ícones roxos. Tempos e barra geral em tons claros, foco dourado e hover branco/ciano suave; manter a barra geral de 3 px, seus marcadores e tooltip claro.
- Trocar a ação por Mais detalhes / More details / Más detalles, com SVG de informação, superfície, borda, underline e estados de hover/foco/aberto. Preservar popover por mouse, toque e teclado; title traduzido explica a interação.
- Direção final solicitada com Impeccable delight: título desktop branco em fundo transparente, com contorno navy de 1 px e sombra suave para leitura sobre o vídeo. Na inversão solicitada em seguida, o aviso passa ao mesmo roxo #71206c, com texto branco, destaque ciano claro e ação branca com texto roxo. O título transparente cresce para clamp(1.7rem, 3.25vw, 3.2rem). Mais detalhes fica fora do role=status, numa div irmã à direita. Largura da composição constante de até 900 px mantém a ação na mesma posição entre assuntos. No mobile, ação abaixo do texto alinhada à direita. Reutilizar os mesmos nós ao redimensionar e ocultar toda a linha quando o assunto não tiver aviso.

## Troca do assunto

No desktop, antecipar a troca automática nos últimos 2.52 segundos reais do assunto: sair em 160 ms, aguardar 2000 ms e entrar em 360 ms, terminando quando o próximo assunto começa. As fases seguem o tempo e a velocidade reais do player; o loop de animação só existe nos últimos quatro segundos. Ocultar o aviso anterior durante a troca e atualizar aviso/controles no início efetivo do próximo assunto. Seleção manual aparece imediatamente. Pausa/buffering, mobile, redução de movimento e documento oculto cancelam a antecipação e restauram o assunto atual. Preservar a continuidade de 340 ms do lower-third ao ocultar/revelar controles, mantendo o alvo Mais detalhes imóvel durante a transferência do mouse para a janela.

## Verificação e publicação

Verificar PT/EN/ES em 320, 390, 850, 1200, 1320/1321 e 1440 px, topo e após rolagem, drawer em altura pequena, teclado, destinos e igualdade das ações. Testar letreiro com texto longo/curto, troca, resize e redução de movimento, com API do YouTube simulada. Fazer uma rodada visual conjunta e no máximo uma confirmação após correções. Revisão independente e documentação de superfície pelo fluxo Impeccable; publicar e conferir workflow, hashes e comportamento em produção.
