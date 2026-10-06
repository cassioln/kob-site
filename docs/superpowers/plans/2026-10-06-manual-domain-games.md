# Publicação do manual: endereço oficial e jogos em slide

Solicitação autorizada pelo mantenedor: publicar as mudanças na main, padronizar o manual no subdomínio oficial e apresentar os cinco cards de Jogos em um slide horizontal.

- [x] Integrar a main preservando os avisos e apoios já validados.
- [x] Padronizar links, idiomas, metadados e redirecionamentos para `https://manualdebordo.kriativosonboard.com.br/`.
- [x] Converter os cards de Jogos em carrossel horizontal com setas, teclado e deslize nativo, sem reprodução automática, preservando o conteúdo em PT/EN/ES.
- [x] Validar regras Apache, navegação, compartilhamento e visualização mobile/desktop.
- [ ] Publicar por PR com checks obrigatórios, merge e deploy automático; verificar produção.

Critérios: URLs antigas preservam parâmetros e direcionam ao novo endereço sem loops; os cinco cards continuam acessíveis, inclusive sem JavaScript; os controles respeitam redução de movimento e não causam overflow da página.

Validação local em 2026-10-06: 38 testes Playwright, 11 testes Node e 34 casos de regras Apache passaram. Inspeção visual em seis capturas (PT/EN/ES, 390/1440px) e comparação do conteúdo dos cinco cards com o HEAD anterior: conteúdo e links preservados. O carrossel usa scroll-snap nativo, setas de 44px e teclado (←/→, Home/End), sem autoplay. A redução de movimento elimina a rolagem animada e o conteúdo permanece acessível sem JS.
