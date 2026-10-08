# Idiomas no menu mobile do Manual e do Busão

Escopo: PT/EN/ES das duas páginas. Em telas até 767 px, mover o seletor existente para o drawer; em telas maiores, devolvê-lo ao cabeçalho. Preservar links, idioma ativo e seletor disponível sem JavaScript.

1. Reutilizar a navegação do Manual em um controlador compartilhado e adicionar ao Busão o menu mobile com seus links existentes.
2. Exibir idiomas em uma linha de botões com alvos de toque de 44 px. Manter foco no menu, fechamento por Escape/clique/ação e restauração de foco/inert/scroll.
3. Validar as duas páginas nos três idiomas, resize, teclado, navegação, fallback sem JS e fluxos do Busão. Conferir desktop/mobile em uma rodada visual; corrigir defeitos concretos e confirmar.

Na home, seguir o mesmo limite de primeira dobra usado pelo desktop (`data-scrolled`): no mobile/tablet até 1320 px, manter o seletor no header no início e movê-lo para o drawer depois. Reutilizar o seletor existente, devolver ao voltar ao topo e preservar os links de idioma e fechamento ao clicar.

Publicar após validação e CI, preservando as mudanças já presentes na main.

Complemento solicitado: somente no desktop da home após a rolagem (`data-scrolled="true"`), busca com 58 px de altura, igual às ações vizinhas. Largura de 176–200 px nas telas grandes, 140 px com lupa e texto nas intermediárias e 58×58 px somente com lupa quando o espaço diminui. Escopo dos estilos restrito à home; preservar tamanho da busca na primeira dobra.

Na primeira dobra, alinhar somente cores e hover da busca ao seletor de idioma: branco, borda clara e fundo translúcido no hover.

Validação local: 35 testes direcionados aprovados, cobrindo PT/EN/ES, teclado, resize, checklist, fluxo do Busão, cores/hover e cabeçalhos de 320 a 2560 px. Suíte essencial: 129 testes de servidor, 8 de timing e 27 de navegador aprovados. Busca conferida novamente após o último ajuste de cores. Nove páginas sem IDs duplicados; índice de busca regenerado sem diferenças. Conferência visual do Manual, Busão, home mobile e cabeçalho desktop concluída.
