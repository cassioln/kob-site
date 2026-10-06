# Avisos sincronizados às falas da live

Branch: `code-ia/live-notice-transcript-timing`, baseada em
`feat/manual-faq-nav-sticky-scrollspy` (`8e4e391`).

Cada um dos 23 avisos existentes recebe um instante absoluto `noticeSeconds`,
obtido das legendas originais pt-orig do YouTube e conferido com a transcrição
fornecida. Não utilizar atraso fixo ou estimativa proporcional à duração.
Registrar os tempos e as falas de referência em relatório separado.

O aviso aparece ao atingir esse instante e termina na fronteira do próximo
assunto. Voltar a um ponto anterior oculta o aviso; avançar para depois da
fala mostra o aviso vigente. Pausa, velocidade de reprodução, seleção
manual e troca de layout usam o tempo informado pelo player. A transição
antecipada do título permanece; ela não antecipa o aviso do assunto seguinte.
No desktop, mantém-se o recolhimento visual do aviso durante a saída do
título anterior, como já ocorre na base desta branch.

Sem sincronização pela API, ocultar avisos temporizados no vídeo. A busca e
as respostas do guia continuam exibindo as atualizações de forma contextual.

Manter cores e disposição atuais. Trocar o prefixo por um SVG de atenção
decorativo e `ATUALIZAÇÃO` (PT), `UPDATE` (EN), `ACTUALIZACIÓN` (ES).
Manter o recolhimento do aviso no mobile e a preferência ao trocar de assunto.
Animação de entrada existente, respeitando redução de movimento.

Critérios de aceite: tempos rastreáveis, aviso ausente antes da fala e
presente depois, retorno/avanço corretos, encerramento no próximo assunto,
paridade de idiomas, busca e detalhes acessíveis, testes de regressão passando.

## Convite contextual ao WhatsApp

Inclusão solicitada durante a implementação: identificar apenas menções ao
grupo de mensagens do evento, excluindo grupos de pessoas e WhatsApp como
atendimento privado ou aplicativo genérico. Foram mapeadas 17 menções.

Texto PT: “Clique aqui para entrar no grupo”. Usar SVG da marca e o convite
fornecido pelo mantenedor. Exibir por 12 segundos de tempo do vídeo, juntando
janelas sobrepostas; desktop no alto à esquerda, mobile logo acima do
título do assunto. Entrada por revelação horizontal de 420 ms, sem loop.
Redução de movimento mantém o convite estático. Link em nova aba, somente
por ação do visitante. Não carregar o WhatsApp antecipadamente.

Pausa preserva a janela; seeks reavaliam a entrada/saída; ausência da API
oculta o convite temporizado. Manter o destino idêntico em PT/EN/ES.
