# Identificação do assunto na base da live

## Direção autorizada

O usuário pediu que o assunto fique logo acima dos controles, desça suavemente para ocupar sua área quando eles desaparecem e suba quando retornam. Pediu também o aviso editorial abaixo do assunto, dentro do vídeo, com acabamento semelhante à edição de TV. É um refinamento do desktop existente, com execução e publicação já autorizadas nesta conversa. O mobile conserva título nos controles externos e aviso antes do vídeo.

## Composição

Um único conjunto na base esquerda do vídeo reúne assunto e aviso. Gobold branco conserva a voz do Manual; uma faixa navy que se dissolve à direita protege a leitura sem criar outro cartão. O aviso usa Montserrat clara, separação horizontal fina, identificação dourada de regra atualizada e acesso existente ao guia. O conteúdo e as traduções dos avisos permanecem iguais.

O conjunto fica a 18 px da base quando os controles estão ocultos. Quando visíveis, sobe pela altura medida dos controles mais 12 px, deixando espaço entre aviso e painel. Ele acompanha o mesmo estado de classe, hover e foco dos controles. O aviso, quando presente, ocupa espaço abaixo do título dentro desse conjunto; nunca cobre o painel de controles.

## Movimento e comportamento

Continuidade: transição vertical de 340 ms com `cubic-bezier(.16,1,.3,1)`, somente em transform. O aviso aparece em 220 ms com opacity e deslocamento de 4 px. Não há animação de altura, margem, top ou bottom, nem novas dependências. ResizeObserver mede a altura dos controles ao carregar, redimensionar e entrar em fullscreen. O foco ou hover no botão do guia mantém o conjunto estável; ao sair, retoma o prazo de recolhimento de 3,2 s.

Movimento reduzido elimina o deslocamento animado, mantendo posição final e conteúdo. A falha da API conserva o player nativo e coloca a identificação acima de sua faixa de controles. Um único título e um único status editorial permanecem no DOM; o breakpoint move os elementos existentes.

## Pontos dos assuntos na linha total — instrução adicional

O usuário aprovou a aparência da barra geral e pediu pontos nos inícios de cada assunto, com nome ao passar o mouse e salto ao clicar. A linha e os tempos permanecem iguais; somente os pontos passam a ser interativos. Usar os 41 horários reais, tooltip localizada com horário/nome, clique por posição mais próxima quando alvos se sobrepõem e um único ponto no Tab, com setas/Home/End para alcançar os demais. Enter/Espaço acionam o ponto focado; Escape fecha o tooltip. O ponto atual fica identificado sem competir com o range vermelho. Duração real da API determina as posições. Pontos e tooltip acompanham a visibilidade dos controles e permanecem ausentes no mobile, junto da linha geral existente.

## Limites e verificação

PT, EN e ES devem preservar as 41 entradas da live, 42 FAQs e 25 itens do checklist. Home, ônibus, backend, imagens e textos factuais ficam fora do ajuste. Testar controles visíveis/ocultos/retornando, avisos presentes/ausentes, foco no guia, movimento reduzido, resize nos dois sentidos, fullscreen e API indisponível. Capturar desktop e mobile nos três idiomas numa rodada agrupada; vídeo simulado deve ser rotulado. Encerrar com revisão independente e atualização apenas do brief local do Manual.
