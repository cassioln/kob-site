# Painel: ordem de contato e alinhamento vertical

## Objetivo

Reorganizar a tabela de reservas do painel para apresentar WhatsApp antes de CPF e centralizar verticalmente o conteúdo das células da tabela.

## Escopo

- Trocar a ordem das colunas `WhatsApp` e `CPF` no cabeçalho de `painel-onibus.html`.
- Trocar a ordem de criação dessas células em `assets/js/painel-onibus.js`, mantendo os mesmos dados, links e classes.
- Aplicar `align-content: center` e `vertical-align: middle` às células geradas com `data-rotulo`, preservando o comportamento responsivo existente.
- Adicionar teste automatizado para conferir a ordem das colunas e o alinhamento computado.

## Fora de escopo

- Nenhuma alteração em API, banco, filtros, exportação, regras de pagamento ou lógica da frota.
- Nenhuma alteração na edição local já existente em `assets/css/painel-onibus.css`.

## Critérios de aceitação

1. No desktop, a sequência do cabeçalho é `... Passageiro, WhatsApp, CPF, Grupo ...`.
2. Cada linha renderizada mantém os dados de WhatsApp e CPF associados à coluna correta.
3. As células com `data-rotulo` usam alinhamento vertical centralizado e `align-content: center`.
4. A tabela continua utilizável no layout mobile, com os rótulos responsivos intactos.
5. Os testes focados do painel passam sem alterar os demais fluxos.
