# Distribuição automática da Frota — Especificação

## Objetivo

Adicionar à aba Frota uma automação capaz de reorganizar grupos inteiros entre os ônibus para maximizar a quantidade de ônibus fechados com a meta mínima de 40 pessoas, respeitando capacidade de 46 pessoas, VIPs fixos e prioridade de pagamento aprovado.

## Regras de negócio aprovadas

1. VIPs são imutáveis para a automação. Um VIP permanece no ônibus definido manualmente e não pode ser deslocado pelo botão automático.
2. VIPs continuam contando para ocupação, capacidade e fechamento do ônibus.
3. Reservas são unidades indivisíveis. Todos os passageiros de um grupo permanecem juntos.
4. Nenhum ônibus pode terminar com mais de 46 pessoas.
5. O objetivo primário é maximizar o número de ônibus com pelo menos 40 pessoas.
6. Entre soluções com o mesmo número de ônibus fechados, a prioridade é preservar os grupos cujo pagamento foi aprovado primeiro, usando `paid_at` como ordenação.
7. Entre soluções ainda equivalentes, a automação escolhe a que exige menos movimentações.
8. Reservas confirmadas que não puderem entrar em um ônibus fechado passam para o estado persistente “Sem ônibus confirmado”.
9. O estado “Sem ônibus confirmado” não altera o pagamento, o valor, a data ou os dados pessoais da reserva.
10. Uma alocação manual posterior remove o estado “Sem ônibus confirmado”.
11. Um ônibus que terminar abaixo de 40 pessoas não mantém grupos comuns alocados; esses grupos passam para “Sem ônibus confirmado”. VIPs permanecem fixos mesmo quando, sozinhos, não são suficientes para fechar o ônibus.

## Estado persistente

O modelo atual usa `bus_number = NULL` para indicar reservas ainda não alocadas, mas a API de dados automaticamente atribui reservas confirmadas sem ônibus ao próximo veículo disponível. Isso impede a existência confiável de uma lista de espera operacional.

Será adicionada a coluna `fleet_assignment_status` em `bus_registrations`, com tipo `ENUM('assigned', 'waiting')`, valor padrão `assigned` e estado compatível para registros atuais:

- `assigned`: reserva participa normalmente da frota e possui `bus_number`.
- `waiting`: reserva confirmada, sem ônibus confirmado pela automação, com `bus_number = NULL`.

A rotina automática de alocação de novos pagamentos continuará atribuindo reservas novas normalmente. Ela não poderá sobrescrever reservas `waiting` criadas pela distribuição automática.

## Algoritmo

O algoritmo será executado no servidor e receberá o estado atual do banco dentro de uma transação de leitura.

### Entrada

- reservas com pagamento confirmado;
- tamanho inteiro de cada grupo (`passenger_count + children_count`);
- ônibus existentes e seus números;
- ocupação fixa de VIPs e seus ônibus em `vip_assignments`;
- capacidade máxima, atualmente 46;
- meta mínima, atualmente 40;
- data/hora de pagamento aprovado (`paid_at`);
- alocações atuais e estado `assigned` ou `waiting`.

### Decisão

O algoritmo considera VIPs como ocupação bloqueada e procura a melhor distribuição dos grupos não VIP. Cada grupo só pode permanecer no ônibus atual, ser transferido inteiro para outro ônibus fechado ou passar para “Sem ônibus confirmado”. Um ônibus candidato só pode reter grupos comuns se a ocupação final, incluindo VIPs, atingir pelo menos 40 pessoas.

A comparação entre planos segue ordem lexicográfica:

1. maior quantidade de ônibus com ocupação final maior ou igual a 40;
2. maior preservação da sequência de grupos por `paid_at` ascendente;
3. menor quantidade de grupos movimentados;
4. menor deslocamento numérico entre ônibus como desempate determinístico.

O resultado contém:

- ocupação final de cada ônibus;
- grupos a mover, com origem e destino;
- grupos que ficarão em `waiting`;
- quantidade final de ônibus fechados;
- assinatura da versão de dados utilizada no cálculo.

O algoritmo não cria nem remove ônibus automaticamente. A criação de um ônibus continua sendo uma ação manual do painel.

## Fluxo de prévia e aplicação

### Prévia

O botão **Otimizar distribuição** solicita uma simulação sem gravar alterações. A resposta exibe:

