# Reservas VIP no painel e nas listas - Implementation Plan

> Status: implementação concluída no código e validada por testes locais. A
> confirmação contra a instância MySQL de produção e o clique real no navegador
> permanecem como validação de deploy, pois as credenciais do ambiente não estão
> disponíveis neste workspace.

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Permitir cadastrar, editar por movimentação manual e remover reservas VIP com dados completos, refletindo-as na frota, na aba Reservas, no XLSX e no PDF de embarque, sem permitir que a distribuição automática altere VIPs.

**Architecture:** As novas reservas VIP serão registros reais em `bus_registrations`, identificados por `is_vip = 1`, com um passageiro primário em `bus_passengers`. O cadastro será feito em lote por uma API transacional; cada formulário do modal representa um VIP. `bus_number = NULL` significa “Sem ônibus confirmado” e deixa o VIP visível na área de espera, mas fora do PDF. O mecanismo antigo de vagas VIP (`vip_seats`/`vip_assignments`) será mantido temporariamente para compatibilidade, porém não será misturado às reservas VIP com dados pessoais.

**Tech Stack:** PHP/MySQL, migrações SQL, JavaScript vanilla, HTML/CSS existentes do painel, XLSX gerado por `php/lib/xlsx.php` e PDF gerado por `php/lib/boarding-pdf.php`.

## Global Constraints

- O servidor é a fonte de verdade para `is_vip`, ônibus, capacidade e remoção; a validação do modal é apenas uma melhoria de interação.
- Cada VIP ocupa exatamente um assento, não possui grupo nem passageiros adicionais e não participa do auto-balanceamento.
- VIP pode ser movido manualmente pelos controles já existentes, inclusive para “Sem ônibus confirmado”, mas nunca pode ser movido pelo botão de distribuição automática.
- O cadastro em lote deve ser atômico: se um VIP inválido ou uma seleção exceder a capacidade, nenhum VIP daquele envio é criado.
- `Nome`, `CPF` e `Ônibus` são obrigatórios. WhatsApp e e-mail são opcionais e devem ser persistidos em branco quando não informados.
- O status interno continua compatível com a reserva confirmada, mas as interfaces devem expor VIP como `Reserva VIP`; não haverá pagamento Mercado Pago nem valor pago.
- Reservas sem ônibus definido não entram no manifesto PDF, mesmo quando o pagamento/status estiver confirmado.
- Os VIPs devem aparecer antes das reservas comuns dentro de cada ônibus no manifesto.
- A capacidade deve ter uma definição única: `assentos_ocupados = passageiros - crianças de colo`, com VIP real contando uma vez e VIP legado contando uma vez. A interface não pode exibir uma vaga livre quando a mesma vaga for considerada ocupada pela API.
- O recurso deve preservar os VIPs legados configurados por quantidade até que exista uma migração explícita com dados pessoais; eles não devem aparecer no filtro “Reservas VIP”, pois não possuem passageiro, CPF ou reserva real.
- Não adicionar dependências externas; reaproveitar validações, meeples, diálogos, componentes de cards e padrões de resposta existentes.

## Contratos de API

Adicionar:

- `POST api/bus-vip-create?token=...`
  - Corpo: `{ "vips": [{ "full_name": "...", "cpf": "...", "whatsapp": "...", "email": "...", "bus_number": 1 }] }`.
  - `bus_number` pode ser `null` para “Sem ônibus confirmado”.
  - Retorno de sucesso: `{ "success": true, "vips": [...] }`, usando o mesmo formato de reserva/código consumido pela frota.
- `POST api/bus-vip-delete?token=...`
  - Corpo: `{ "registration_id": "uuid" }`.
  - Só aceita registros com `is_vip = 1`; exclusão em transação, com cascata do passageiro.

## Plano de implementação

### 1. Persistência e validação comum

