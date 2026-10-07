# Checklist agrupado por categoria — plano de implementação

**Objetivo:** aplicar a opção 3 escolhida pelo mantenedor: a categoria identifica um grupo de tarefas dentro de cada seção do checklist, em vez de parecer o título de cada item.

**Arquitetura:** agrupamento estático nos HTMLs PT, EN e ES, sem novas dependências ou JavaScript de renderização. Cada seção conserva seu identificador e seu botão de recolher; os itens conservam IDs, textos, referências de orientação e atributos de estado. O CSS compartilhado implementa a composição aprovada.

**Tecnologias:** HTML, CSS e os módulos existentes de checklist; Playwright para a verificação das interações existentes.

## Decisão aprovada

- Referência visual: opção 3 apresentada em 07/10/2026, aprovada pelo usuário com “quero a opcao 3”.
- Ordem das categorias: essenciais, recomendados, se aplicável e opcionais; categorias vazias não aparecem.
- Cada categoria possui um cabeçalho discreto com o nome à esquerda e a quantidade total de itens à direita.
- Os 25 itens permanecem nas quatro seções temáticas. A ordem original é mantida dentro de cada categoria.
- Progresso, marcações persistentes, orientações por hover/toque/teclado e formatos de compartilhamento permanecem compatíveis.
- SonarQube permanece desativado conforme o AGENTS.md do projeto.

## Implementação

- [x] Nos três `manual-de-bordo.html`, substituir cada `ul#checklist-list-N` por um `div.checklist-group__categories` com o mesmo ID. O botão existente continuará controlando esse contêiner.
- [x] Inserir `section.checklist-category` para cada categoria presente, com `aria-labelledby`, `h4.checklist-category__heading` e uma lista de itens. Remover as tags repetidas e seus cabeçalhos vazios, mantendo as referências usadas pelo tooltip.
- [x] Em `assets/css/manual-de-bordo.css`, recolher também os cabeçalhos junto das listas e aplicar os espaços, os fundos discretos e a hierarquia aprovados; texto da tarefa com peso 500 e espaço reservado ao ícone de informação.
- [x] Traduzir títulos e quantidades em PT/EN/ES; preservar singular/plural e paridade dos IDs.
- [x] Atualizar o teste existente de checklist para garantir que recolher uma seção oculta seus novos cabeçalhos e que a aba reabre essa seção. Executar a suíte direcionada de checklist, verificar texto/IDs contra a base e capturar desktop/mobile nos três idiomas em uma rodada.
- [x] Atualizar a versão do CSS nos três HTMLs, registrar a direção no brief do Manual e revisar o diff.

## Aceitação

Uma categoria é apresentada uma vez por conjunto de tarefas. A marcação é persistida pelos mesmos IDs; a navegação, os tooltips e as quatro opções de compartilhamento continuam disponíveis. Todas as categorias recolhem junto da seção. A implementação deve corresponder à composição aprovada em telas de 320/390 px e no painel de 460 px do desktop.

## Evidência e entrega

Os 14 testes direcionados de checklist passaram em 25,4 s, incluindo persistência, orientação por mouse/teclado/toque, compartilhamento, impressão e recolhimento. A comparação semântica com a base confirmou textos, IDs, inputs, referências e seções idênticos para os 25 itens em cada idioma. Há dez categorias não vazias por idioma. As nove capturas PT/EN/ES × 320/390/1440 px não apresentaram overflow horizontal. A inspeção visual não exigiu correções adicionais.

As capturas estão em `/Users/cassio/.codex/visualizations/2026/10/07/kob-checklist-approved/`. O CSS usa a versão `20261007-checklist-categories`. O resultado de CI, merge e deploy será registrado no PR de entrega; a publicação segue o fluxo normal já autorizado pelo mantenedor.
