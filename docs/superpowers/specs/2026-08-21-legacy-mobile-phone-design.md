# Aceitar celulares brasileiros legados de oito dígitos

## Contexto

O formulário aceita telefones brasileiros com DDD, mas a validação de dez
dígitos aceita apenas linhas fixas iniciadas de 2 a 5. Existem contatos válidos
e ativos no WhatsApp com DDD e número móvel legado de oito dígitos iniciado em
9, como `+55 85 9926-6494`.

## Objetivo

Manter a proteção contra números inválidos e passar a aceitar telefones móveis
legados de oito dígitos em todos os pontos que validam, exibem ou usam
WhatsApp.

## Regra

- O DDD continua obrigatório e precisa pertencer à lista brasileira válida.
- Onze dígitos nacionais continuam aceitos somente para celular no padrão
  `DDD + 9 + oito dígitos`.
- Dez dígitos nacionais continuam aceitos para fixo iniciado de 2 a 5 e passam
  a aceitar móvel legado iniciado em 9.
- Valores com DDI `55` são normalizados para o número nacional antes da
  validação.
- Repetições triviais e quaisquer outros comprimentos ou prefixos permanecem
  inválidos.

## Escopo técnico

- Aplicar a mesma regra no formulário de reserva, no formulário VIP, no link
  de WhatsApp do painel e na validação PHP do backend.
- Manter o armazenamento apenas com dígitos nacionais, sem DDI.
- Reutilizar a formatação já existente de dez dígitos: `(DD) XXXX-XXXX`.
- Cobrir aceitação de móvel legado, telefone fixo e rejeição de número inválido
  por testes automatizados.

## Validação

- `+55 85 9926-6494` normaliza para `8599266494` e pode abrir uma conversa no
  WhatsApp.
- `+55 85 9815-8188` normaliza para `8598158188`.
- Um telefone de dez dígitos com prefixo 6, 7 ou 8 continua bloqueado.
- O comportamento atual de telefones de 11 dígitos não muda.
