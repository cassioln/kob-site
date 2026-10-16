# Chamada offline — plano de implementação

**Objetivo:** implementar o fluxo offline aprovado, preservando o MySQL como registro central.
**Arquitetura:** store IndexedDB transacional, coordenador de fila/revisões, integração no módulo existente e shell estático via service worker. Sem dependências de produção novas.
**Restrições:** pt/en/es; PHP 8/MySQL 5.7; sem SonarQube; cache mínimo sem CPF/token; sem cache de API; sem deploy automático.

## 1. Persistência e sincronização

- [x] Criar `assets/js/painel-embarque-store.js`: hash da chave, `read()`, `mutate(fn)`, `clear()`, lease e notificações entre abas. Snapshot mínimo, operações com ID estável, revisão/ônibus, estado de conflito. Concluir promessa somente após commit IndexedDB.
- [x] Criar `assets/js/painel-embarque-sync.js`: `start(token)`, `refresh()`, `toggle(id, leg)`, `resolve(id, action)`, `stop(clear)`, `snapshot()`. Salvar antes de enviar, reter falhas, reconciliar resposta perdida sem duplicação, bloquear conflitos. Serializar envio por lease. Não sobrescrever operação mais recente por resposta atrasada.
- [x] Integrar em `painel-embarque.js`, mantendo filtro/foco/trecho e exportações só de dados confirmados. Adicionar textos e controles acessíveis pt/en/es, contagem pendente e conflitos. Proteger logout com pendências e limpar cache ao sair.
- [x] Testar com Playwright cenários de durabilidade, desconexão real, revisão, duas abas, respostas perdidas e armazenamento falho. Adaptar expectativas anteriores de bloqueio offline para a fila explicitamente pendente.

## 2. Entrada offline instalável

- [x] Criar `embarque-sw.js`: precache atômico de lista explícita; fallback de navegação somente para painel; ignorar API/URLs com credenciais; separar versões sem misturar assets; atualização sem recarga forçada durante chamada.
- [x] Criar `assets/js/painel-embarque-offline.js` e manifestos pt/en/es. Controle Acesso offline com estado real de preparo, instruções e acesso a `?chamada=1`. Solicitar persistência quando preparar.
- [x] Alterar inicialização `painel-onibus.js` para modo chamada sem API financeira e recuperação de cache após erro de rede. Incluir assets com versão e MIME/cache do SW/manifest em `.htaccess`.
- [x] Testar service worker real e nova navegação offline, instalação/idioma, exclusão de API/CPF/token dos caches e estado sem primeira preparação.

## 3. Entrega

- [x] Rodar testes do painel e servidor pertinentes, lint PHP se houver alteração, sintaxe e diff. Conferir capturas agrupadas em 320/390/820/1440 px e pt/en/es, corrigir problemas reais numa rodada e confirmar.
- [x] Atualizar README/especificação/contrato com resultados e instruções operacionais. Entrega no PR 79 em rascunho, sem deploy. O workflow de testes será acionado manualmente no novo commit, pois rascunhos não o executam no evento de push.

Validação: 60 casos do painel/Frota em Chromium, 19 em WebKit, 150 do servidor e `npm run test:ci` integral (77 fluxos + oito casos de timing). Doze capturas sintéticas conferidas, sem overflow/erros JS, com anúncio acessível corrigido. Responsável no cabeçalho e meeple rosa de colo cobertos em pt/en/es.
