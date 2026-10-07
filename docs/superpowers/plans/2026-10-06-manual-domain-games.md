# Publicação do manual: endereço oficial e jogos em slide

Solicitação autorizada pelo mantenedor: publicar as mudanças na main, padronizar o manual no subdomínio oficial e apresentar os cinco cards de Jogos em um slide horizontal.

- [x] Integrar a main preservando os avisos e apoios já validados.
- [x] Padronizar links, idiomas, metadados e redirecionamentos para `https://manualdebordo.kriativosonboard.com.br/`.
- [x] Converter os cards de Jogos em carrossel horizontal com setas, teclado e deslize nativo, sem reprodução automática, preservando o conteúdo em PT/EN/ES.
- [x] Validar regras Apache, navegação, compartilhamento e visualização mobile/desktop.
- [x] Publicar por PR com checks obrigatórios, merge e deploy automático; verificar produção.

Critérios: URLs antigas preservam parâmetros e direcionam ao novo endereço sem loops; os cinco cards continuam acessíveis, inclusive sem JavaScript; os controles respeitam redução de movimento e não causam overflow da página.

Validação local em 2026-10-06: 38 testes Playwright, 11 testes Node e 34 casos de regras Apache passaram. Inspeção visual em seis capturas (PT/EN/ES, 390/1440px) e comparação do conteúdo dos cinco cards com o HEAD anterior: conteúdo e links preservados. O carrossel usa scroll-snap nativo, setas de 44px e teclado (←/→, Home/End), sem autoplay. A redução de movimento elimina a rolagem animada e o conteúdo permanece acessível sem JS.

Revisão após o primeiro CI: corrigida a sobreposição de ações e convite no mobile quando os rótulos traduzidos ocupam mais espaço. O vídeo reserva espaço conforme as alturas reais; as ações podem quebrar texto dentro da mesma linha e mantêm alvos de 44px. A pedido do mantenedor, o assunto usa 13,6–16px no mobile, o convite 12,8px e as ações 12px. Um teste cobre mudança das métricas de fonte após a exibição. O teste de cronograma passou a usar o baseURL do projeto, em vez da porta local 8085. Nove cenários direcionados passaram após a revisão.

Publicação concluída pelo [PR #30](https://github.com/cassioln/kob-site/pull/30), com 205 testes de navegador aprovados e um cenário previamente desativado. O [deploy FTP](https://github.com/cassioln/kob-site/actions/runs/37548503343) terminou com sucesso. Em produção, foram conferidos os três idiomas, 18 redirecionamentos com preservação de parâmetros, os links das homes e do Busão e os hashes dos sete arquivos CSS/JS alterados. Seis cenários reais de navegador (PT/EN/ES, 320/1440px) confirmaram setas, teclado e ausência de overflow; a fonte do assunto mede 13,6px no mobile de 320px e 34,56px no desktop de 1440px.