- quantidade atual e prevista de ônibus fechados;
- grupos que serão movidos, no formato “Ônibus X → Ônibus Y”;
- ocupação antes e depois de cada ônibus afetado;
- grupos que ficarão em **Sem ônibus confirmado**;
- aviso de que VIPs não serão movimentados;
- assinatura da versão calculada.

### Aplicação

O operador confirma em **Aplicar distribuição**. O servidor:

1. valida novamente o token administrativo;
2. abre uma transação;
3. bloqueia as reservas e configurações VIP envolvidas;
4. compara a assinatura recebida com o estado atual;
5. verifica status confirmado, integridade dos grupos, VIPs, capacidade e destinos;
6. atualiza os `bus_number` dos grupos movimentados;
7. marca como `waiting` os grupos fora da frota;
8. confirma a transação;
9. devolve o resultado final para o painel.

Se qualquer validação falhar, a transação é revertida integralmente e o painel pede uma nova prévia. Nenhum movimento parcial pode ser aplicado.

## Interface

### Botão

O botão aparece no cabeçalho da aba Frota como ação operacional principal secundária ao controle de VIPs:

- texto: **Otimizar distribuição**;
- estado padrão: habilitado quando houver dados;
- estado de cálculo: `Calculando…` e `aria-busy`;
- estado sem alteração: informa que a distribuição atual já é a melhor encontrada;
- estado de erro: preserva os dados e oferece nova tentativa.

### Prévia

A prévia será exibida em uma área do painel ou diálogo acessível, sem usar alertas nativos para conteúdo extenso. Ela terá as ações **Cancelar** e **Aplicar distribuição**.

### Sem ônibus confirmado

A aba Frota terá uma seção separada da lista de ônibus, com:

- quantidade de grupos aguardando;
- ordenação por pagamento aprovado mais antigo;
- identificação do grupo, quantidade de passageiros e data de pagamento;
- ação de alocação manual usando o fluxo existente;
- aviso de que o grupo continua confirmado e aguarda uma definição de ônibus.

## APIs e arquivos

- Criar `php/mysql/bus-fleet-auto-balance.php` para prévia e aplicação autenticadas.
- Estender `php/lib/bus-fleet.php` com o algoritmo e funções compartilhadas de capacidade, VIPs e grupos.
- Atualizar `php/mysql/bus-admin-data.php` para respeitar `waiting` e devolver a seção de grupos sem ônibus.
- Atualizar `php/mysql/bus-fleet-assign.php` para limpar `waiting` ao realizar uma alocação manual.
- Criar `php/db/004_add_fleet_assignment_status.sql` para o novo estado de alocação.
- Atualizar `painel-onibus.html` com o botão, a área de prévia e a seção de espera.
- Atualizar `assets/js/painel-onibus.js` com prévia, confirmação, aplicação e recarregamento.
- Atualizar `assets/css/painel-onibus.css` com os estados visuais da automação.

## Erros e concorrência

- Token inválido retorna acesso negado sem expor dados.
- Reserva não confirmada não pode ser incluída no plano.
- VIP alterado entre prévia e aplicação invalida o plano.
- Mudança manual ou novo pagamento entre prévia e aplicação invalida o plano.
- Falha no banco desfaz todas as alterações da execução.
- O painel informa o motivo da recusa e solicita nova simulação.
- O endpoint não altera status de pagamento, valores, datas ou passageiros.

## Critérios de aceitação

1. O botão gera uma prévia sem alterar o banco.
2. A aplicação só ocorre após confirmação explícita.
3. VIPs nunca são alterados pela automação.
4. Grupos nunca são divididos.
5. Nenhum ônibus ultrapassa 46 pessoas.
6. O algoritmo maximiza a quantidade de ônibus com pelo menos 40 pessoas dentro das regras definidas.
7. Empates preservam primeiro os pagamentos aprovados mais antigos.
8. Grupos fora da frota aparecem em `waiting`, ordenados por `paid_at` ascendente.
9. A alocação manual remove `waiting` e define o ônibus escolhido.
10. Uma prévia obsoleta não pode aplicar alterações.
11. Falhas não deixam movimentos parciais.
12. A aba continua funcional em desktop e mobile, sem overflow horizontal.
13. Testes cobrem VIP fixo, grupo indivisível, capacidade, prioridade temporal, lista de espera, concorrência e rollback.
