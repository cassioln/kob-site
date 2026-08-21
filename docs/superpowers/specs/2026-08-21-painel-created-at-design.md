# Exibir criação do pagamento no painel

## Contexto

A tabela de reservas do painel já recebe do backend a data de criação da reserva
(`criado_em`) e a data de aprovação (`pago_em`). Hoje a coluna **Pago em** mostra
apenas a aprovação, deixando pendências sem referência temporal útil.

## Objetivo

Exibir a data em que o checkout foi criado — momento em que o QR Code foi emitido
— abaixo da data de aprovação, sem alterar o significado ou o valor persistido
no banco.

## Comportamento

- A primeira linha da célula mantém a data de aprovação, quando existir.
- A segunda linha exibe `Criado em DD/MM/AAAA HH:MM`, usando `criado_em`.
- Para pagamentos pendentes, a primeira linha permanece `—` e a segunda linha
  continua exibindo a criação do checkout.
- Para reservas VIP, a coluna permanece vazia, pois não há QR Code de pagamento.
- As linhas secundárias usam fonte menor, cor discreta e não competem com a
  informação de aprovação.
- Reservas com criação ausente continuam exibindo somente a informação que
  estiver disponível, sem inventar datas.

## Escopo técnico

- Reutilizar o campo `criado_em` já disponibilizado por
  `php/mysql/bus-admin-data.php`.
- Montar a célula de forma semântica no frontend, separando a data principal da
  data secundária com classes próprias.
- Adicionar estilos locais em `assets/css/painel-onibus.css`, respeitando a
  hierarquia já usada na tabela e o comportamento responsivo.
- Não alterar schema, timestamps, reconciliação, filtros ou regras de pagamento.

## Validação

- Reserva aprovada mostra aprovação e criação em linhas separadas.
- Reserva pendente mostra `—` na aprovação e a data de criação abaixo.
- Reserva VIP não exibe uma data de pagamento inexistente.
- A tabela continua acessível em desktop e mobile, sem overflow ou quebra
  indevida.
- Os testes existentes do painel permanecem aprovados.
