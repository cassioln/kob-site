# Frota: compactação de meeples e retorno para espera

## Objetivo

Melhorar a leitura dos grupos nos cards da frota sem alterar a lógica de assentos, VIPs ou movimentação. Grupos com até 6 integrantes continuam usando meeples individuais maiores no desktop. A partir de 7 integrantes, a representação passa para uma linha compacta com contagens acompanhadas pelos próprios ícones de meeple grande e pequeno. No mobile, a compactação começa a partir de 4 integrantes.

Também será possível mover uma reserva comum de um ônibus para a seção “Sem ônibus confirmado”. O antigo select nativo será substituído por um menu expansível no card, com ícones e detalhes de vagas. Essa ação deve remover o `bus_number`, marcar a reserva como `waiting` e fazê-la aparecer na seção `#frota-sem-onibus` após o recarregamento dos dados.

As informações detalhadas do grupo serão acionadas exclusivamente por um ícone de informação ao lado do nome. O card não abrirá mais o tooltip inteiro ao passar o mouse em qualquer área.

Cards individuais, definidos como uma reserva com 1 pagante e nenhuma criança de colo, usarão meeple adulto azul. Grupos permanecem roxos, crianças magenta e VIPs dourados.

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

Os cards comuns usarão um menu expansível com opções visuais de destino. Cada ônibus terá ícone, vagas livres e foco acessível; a opção “Sem ônibus confirmado” terá ícone próprio e será omitida para VIPs. Ao selecioná-la, o handler chamará o mesmo fluxo de movimentação com `null` como destino. O select da seção de espera continuará oferecendo somente ônibus válidos.

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
