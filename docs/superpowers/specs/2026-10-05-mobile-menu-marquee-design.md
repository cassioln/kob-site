# Menu mobile da home e letreiro dos assuntos

Escopo autorizado: refinamento solicitado pelo usuário nas homes PT/EN/ES e nos controles da live do Manual. Publicar após validar. Manter desktop, conteúdo e efeitos anteriores fora desse escopo.

## Menu da home

- No breakpoint do menu sanduíche (até 1320 px), ocultar o CTA do Manual no header.
- Remover o link simples do Manual da lista do drawer e reutilizar o CTA traduzido acima da reserva, num grupo vertical de ações com largura total e altura igual de 64 px.
- Idiomas continuam no header, com três controles de 44 × 44 px, cantos, borda e superfície iguais ao botão do menu. O grupo não terá fundo próprio; idioma ativo terá destaque legível.
- Preservar destinos, preferência de idioma, fechamento por Escape, foco e atributos de analytics da reserva. Drawer com rolagem em alturas pequenas.

## Letreiro da live

- Nome longo percorre horizontalmente somente quando o botão do assunto é expandido por hover ou foco no desktop. Nomes curtos ficam estáticos.
- Medir a diferença entre largura real do texto e área visível; usar transform, velocidade aproximada de 24 px/s, pausa inicial/final e retorno suave. Recalcular após trocar assunto, carregar fontes ou redimensionar.
- Manter um único texto no DOM, nome completo em aria-label/title e a ordem dos ícones atual. Redução de movimento mantém texto estático com reticências; celular preserva controles compactos.
- Parar a animação ao recolher o botão ou ocultar a página. Nenhuma nova dependência.

## Verificação e publicação

Verificar PT/EN/ES em 320, 390, 850, 1200, 1320/1321 e 1440 px, topo e após rolagem, drawer em altura pequena, teclado, destinos e igualdade das ações. Testar letreiro com texto longo/curto, troca, resize e redução de movimento, com API do YouTube simulada. Fazer uma rodada visual conjunta e no máximo uma confirmação após correções. Revisão independente e documentação de superfície pelo fluxo Impeccable; publicar e conferir workflow, hashes e comportamento em produção.
