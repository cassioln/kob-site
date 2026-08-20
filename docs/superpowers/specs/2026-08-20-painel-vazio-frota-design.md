# Painel acessível sem reservas

## Contexto

O painel autentica corretamente, mas `assets/js/painel-onibus.js` interrompe o
fluxo depois de carregar uma resposta vazia da API. Quando `reservas` é um array
vazio, o código mostra o estado global “Nenhuma reserva ainda” e retorna antes de
exibir `#painel-dados`, onde ficam as abas e o Planejamento de Frota.

## Objetivo

Permitir que uma pessoa autenticada acesse o painel e configure a Frota mesmo
quando ainda não há reservas cadastradas.

## Desenho aprovado

- A autenticação e a rejeição de chave inválida permanecem inalteradas.
- Uma resposta válida com zero reservas passa a exibir sempre `#painel-dados`.
- A mensagem “Nenhuma reserva ainda” continua visível como estado vazio da área
  de Reservas, sem esconder o restante do painel.
- `renderizarResumo`, `renderizar` e `renderizarFrota` continuam sendo chamados
  com os dados vazios, permitindo que a Frota seja aberta e configurada.
- O comportamento atual para reservas existentes e para erros da API permanece
  igual.

## Fluxo

1. O usuário informa uma chave válida.
2. A API retorna `reservas: []` e a configuração atual da Frota.
3. O painel mostra as abas, os indicadores zerados e o estado vazio de Reservas.
4. Ao selecionar “Planejamento de Frota”, a interface exibe os ônibus mesmo sem
   grupos alocados.

## Acessibilidade e estados de erro

- O estado vazio continua com texto explicativo e região anunciável.
- Chave inválida continua retornando o formulário de acesso.
- Erro de rede ou erro HTTP continua exibindo o estado de erro e o botão de nova
  tentativa.
- Não haverá bypass de autenticação nem mudança no endpoint administrativo.

## Validação

- Resposta vazia: painel visível, abas visíveis e Frota acessível.
- Resposta com reservas: comportamento atual preservado.
- Chave inválida: login continua sendo exigido.
- Erro da API: estado de erro continua sendo exibido.