- [ ] Criar `php/db/005_add_vip_reservations.sql`, adicionando `is_vip TINYINT(1) NOT NULL DEFAULT 0` em `bus_registrations`, índices para consultas de VIP/status/ônibus e compatibilidade com instalações existentes.
- [ ] Criar a migração equivalente em `server/db/002_add_vip_reservations.sql` para manter o schema PostgreSQL alinhado ao contrato do sistema.
- [ ] Criar `php/lib/vip-reservations.php` com normalização de nome, CPF, WhatsApp e e-mail opcional, validação do número do ônibus e cálculo de ocupação por passageiros pagantes.
- [ ] Garantir que todas as consultas que retornam reserva incluam `is_vip`, com valor booleano consistente no JSON.
- [ ] Reutilizar as funções de `php/lib/validation.php`; não tornar WhatsApp/e-mail obrigatórios globalmente só por causa do VIP.

### 2. Cadastro e exclusão de VIPs no backend

- [ ] Criar `php/mysql/bus-vip-create.php` com autenticação pelo token usado no painel, validação completa do lote e transação MySQL.
- [ ] Para cada VIP, gerar `id`/código no padrão atual, criar `bus_registrations` com `is_vip = 1`, quantidade de passageiros igual a 1, crianças igual a 0, valor pago igual a zero e status administrativo confirmado.
- [ ] Criar o passageiro primário correspondente em `bus_passengers`, mantendo os campos opcionais vazios quando não fornecidos.
- [ ] Calcular a capacidade considerando reservas confirmadas, VIPs reais já cadastrados, vagas VIP legadas e os itens anteriores do próprio lote; rejeitar a operação inteira quando houver excesso.
- [ ] Gravar `fleet_assignment_status = assigned` quando houver ônibus e `waiting` quando `bus_number` for nulo.
- [ ] Criar `php/mysql/bus-vip-delete.php`, exigindo `is_vip = 1`, apagando o registro em transação e retornando erro claro para tentativa de remover reserva comum ou VIP legado.
- [ ] Adicionar testes de backend para: lote válido, campos obrigatórios, CPF inválido/duplicado, ônibus lotado, cadastro sem ônibus, rollback do lote e exclusão protegida.

### 3. Integração da frota e das regras de distribuição

- [ ] Auditar e unificar as fórmulas de capacidade usadas em `assets/js/painel-onibus.js`, `php/mysql/bus-admin-data.php`, `php/mysql/bus-fleet-assign.php` e `php/lib/bus-fleet.php`, distinguindo capacidade total, assentos ocupados, VIPs reservados e vagas livres.
- [ ] Corrigir a possível contagem dupla do VIP legado: a vaga configurada em `vip_seats` deve ser contabilizada uma única vez, sem somá-la novamente como passageiro virtual; VIP real com `is_vip = 1` também deve ocupar uma única vaga e não ser incluído na contagem legada.
- [ ] Fazer a API retornar os números usados para a tela (`capacidade`, `assentos_ocupados`, `vagas_livres`, `vagas_vip` e `assentos_de_colos`) e fazer o resumo, a planta e a mensagem de erro consumirem esses mesmos valores.
- [ ] Validar a movimentação dentro de uma transação usando o estado mais recente do ônibus destino, considerando o tamanho real do card (`passageiros - crianças de colo`) e informando no erro “X vagas livres, Y necessárias”; não rejeitar um card de uma pessoa quando existe uma vaga real.
- [ ] Adicionar regressões específicas para o cenário reportado: ônibus em `45/46` aceita mover uma reserva de uma pessoa; ônibus em `44/46` aceita mover um card de duas pessoas; `45/46` rejeita corretamente um card de duas pessoas; crianças de colo não consomem vaga; VIP não gera diferença entre a tela e a API.
- [ ] Atualizar `php/mysql/bus-admin-data.php` para retornar VIPs reais com nome, CPF, contatos, código, ônibus, `is_vip` e estado de espera; manter a injeção dos VIPs legados separada.
- [ ] Atualizar `php/mysql/bus-fleet-assign.php` para permitir movimentação manual de VIP real entre ônibus e “Sem ônibus confirmado”, sempre recalculando a capacidade sem contar crianças de colo como assento.
- [ ] Atualizar `php/lib/bus-fleet.php` para carregar `is_vip`, contabilizar o VIP na ocupação e excluí-lo dos candidatos de auto-balanceamento.
- [ ] Atualizar `php/mysql/bus-fleet-auto-balance.php` para rejeitar qualquer plano que tente mover ou remover VIP, mantendo a proteção também no servidor caso o cliente envie um plano indevido.
- [ ] Preservar o comportamento de grupos comuns: grupos permanecem juntos, VIP não é agrupado e a fila de espera continua priorizando a data de pagamento aprovado quando não houver ônibus suficiente.
- [ ] Adicionar testes de frota verificando que VIP permanece fixo no auto-balanceamento, pode ser movido manualmente, ocupa um assento e aparece na espera quando não possui ônibus.

