# Lista de embarque — implementação

**Objetivo:** conferir presença por passageiro e trecho em um slider com a identidade do Checklist de Bordo, agrupando os VIPs por ônibus.
**Arquitetura:** módulo JS isolado, dialog nativo, API PHP autenticada e tabela aditiva MySQL 5.7.
**Restrições:** PHP 8.0; sem dependências de produção; sem SonarQube; presença fora do localStorage; interface em pt/en/es.

- [x] Criar tabela 009, bootstrap idempotente, API de leitura/gravação e validação de elegibilidade/revisão. Manter SQL manual e execução sem CREATE para tabela já provisionada.
- [x] Criar módulo de presença, dicionário e estilos próprios. Confirmar estado somente após resposta do servidor e sincronizar entre aparelhos.
- [x] Substituir a aba Embarque pelo slider automático, reutilizar a identidade visual do checklist e manter Reservas/Frota na tablist. Suportar fechar, reabrir, teclado e movimento reduzido.
- [x] Usar tabs para ônibus com sublinhado, contagens, roving tabindex e navegação por setas, Home e End. Manter atualizar/fechar em botões de ícone de 44 px lado a lado e Ida/Volta com setas e texto no cabeçalho fixo. Remover idioma/PDF do slider, mantendo localização por `?lang=pt`, `?lang=en` ou `?lang=es`.
- [x] Reunir todos os VIPs do mesmo ônibus em um bloco, com códigos e presença individuais. Manter agrupamento das reservas comuns.
- [x] Validar 25 testes do painel, fontes e estrutura nos três idiomas, larguras 320/390/820/1440 e rolagem interna com resumo fixo.
- [x] Concluir suíte essencial: 140 testes de servidor, 8 de timing e 25 do painel passaram. Sintaxe JS e `git diff --check` passaram. As duas falhas de Manual na suíte geral também ocorreram no baseline `332cc77`.
- [x] Concluir revisão visual independente com `disposition: ship`; encerrar como falso positivo o achado dos ícones no inglês a 320 px, confirmado por recapturas e recortes sem mudança da interface.
- [x] Documentar a extensão no README, na especificação, neste plano e no contrato da superfície, preservando o sistema global e o drift preexistente.
- [x] Entregar a revisão no PR 79, mantendo a publicação em produção separada.
