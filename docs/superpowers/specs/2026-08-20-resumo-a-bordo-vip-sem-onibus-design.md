# Resumo de passageiros a bordo e saída manual de VIP para fila

## Contexto

O teste real de pagamento confirmou a reserva e o VIP corretamente, mas revelou uma inconsistência no resumo da aba Reservas: a Frota e o manifesto contabilizam dois assentos ocupados, enquanto o indicador `A bordo` recebe `0`. A investigação também mostrou que o endpoint de alocação já suporta retirar uma reserva VIP real do ônibus com `bus_number: null`, porém o frontend só oferece essa ação para reservas comuns.

## Objetivos

- Corrigir o cálculo de `total_a_bordo` no backend para refletir passageiros confirmados.
- Exibir no menu `Mover` dos VIPs reais a opção `Sem ônibus confirmado`.
- Manter a opção de fila de espera das reservas comuns com o texto atual.
- Preservar a regra de que VIP só é deslocado por ação manual.

## Design aprovado

### Cálculo do resumo

O cálculo será corrigido na origem, em `php/mysql/bus-admin-data.php`. Durante a passagem que processa reservas com status traduzido como pago/confirmado, o backend somará:

```php
$resumo['total_a_bordo'] += (int) $r['passenger_count'] + (int) $r['children_count'];
```

Assim, o indicador usa a mesma fonte de verdade das reservas confirmadas e permanece consistente com o manifesto. Crianças de colo entram no total de pessoas, mas não ocupam assento físico; a métrica de assentos da Frota continua usando `bus_fleet_seat_count()`.

### Menu de movimentação

Em `assets/js/painel-onibus.js`, a opção `Sem ônibus confirmado` será adicionada tanto para reservas comuns quanto para VIPs reais. Para VIPs, o item não exibirá subtítulo. Para reservas comuns, continuará exibindo `Enviar para a fila de espera`.

O clique continuará chamando `moverParaOnibus(r.id, null)`, que envia `bus_number: null` ao endpoint já existente. O backend seguirá protegendo VIPs legados virtuais (`vip_1`, `vip_2`, etc.), sem alterar essa compatibilidade.

### Acessibilidade e comportamento

- O item continuará sendo um botão com `role="option"` dentro do `listbox` existente.
- A ação fechará o menu antes de iniciar a requisição.
- Em falha da API, o modal de erro atual continuará sendo usado.
- Depois do sucesso, o painel será recarregado para atualizar o card do ônibus e a seção sem ônibus confirmado.

## Validação

- Teste Playwright com uma reserva VIP realista verificará a presença da opção sem subtítulo e o POST com `bus_number: null`.
- Teste Playwright existente de painel vazio continuará passando.
- `node --check` será executado no JavaScript.
- Testes PHP existentes de frota e testes de analytics serão executados conforme o tempo disponível.
- O diff será revisado para confirmar ausência de mudanças em pagamento, autenticação ou regras de capacidade.

## Fora de escopo

- Não alterar o fluxo de pagamento, webhook ou envio de e-mails.
- Não alterar a alocação automática de VIPs.
- Não remover nem migrar compatibilidade com VIPs legados.
