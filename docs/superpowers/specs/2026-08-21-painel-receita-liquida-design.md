# Exibir receita líquida no painel

## Contexto

O resumo da aba de reservas informa o total bruto recebido e um card separado
conta passageiros sem telefone. Para a operação financeira, o indicador mais
útil nesse espaço é o valor efetivamente creditado após a taxa de 0,99% do
Mercado Pago.

## Objetivo

Substituir o card **Sem telefone** por **Total líquido**, sem alterar a
arrecadação bruta, as reservas ou o histórico de pagamentos.

## Comportamento

- O card mostra a soma líquida de todas as reservas com pagamento aprovado.
- Cada reserva calcula a taxa individualmente: `round(valor_em_centavos × 0,99%)`.
  O líquido é o valor da reserva menos essa taxa; só então os líquidos são
  somados. Isso reproduz o arredondamento que aparece em cada crédito do
  Mercado Pago, como R$ 240,00 → R$ 237,62.
- O rótulo principal é **Total líquido**.
- A informação secundária é discreta: **Taxa Mercado Pago 0,99%**.
- Reservas VIP, pendentes, canceladas, falhas e estornadas não entram no total.
- O total bruto existente (**Total recebido**) permanece disponível como
  contraponto financeiro.

## Escopo técnico

- Calcular e devolver `receita_liquida_centavos` e sua versão formatada no
  resumo de `php/mysql/bus-admin-data.php`.
- Trocar apenas o conteúdo do quarto card em `painel-onibus.html`.
- Atualizar o renderizador de resumo em `assets/js/painel-onibus.js`, com
  fallback seguro para respostas antigas da API.
- Cobrir o cálculo e a apresentação em teste de painel.
- Não introduzir taxas configuráveis, integrações adicionais ou mudanças no
  schema nesta entrega.

## Validação

- Duas reservas de R$ 240,00 exibem R$ 475,24 líquidos, e não R$ 475,25.
- Reservas não aprovadas não alteram o total.
- A taxa aparece como nota secundária e o card continua legível no mobile.
- A suíte da aba de reservas permanece aprovada.
