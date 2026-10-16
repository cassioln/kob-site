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
- [x] Mostrar dois checks por pessoa, Ida roxa e Volta verde, em botões de 60 × 80 px com glyph de 40 px e rótulos visíveis. Desabilitar/esmaecer o trecho inativo; permitir alternar o ativo pelo check ou pela linha, sem gravação duplicada. Preservar o trecho original ao trocar o menu durante uma gravação e anunciar pessoa/trecho em pt/en/es.
- [x] Ampliar o select de ônibus até 560 px para texto de 16 px e altura mínima de 64 px, à direita de Ida/Volta, mantendo desktop em 13 px/52 px e cabeçalho compacto até 374 px.
- [x] Corrigir o rótulo de Volta para #066b53, com contraste de 5,55:1 no foco #e2f1e7, mantendo glyph/barra em #087e62. Contraste pontuado como resolvido na revisão focada.
- [x] Validar 28 testes do painel, fontes e estrutura nos três idiomas, larguras 320/390/820/892/1440 e rolagem interna com resumo fixo. O rerun final levou 29,2 s; `node --check` e `git diff --check` passaram.
- [x] Preservar o resultado da suíte anterior: 140 testes de servidor e 8 de timing aprovados. A falha transitória de carregamento foi identificada no servidor Python de testes e resolvida com fila 128, sem mudança de produção. As duas falhas de Manual na suíte geral também ocorreram no baseline `332cc77`.
- [x] Confirmar o último ajuste visual com um revisor fresco sobre as nove capturas renovadas em `.impeccable/review/boarding-controls/`: `disposition: ship`, sem correções materiais. A revisão anterior dos controles também foi `ship`; o falso positivo dos ícones pertence à revisão anterior do cabeçalho.
- [x] Confirmar o rótulo compacto espanhol “Todos” até 374 px, com nome acessível e `title` completos, por recaptura e veredito focado: último item pontuado como resolvido, `disposition: ship` nesse escopo. As onze capturas desta extensão, recortes de pessoa/cabeçalho/resumo e foco estão em `.impeccable/review/boarding-dual-checks/`.
- [x] Documentar a extensão no README, na especificação, neste plano e no contrato da superfície, preservando o sistema global e o drift preexistente.
- [x] Preparar a revisão para o PR 79, mantendo a publicação em produção fora deste escopo.