### 4. Modal de cadastro no painel

- [ ] Alterar `painel-onibus.html` para substituir a edição numérica de vagas VIP por uma ação “Adicionar VIP” e um `<dialog>` de cadastro.
- [ ] Modelar cada formulário com `Nome *`, `CPF *`, `WhatsApp`, `E-mail` e `Ônibus *`; o select deve ser preenchido com os ônibus disponíveis e incluir “Sem ônibus confirmado”.
- [ ] Adicionar os comandos “Adicionar outro VIP”, que preserva os formulários já preenchidos, e “Confirmar reservas VIP”, que envia todos em um único lote; não incluir o checkbox “Vou sozinho”.
- [ ] Implementar em `assets/js/painel-onibus.js` o estado temporário dos formulários, máscaras/validações existentes, carregamento de capacidade atual, prevenção de duplo envio, tratamento de erro por campo e atualização da frota após sucesso.
- [ ] Adicionar em `assets/css/painel-onibus.css` o layout do modal e dos formulários repetidos, com foco visível, comportamento responsivo para mobile/tablet e indicação clara de ônibus sem vaga.
- [ ] Renderizar VIP real com o meeple dourado já usado na frota, nome/código e botão exclusivo de remoção com ícone “−”. O botão deve abrir o diálogo de confirmação reutilizado pelo painel e não aparecer em cards comuns.
- [ ] Após confirmar ou remover, recarregar o estado do painel em vez de apenas mutar a tela, evitando divergência de capacidade ou de dados.

### 5. Reservas, filtro e identidade visual VIP

- [ ] Em `painel-onibus.html`, adicionar ao grupo de filtros a opção `data-filtro="vip"` com o rótulo “Reservas VIP”.
- [ ] Em `assets/js/painel-onibus.js`, fazer o filtro VIP considerar apenas `is_vip = true`; garantir que “Todos” continue incluindo VIPs e que busca por nome, CPF e código funcione.
- [ ] Exibir o mesmo meeple dourado da frota na coluna Passageiro, alinhado verticalmente ao nome, sem repetir um meeple para cada pessoa.
- [ ] Exibir `Reserva VIP` na coluna Status, com tom dourado próprio e contraste suficiente, sem reutilizar as cores de pendente, confirmado ou falha.
- [ ] Aplicar uma classe de linha com fundo dourado claro para todas as linhas do bloco VIP e deixar vazias as colunas sem aplicação, especialmente pagamento, valor pago e transação.
- [ ] Garantir que a coluna Ônibus mostre o ônibus escolhido ou “Sem ônibus confirmado”, sem inserir o VIP na lista de embarque quando estiver sem ônibus.
- [ ] Reaproveitar o diálogo existente de alerta e ampliá-lo com modo de confirmação (`Cancelar`/`Remover VIP`), sem duplicar componentes de modal.

### 6. Exportação XLSX

- [ ] Atualizar `php/mysql/bus-admin-xlsx.php` para selecionar `is_vip` e aceitar o filtro `vip` sem tratá-lo como status de pagamento.
- [ ] Para VIP, preencher Reserva, Passageiro, CPF, faixa etária, WhatsApp, e-mail, ônibus e quantidade; deixar grupo, valor pago, pago em e transação em branco quando não aplicáveis.
- [ ] Escrever `Reserva VIP` na coluna Status e aplicar estilo de linha dourado claro, com texto legível.
- [ ] Garantir que o filtro “Todos” inclua VIP e que o filtro VIP exclua reservas comuns, inclusive quando status interno for `confirmed`.
- [ ] Adicionar teste/fixture de exportação verificando cabeçalhos, campos vazios, estilo VIP e presença de VIP sem ônibus no XLSX administrativo, sem incluí-lo no PDF.

