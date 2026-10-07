# CI essencial

Solicitação do mantenedor: simplificar o CI após a publicação do manual, mantendo somente o básico que importa.

- Preservar o check obrigatório atual, sem mudar a proteção da main.
- Rodar os testes rápidos de servidor, a validação do contrato de analytics e os testes puros de tempos da live.
- Reaproveitar onze testes de navegador com a tag `@smoke`: duas páginas traduzidas, geração e confirmação do Pix, persistência do checklist e avisos/convite no mobile, controles da live, carrossel mobile, dois redirects de WhatsApp e recusa do consentimento.
- Manter a suíte completa acessível por `npm test` e `npm run test:analytics`.
- Usar dois workers, cache do Chromium, nenhum vídeo/trace no CI e capturas somente nas falhas por três dias.
- Não executar deploy para mudanças exclusivas em CI, testes ou documentação.

Validar a seleção local e o workflow por PR; publicar esta simplificação depois do deploy do manual. O check deve continuar se concluindo para qualquer PR, inclusive de documentação, para evitar PRs bloqueados por um workflow ignorado.

Validação local: contrato de analytics válido, 64 testes de servidor, sete testes puros de tempos da live e onze testes de navegador passaram. A etapa de navegador levou 24,4 segundos na máquina local; a seleção final acrescenta o cenário que protege a separação dos avisos e do convite no mobile, em lugar da contagem estrutural; a duração no GitHub será conferida no PR.

Validação no [PR #31](https://github.com/cassioln/kob-site/pull/31): o [check obrigatório](https://github.com/cassioln/kob-site/actions/runs/37549767718) passou em 1 minuto e 1 segundo, incluindo instalação e preparação do runner. Os onze cenários de navegador passaram em 25,9 segundos; os 64 testes de servidor, os sete de tempos e o contrato também passaram.
