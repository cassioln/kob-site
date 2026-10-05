# Legenda editorial da live

O usuário rejeitou a duplicação de faixas roxas e delegou a escolha visual do lower-third. Essa direção substitui as orientações visuais anteriores apenas para título, aviso e popover. A barra de controles roxa, conteúdo factual, traduções e comportamento continuam como estão.

## Direção escolhida

Uma composição de transmissão, luminosa e assimétrica: o título branco em Gobold ocupa uma faixa azul com gradação discreta, dimensionada pelo texto; um filete amarelo conecta o aviso claro com texto navy. A ação roxa à direita faz a ponte com os controles. O popover repete a superfície clara e a assinatura azul/amarela, com hierarquia editorial e fechamento legível. Sem novos rótulos, ilustrações ou dependências.

Foram consideradas uma legenda transparente com aviso flutuante, uma placa inteiramente clara e a composição azul/clara. A última mantém a leitura sobre qualquer cena, separa título de orientação e evita repetir a superfície roxa dos controles. A carta branca do usuário autoriza essa escolha sem outra rodada de aprovação.

## Primeiro quadro e interação

O vídeo continua dominante. A legenda tem largura máxima de 900 px, com título mais contido que o anterior e aviso de até 75 caracteres por linha. Mais detalhes permanece fora de role=status em uma coluna fixa à direita; no celular o aviso aparece antes do vídeo e a ação fica abaixo, à direita. A linguagem clara do popover se mantém nos três idiomas.

A troca antecipada do assunto é o momento de movimento: saída de 160 ms, intervalo de 2 segundos e revelação de 360 ms já concluída na fronteira do próximo assunto. Adicionar uma revelação vertical discreta por clip-path à animação existente, preservando cancelamento, pause, seek, fullscreen e redução de movimento. O grupo continua se deslocando suavemente quando os controles aparecem. Nenhum efeito contínuo decorativo.

A última orientação posiciona a aba Assuntos no centro da metade superior do vídeo (25% da altura). Limitar o centro à metade da altura da própria aba evita recortá-la em quadros pequenos. A gaveta deve recortar o painel sem se tornar uma área de rolagem horizontal; overflow:clip evita que navegação/foco traga de volta o painel já recolhido.

## Validação

Rodada conjunta desktop/mobile em PT/EN/ES, incluindo largura da captura do usuário, avisos longos/curtos, ausência de aviso, popover e teclado. Verificar contraste, overflow e separação dos controles. Executar os testes existentes da live com YouTube simulado. Revisão independente e documentação da superfície, sem alterar PRODUCT.md, DESIGN.md ou tokens globais. Publicar pelo workflow existente, conferir o SHA final e os arquivos públicos.
