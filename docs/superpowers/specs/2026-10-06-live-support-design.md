# Apoios contextuais aprovados para a live

Aprovação do mantenedor em 06/10/2026: propostas 01, 02, 03, 05, 08, 09,
10, 15 e 18 do relatório de mapeamento. As outras 22 foram dispensadas.
Os textos de 02/03/18 e o destino de 18 seguem a correção expressa na resposta.

Usar o componente existente `liveChapterNotice`, com categoria `APOIO DA
LIVE` (PT), `LIVE HELP` (EN), `AYUDA EN LA CHARLA` (ES) e SVG de informação.
Cada fala mapeada inicia uma janela de 12 segundos do vídeo. Pausa preserva
a janela; retorno/avanço reavaliam o instante. Sem relógio da API, ocultar
apoios temporizados, como já ocorre com atualizações e convite ao grupo.

Se houver uma atualização vigente, conservar seu texto e acesso ao FAQ e
acrescentar o apoio no mesmo bloco. O apoio tem a ação principal; o FAQ da
atualização permanece como ação secundária. Se ambos apontarem ao mesmo
FAQ, exibir um único botão. Um apoio vencido desaparece e deixa a atualização
vigente visível. As escolhas do mantenedor sobre novos apoios não removem
correções anteriores.

Links externos abrem em nova aba somente por clique, com `noopener noreferrer`
e nome acessível informando a abertura. Encounter, mochila e deslocamento
da rodoviária usam o popover existente do FAQ, sem sair do vídeo.
Não carregar sites externos para desenhar um aviso. Não enviar mensagens
automaticamente. Ao remover um controle focado, devolver foco ao player.

Preservar a identidade clara/ciano do aviso e o roxo dos controles. Usar
animação curta de entrada já existente, sem loop, respeitando redução de
movimento. Desktop mantém o bloco abaixo do título; mobile mantém orientação
sobre o vídeo, com corpo rolável quando necessário para caber junto do
convite e do título. A reserva de espaço deve vir das dimensões reais desses
elementos, sem animar altura ou criar uma segunda caixa concorrente.

Acervo e predicado de tempo ficam em `manual-de-bordo-live-support.js`.
O controlador existente compõe os conteúdos só quando muda a combinação
atualização/apoio, preservando foco e popover durante os ticks da reprodução.
Testar antes/entrada/fim, seeks, coexistência, links, idiomas, fallback e
espaço em 320/390/850/1440 px.

O ajuste adicional do mantenedor para o convite ao WhatsApp usa fundo verde
`#087b41`, texto e marca brancos, e a mesma `--font-display` do assunto em
tamanho menor. Hover/foco escurecem o verde para `#066637`; foco mantém
contorno amarelo. Contraste branco/verde: 5,36:1 no estado normal e 7,09:1
no hover. No mobile, a tela do vídeo reserva ao menos 240 px de altura em
todos os estados; a rolagem se limita ao texto longo do aviso.
