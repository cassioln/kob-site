# Manual: checklist lateral e navegação por assuntos

Pedido autorizado: implementar, testar e publicar seguindo a recomendação do agente durante a ausência do usuário.

## Direção
Preservar a identidade navy/roxo do Manual e o texto descontraído atualizado no HEAD a2a5519. O checklist será uma única lista no painel lateral, eliminando a seção preparação e sua duplicação. Preservar os 25 IDs de armazenamento, os estados conferido/pendente/não se aplica, filtros, orientação, reset e exportações. Links existentes para preparação passam a abrir o painel. O link compartilhado #checklist também abre o painel.

No desktop (>768px), controles sobrepostos na base do vídeo e assunto atual fixo no canto superior esquerdo; no mobile, ambos continuam fora do vídeo. Botões anterior/próximo/play revelam seus assuntos no hover/foco com expansão por grid, sem transição de width. Primeiro/último assunto desabilitam o controle sem destino. O progresso é relativo ao assunto, de seu início ao próximo timestamp, ou ao final real do vídeo. Reprodução contínua atravessa os assuntos e atualiza a duração automaticamente.

Avisos ficam acima do player. Consultar guia abre uma janela paralela por hover/foco/toque com a resposta atual do FAQ; não navega nem modifica filtros/scroll. Esc/fechar/outside dismiss e retorno de foco. O índice mostra circle-play no hover/foco com espaço reservado para evitar deslocamento.

Compartilhar aparece acima das quatro ações do checklist; remover a nota sobre 25 itens. Manter formatos próprios de copiar, email, WhatsApp e imprimir.

## Conteúdo e fontes
Transcrição fornecida e legendas automáticas originais pt-orig do vídeo AtIvlc62KgI. Acrescentar assuntos apenas com transição relevante e timestamp validado nas legendas, documentando a seleção. Preservar avisos e a prioridade das regras MSC já registradas no FAQ. Não substituir informações comerciais da home.

## Validação
Testes de cálculo de intervalo/seek, persistência/reset/N/A/25 exportados, navegação e tooltip sem mudança de URL, desktop/mobile/breakpoint e resize, mouse/teclado/toque, reduced motion, idiomas, falha da API, screenshots em rodada batelada. Revisar diff, publicar main com Actions, confirmar job e conteúdo servido em produção nas três rotas.
