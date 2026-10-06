# Mapeamento dos avisos e convite ao grupo da live

Data: 2026-10-06. Base: `feat/manual-faq-nav-sticky-scrollspy` (`8e4e391`).

Fonte principal: transcrição anexada pelo mantenedor. Para localizar cada fala dentro dos blocos, foram consultadas as legendas automáticas originais `pt-orig` da [gravação no YouTube](https://www.youtube.com/watch?v=AtIvlc62KgI), obtidas em 2026-10-06. Apenas o texto temporizado foi consultado, sem baixar áudio ou vídeo.

Os instantes abaixo são inícios de cues de legenda, com precisão de milissegundos do arquivo de origem. Essa precisão numérica não implica alinhamento acústico perfeito: legendas automáticas podem conter erros. Não são atrasos interpolados. O controlador consulta o relógio do player a cada 250 ms durante a reprodução; a transição visual dura 260 ms e é reduzida conforme a preferência de movimento.

O aviso entra no instante da fala de referência e sua vigência termina na fronteira do próximo assunto. No desktop, o tratamento visual já existente recolhe o aviso durante a saída antecipada do título, evitando associar a atualização anterior à legenda seguinte. Os textos editoriais vigentes e as regras oficiais da MSC são preservados; não são apresentados como falas da gravação. Voltar antes do instante oculta o aviso; avançar depois dele exibe o aviso vigente. Sem relógio da API, os avisos do vídeo ficam ocultos, mas a busca e o guia continuam disponíveis.

## Atualizações

| Assunto | Início do assunto | Entrada do aviso | Fim do aviso (exclusivo) | Referência na fala |
|---|---|---|---|---|
| Documentos e autorização para menores | 00:20:50.000 | 00:21:58.440 | 00:22:25.000 | Menores desacompanhados dos pais e autorização |
| Chegada ao porto e senha de embarque | 00:25:02.000 | 00:25:25.080 | 00:25:35.000 | Orientação para desconsiderar o horário do voucher |
| Fretado e confirmação do seu ônibus | 00:25:35.000 | 00:26:03.080 | 00:28:22.000 | Flexibilização do horário do segundo ônibus |
| Aeroportos e chegada a Santos | 00:28:22.000 | 00:28:36.240 | 00:29:25.000 | Estimativa de três horas desde Campinas |
| Cruise Card, cartões e gastos a bordo | 00:30:52.000 | 00:31:00.159 | 00:32:43.000 | Aceitação de cartões internacionais |
| Buffet e liberação das cabines | 00:32:43.000 | 00:32:57.279 | 00:34:01.000 | Cabines ainda fechadas e liberação a partir das 13h |
| Encontro, kits e mural de programação | 00:34:01.000 | 00:34:03.200 | 00:36:01.000 | Sala Cristal inicialmente prevista |
| Gestantes | 00:37:56.000 | 00:38:22.680 | 00:38:59.000 | Limite de gestação anunciado em meses |
| Bebês na reserva | 00:38:59.000 | 00:39:16.040 | 00:39:28.000 | Taxas para bebês e tarifa a partir de dois anos |
| Água, chá, café e sistema Aqua | 00:39:28.000 | 00:39:37.680 | 00:40:23.000 | Apresentação do sistema de sustentabilidade Aqua |
| Pacotes de bebidas | 00:40:23.000 | 00:41:11.200 | 00:42:24.000 | Limite de 15 bebidas por dia e por pessoa |
| Bebidas avulsas e contratação antecipada | 00:42:24.000 | 00:42:49.319 | 00:44:14.000 | Preço anunciado do Easy |
| Internet: pacotes e contratação | 00:44:14.000 | 00:44:24.680 | 00:45:15.000 | Preço variável dos pacotes de internet |
| Internet por aparelho e sinal em Búzios | 00:45:15.000 | 00:45:32.720 | 00:48:14.000 | Sinal móvel enquanto o navio está em Búzios |
| Restaurantes e turnos do jantar | 00:48:14.000 | 00:48:17.480 | 00:49:56.000 | Restaurante e turno do jantar registrados no cartão |
| Horário e tolerância no jantar | 00:51:34.000 | 00:51:38.119 | 00:52:34.000 | Turnos citados de 19h15 ou 21h30 |
| Tema Anos 80 e encerramento | 00:53:33.000 | 00:54:31.880 | 00:58:26.000 | Proposta de estilo Anos 80 |
| Restaurantes de especialidades | 00:58:26.000 | 00:59:09.880 | 01:02:46.000 | Restaurantes previstos na chegada do MSC Musica |
| MSC for Me e chat interno | 01:02:46.000 | 01:02:57.440 | 01:03:34.000 | Chat gratuito de passageiros |
| Seguro e despesas médicas | 01:11:05.000 | 01:11:47.239 | 01:13:09.000 | Preço do seguro e cobertura de 40 mil sem moeda clara |
| Crianças e clubinho | 01:13:09.000 | 01:13:28.960 | 01:14:16.000 | Condição de desfralde para ficar no clubinho |
| Bagagem | 01:14:16.000 | 01:14:21.800 | 01:14:41.000 | Franquia anunciada de três malas e 90 kg |
| Itens permitidos e proibidos na mala | 01:14:41.000 | 01:14:42.239 | 01:15:09.000 | Proibição anunciada de ferro e chapinha |

Rótulo visual: SVG de atenção decorativo + **ATUALIZAÇÃO** (PT), **UPDATE** (EN), **ACTUALIZACIÓN** (ES), também nos resultados de busca. O aviso recolhido do mobile mantém sua preferência entre assuntos. A antecipação da legenda do próximo assunto não antecipa seu aviso.

## Convite ao grupo do WhatsApp

Texto PT: **Clique aqui para entrar no grupo**. Destino: [grupo oficial do evento](https://chat.whatsapp.com/EiYEGnOpJrPGyhDzdz9888?mode=gi_t). Abre em nova aba por ação do visitante.

Desktop: canto superior esquerdo do vídeo. Mobile: imediatamente acima do nome do assunto. Entrada curta com marca do WhatsApp; redução de movimento remove a animação. Cada menção inicia uma janela de 12 segundos do vídeo. Menções próximas prolongam a mesma exibição, evitando piscar ou reiniciar a animação durante a fala. Pausar mantém a janela; seeks reavaliam o instante. Sem relógio da API, não mostrar convites temporizados.

| Entrada | Contexto que identifica o grupo do WhatsApp |
|---|---|
| 00:22:36.159 | Liberação de vouchers comunicada no grupo |
| 00:26:32.000 | Formalização de horários do fretado |
| 00:27:53.120 | Publicação da listagem dos ônibus |
| 00:34:30.359 | Aviso sobre eventual mudança da sala |
| 00:35:21.040 | Confirmação de sala e horário no grupo do WhatsApp |
| 00:36:32.640 | Pergunta da Ju no grupo sobre roupas |
| 00:53:31.680 | Perguntas no grupo sobre festa à fantasia |
| 01:02:43.920 | Bloqueio temporário das mensagens para transmitir avisos |
| 01:16:02.760 | Dúvidas e principais pontos serão respondidos no grupo |
| 01:18:32.719 | Novidades da semana anunciadas no grupo |
| 01:18:51.320 | Link dos modelos de camisetas será enviado no grupo |
| 01:19:07.639 | Recados finais e comunicação posterior no grupo |
| 01:19:16.920 | Canal de dúvidas no WhatsApp no contexto do grupo |
| 01:19:22.880 | Inclusão de parentes da cabine |
| 01:19:25.480 | Inclusão dos amigos da cabine |
| 01:19:29.400 | Inclusão de todos para facilitar a comunicação |
| 01:19:46.239 | Importância do grupo antes e durante a viagem |

Exclusões deliberadas: WhatsApp como atendimento privado do Júnior (15:14), aplicativo incluído no pacote de internet (44:42) ou comparação com o chat MSC (63:22/63:30); grupo como comunidade presente no navio (46:53/49:43/71:00) ou conjunto de cabines para jantar (50:24). Essas ocorrências não indicam convite ao grupo de mensagens.

Arquivo de legenda consultado: `AtIvlc62KgI.pt-orig.json3`.
SHA-256 da fonte temporizada: `38df665ad6579e206e3c5474a84c53781d252f9c4eaddbe92e5340548c0b8f04`.

## Validação e estado da entrega

- Cinco testes Node de limites temporais, retorno/avanço e menções excluídas: aprovados.
- 55 testes Playwright da live, incluindo os 23 avisos em desktop/mobile, PT/EN/ES, falha da API, foco, redução de movimento e convite por clique: aprovados. A API foi simulada para avaliar os instantes determinísticos; isso não confirma alinhamento acústico perfeito nem testa a disponibilidade do grupo no WhatsApp.
- Capturas em 320, 390, 850 e 1440 px nas três línguas: sem erros de JavaScript ou transbordamento horizontal; convite e aviso cabem juntos. Em telas até 380 px, o vídeo reserva altura estável de 240 px para evitar sobreposição.
- `git diff --check`: aprovado.

Implementação na branch `code-ia/live-notice-transcript-timing`; sem merge ou deploy desta branch. A nova categoria de apoio é somente um [mapeamento para aprovação individual](2026-10-06-apoio-live-propostas.md), ainda sem implementação.

SonarQube desativado somente neste projeto, conforme solicitação do mantenedor: instrução local em `AGENTS.md`, MCP local desabilitado e exceção de caminho no hook global. Verificado `enabled: false` no projeto e `enabled: true` fora dele; outros projetos conservam a integração.
