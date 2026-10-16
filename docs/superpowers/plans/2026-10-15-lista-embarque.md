# Lista de embarque — implementação

**Objetivo:** conferir presença por passageiro e trecho em um slider com a identidade do Checklist de Bordo, agrupando os VIPs por ônibus.
**Arquitetura:** módulo JS isolado, dialog nativo, API PHP autenticada e tabela aditiva MySQL 5.7.
**Restrições:** PHP 8.0; sem dependências de produção; sem SonarQube; presença fora do localStorage; interface em pt/en/es.

- [x] Criar tabela 009, bootstrap idempotente, API de leitura/gravação e validação de elegibilidade/revisão. Manter SQL manual e execução sem CREATE para tabela já provisionada.
- [x] Criar módulo de presença, dicionário e estilos próprios. Confirmar estado somente após resposta do servidor e sincronizar entre aparelhos.
- [x] Substituir a aba Embarque pelo slider automático, reutilizar a identidade visual do checklist e manter Reservas/Frota na tablist. Suportar fechar, reabrir, teclado e movimento reduzido.
- [x] Usar tabs Todos/Faltantes/A bordo com sublinhado, roving tabindex e navegação por setas, Home e End. Mover ônibus para um select à direita de Ida/Volta no cabeçalho. Manter atualizar/fechar em botões de ícone de 44 px lado a lado e Ida/Volta com setas e texto no cabeçalho fixo. Remover idioma/PDF do slider, mantendo localização por `?lang=pt`, `?lang=en` ou `?lang=es`.
- [x] Manter os dois progressos visíveis em Ida e Volta: base roxa da ida de 10 px e overlay verde da volta de 6 px, centralizado e delimitado por 1 px branco. Localizar legendas e progressbars em pt/en/es, com contagens independentes por ônibus e resumo do trecho ativo.
- [x] Reunir todos os VIPs do mesmo ônibus em um bloco, com códigos e presença individuais. Manter agrupamento das reservas comuns.
- [x] Validar 26 testes do painel, fontes e estrutura nos três idiomas, larguras 320/390/820/892/1440 e rolagem interna com resumo fixo.
- [x] Concluir suíte essencial: 140 testes de servidor, 8 de timing e 26 do painel passaram; o rerun final do painel levou 28,7 s. Sintaxe JS e `git diff --check` passaram. A falha transitória de carregamento foi identificada no servidor Python de testes e resolvida com fila 128, sem mudança de produção. As duas falhas de Manual na suíte geral também ocorreram no baseline `332cc77`.
- [x] Confirmar o último ajuste visual com um revisor fresco sobre as nove capturas renovadas em `.impeccable/review/boarding-controls/`: `disposition: ship`, sem correções materiais. A revisão anterior dos controles também foi `ship`; o falso positivo dos ícones pertence à revisão anterior do cabeçalho.
- [x] Documentar a extensão no README, na especificação, neste plano e no contrato da superfície, preservando o sistema global e o drift preexistente.
- [x] Preparar a revisão para o PR 79, mantendo a publicação em produção fora deste escopo.