### 7. Correção e evolução do PDF de embarque

- [ ] Atualizar `php/mysql/bus-manifest.php` para selecionar somente reservas confirmadas com `r.bus_number IS NOT NULL` e assignment efetivamente atribuído; eliminar o agrupamento “Sem Ônibus” do manifesto.
- [ ] Selecionar `is_vip`, transportar a informação para cada bloco de reserva e manter crianças de colo sem consumo de assento no resumo.
- [ ] Atualizar `php/lib/boarding-pdf.php` para ordenar VIPs primeiro dentro de cada ônibus e sinalizar visualmente o bloco como `RESERVA VIP`/`VIP`, preservando o layout atual.
- [ ] Diagnosticar o erro “Failed to load PDF document” capturando a resposta bruta do endpoint: confirmar HTTP 200, `Content-Type: application/pdf`, primeiros bytes `%PDF-1.4`, ausência de warnings/BOM antes do PDF e `%%EOF` ao final.
- [ ] Corrigir qualquer saída indevida, cabeçalho incorreto, exceção não tratada ou PDF malformado encontrado nessa verificação; respostas de erro devem continuar sendo JSON com status HTTP de erro, nunca JSON servido como PDF 200.
- [ ] Criar um teste da função de PDF com fixture contendo VIP, reserva comum e reserva sem ônibus, verificando assinatura/EOF, ordem VIP→comum e ausência do passageiro sem ônibus.

### 8. Verificação integrada

- [ ] Executar `php -l` em todos os PHP alterados e `node --check assets/js/painel-onibus.js`.
- [ ] Executar `git diff --check` e os testes existentes de frota/servidor, incluindo `php php/tests/bus-fleet-balance.test.php` e `npm run test:server` quando disponíveis.
- [ ] Validar manualmente no painel: abrir modal, adicionar um VIP, adicionar outro, confirmar ônibus diferentes, confirmar sem ônibus, filtrar Reservas VIP, copiar/visualizar cards e remover com confirmação.
- [ ] Validar capacidade em cenários de fronteira: 39/40 assentos, ônibus cheio, crianças de colo, grupo comum indivisível e VIP fixo no auto-balanceamento.
- [ ] Validar XLSX e PDF em dados reais/fixture, incluindo VIP no topo de cada ônibus e exclusão total dos passageiros sem ônibus.
- [ ] Revisar acessibilidade: labels associados, foco no modal, fechamento seguro, mensagens de erro anunciadas e operação sem depender apenas do mouse.

## Critérios de aceite

1. Um ou vários VIPs podem ser cadastrados pelo modal, com ônibus ou sem ônibus, e o lote só é confirmado quando todos os dados e capacidades forem válidos.
2. VIP real aparece na frota, na tabela, no filtro VIP e no XLSX; usa meeple dourado, status `Reserva VIP` e fundo dourado claro.
3. VIP nunca é deslocado pelo auto-balanceamento, mas pode ser movido ou removido manualmente após confirmação.
4. VIP sem ônibus aparece na área de espera e não aparece no PDF de embarque.
5. VIP com ônibus aparece antes das reservas comuns daquele ônibus no PDF.
6. O PDF baixado abre normalmente, sem o alerta de documento inválido, e erros de geração não são mascarados como arquivo PDF.
7. Reservas comuns, grupos, crianças de colo, vagas VIP legadas e fluxo atual de pagamento permanecem compatíveis.

## Riscos e esforço estimado

- Complexidade: alta, aproximadamente 3 a 5 blocos de implementação/teste, dependendo do estado dos ambientes MySQL/PostgreSQL e da origem do erro do PDF.
- Maior risco: coexistência entre VIP legado por quantidade e VIP real com dados pessoais. A separação proposta evita quebrar a frota atual, mas a migração dos VIPs legados exigirá dados que o sistema hoje não possui.
- Segundo maior risco: o PDF é gerado por código próprio; a correção precisa ser validada pelos bytes do arquivo, não apenas pelo clique no link.
- A implementação deve ser feita em incrementos, validando primeiro a persistência/frota, depois tabela/XLSX e por fim PDF, para reduzir o raio de regressão.
