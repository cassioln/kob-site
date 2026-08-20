# Frota: compactação de meeples e retorno para espera

## Objetivo

Melhorar a leitura dos grupos nos cards da frota sem alterar a lógica de assentos, VIPs ou movimentação. Grupos com até 3 integrantes continuam usando meeples individuais maiores. A partir de 4 integrantes, a representação passa para uma linha compacta, como `3 M + 1 m`, em que `M` representa pagantes e `m` representa crianças de colo.

Também será possível mover uma reserva comum de um ônibus para a seção “Sem ônibus confirmado”. Essa ação deve remover o `bus_number`, marcar a reserva como `waiting` e fazê-la aparecer na seção `#frota-sem-onibus` após o recarregamento dos dados.

## Limites

- VIPs continuam sem a opção de serem enviados para “Sem ônibus confirmado”.
- Crianças de colo permanecem visíveis na representação do grupo, mas não passam a ocupar assentos.
- O tooltip existente continua exibindo os nomes e a descrição completa do grupo.
- A opção de espera não redistribui automaticamente a reserva.

## Desenho técnico

### Frontend

Em `assets/js/painel-onibus.js`, a renderização dos meeples calculará o total de integrantes e escolherá entre duas apresentações:

- até 3 integrantes: SVGs individuais, com meeples adultos e infantis ampliados;
- 4 ou mais integrantes: spans compactos com os números e as letras `M`/`m`, sem quebra de linha.

O select dos cards comuns receberá uma opção visualmente separada chamada “Sem ônibus confirmado”. Ao selecioná-la, o handler chamará o mesmo fluxo de movimentação com `null` como destino. O select da seção de espera continuará oferecendo somente ônibus válidos.

### Backend

Em `php/mysql/bus-fleet-assign.php`, reservas reais com destino nulo serão atualizadas com:

```sql
SET bus_number = NULL, fleet_assignment_status = 'waiting'
```

Isso evita que `bus-admin-data.php` as autoaloque novamente na próxima leitura. Reservas reais movidas para um ônibus continuam com status `assigned`. O ramo VIP rejeitará destino nulo.

## Verificação

- `node --check assets/js/painel-onibus.js`
- `php -l php/mysql/bus-fleet-assign.php`
- `php -l php/mysql/bus-admin-data.php`
- `npm run test:server`
- `git diff --check`

