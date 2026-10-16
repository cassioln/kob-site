# Lista de embarque — plano de implementação

**Objetivo:** conferir presença por passageiro e trecho no painel, com persistência MySQL.
**Arquitetura:** módulo JS isolado, API PHP autenticada e tabela aditiva MySQL 5.7.
**Restrições:** PHP 8.0; sem dependências de produção; sem SonarQube; presença fora do localStorage; nova interface em pt/en/es.

- [x] Criar `php/db/009_bus_boarding_checkins.sql`, `php/lib/bus-boarding.php`
  e `php/mysql/bus-boarding.php`. Validar corpo estritamente, bloquear reserva
  durante gravação, comparar revisão e responder com o estado persistido.
  Adicionar a rota em `.htaccess`. Testar payloads inválidos, elegibilidade,
  persistência, chamadas separadas e conflito entre duas revisões.
- [x] Criar `assets/js/painel-embarque-i18n.js`,
  `assets/js/painel-embarque.js` e `assets/css/painel-embarque.css`.
  Conectar início/fim de sessão no controlador existente. Mostrar contadores,
  agrupamento, busca, filtros, progresso e confirmação assíncrona por pessoa.
- [x] Inserir a primeira aba e painel padrão em `painel-onibus.html`, atualizar
  versões de cache e acessibilidade das abas. Manter funcionalidades anteriores.
- [x] Testar PHP, `npm run test:server` e suíte Playwright do painel. Inspecionar
  desktop, tablet e celular em uma rodada; corrigir problemas e confirmar em uma
  segunda rodada. Atualizar a documentação operacional com implantação e migração.

Validação concluída: 22 testes do painel; 140 testes do servidor e 41 fluxos essenciais em `npm run test:ci`; integração PHP/MySQL compatível em MariaDB10.11, incluindo bootstrap sem permissão CREATE; revisão independente com os dois ajustes resolvidos.
