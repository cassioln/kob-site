# Validação de contatos e normalização de dados

## Objetivo

Impedir que o checkout aceite WhatsApp com estrutura inválida, como
`55119958957`, e padronizar a apresentação e a persistência de nomes e
e-mails em reservas públicas e VIPs.

O formulário continuará permitindo que WhatsApp de passageiros adicionais e
VIPs fique vazio. O campo opcional não aceitará, porém, um valor preenchido e
malformado.

## Escopo

Abrange:

- contato principal, passageiros adicionais e crianças de colo em
  `onibus.html`;
- formulário administrativo de reservas VIP;
- validação no navegador e no backend;
- normalização de nomes e e-mails antes da gravação;
- atualização dos nomes e e-mails já existentes nas tabelas de reservas e
  passageiros.
- atalho de WhatsApp na coluna correspondente do painel de reservas.

Não abrange alteração automática de CPF, data de nascimento, ônibus, status,
valor ou telefones antigos. Números antigos estruturalmente inválidos serão
identificados para correção manual, sem tentar adivinhar ou apagar um contato.

## Regras de telefone

O valor será convertido para dígitos e aceitará, no máximo, o padrão brasileiro:

- telefone fixo: 10 dígitos, DDD mais 8 dígitos;
- celular: 11 dígitos, DDD mais 9 dígitos e número iniciado por `9`;
- prefixo internacional `55` opcional quando o valor tiver 12 ou 13 dígitos,
  sendo removido antes da persistência.

O DDD precisa pertencer à lista de DDDs brasileiros válidos. Números fixos
devem ter prefixo de assinante de `2` a `5`; celulares devem ter prefixo `9`.
Assim, `55119958957` não passa: como possui 11 dígitos, é interpretado como
DDD `55` mais celular, mas o assinante começa por `1` e não possui estrutura de
celular válida.

Esta validação verifica estrutura, não confirma se a linha está ativa. A regra
será aplicada ao WhatsApp do contato principal, aos WhatsApps opcionais de
passageiros e aos WhatsApps opcionais de VIPs.

## Regras de nome e e-mail

Uma função canônica compartilhada deverá:

1. remover espaços no começo e no fim;
2. reduzir sequências de espaços internos a um espaço;
3. converter cada palavra para primeira letra maiúscula e demais minúsculas,
   preservando acentos; conectivos comuns como `de`, `da`, `do`, `das`, `dos`
   e `e` permanecem minúsculos quando não iniciarem o nome;
4. converter e-mails para minúsculas.

Exemplos:

```text
SAMARA NASCIMENTO DE TOLEDO  -> Samara Nascimento de Toledo
USUARIO@EMAIL.COM             -> usuario@email.com
```

O frontend exibirá os campos de nome e e-mail em maiúsculas por meio da
apresentação do formulário, inclusive nos campos de revisão. O payload enviado
já será canônico e o backend repetirá a normalização como última barreira.

Essa regra vale para o contato principal, passageiros pagantes, crianças de
colo e reservas VIP.

## Arquitetura e fluxo

### Frontend

- centralizar a normalização de nome, e-mail e telefone em helpers do checkout;
- aplicar máscara de telefone sem transformar um número incompleto em número
  aparentemente válido;
- validar o telefone ao sair do campo e novamente antes de avançar cada etapa;
- manter `aria-invalid`, foco no campo e mensagem específica próxima ao erro;
- bloquear o avanço e a submissão quando um campo opcional tiver valor inválido;
- aplicar a apresentação em maiúsculas somente aos formulários de reserva e VIP,
  sem alterar a forma como os demais lugares exibem os dados.

### Backend

- concentrar as regras em `php/lib/validation.php`;
- reutilizar os helpers no endpoint de pagamento e no endpoint de criação de
  VIPs;
- gravar nomes em formato de título, e-mails em minúsculas e telefones apenas
  com DDD e número nacional;
- manter respostas de validação como erro de entrada (`400`), sem criar
  cobrança nem reserva quando o payload for inválido.

### Painel de reservas

- exibir um ícone do WhatsApp ao lado do número quando houver telefone
  estruturalmente válido;
- abrir `https://api.whatsapp.com/send?phone=55<numero-nacional>` em nova aba;
- usar `target="_blank"` com `rel="noopener noreferrer"`;
- fornecer um rótulo acessível, como “Conversar com [nome] pelo WhatsApp”;
- não criar link para números vazios ou legados estruturalmente inválidos;
- manter o número formatado visível mesmo quando não houver atalho disponível.

### Migração de dados existentes

Será executada uma migração transacional que lê e regrava somente:

- `bus_registrations.primary_name`;
- `bus_registrations.email`;
- `bus_passengers.full_name`;
- `bus_passengers.email`.

Os valores serão normalizados pela mesma implementação usada no backend. A
migração emitirá contagens de linhas alteradas e será validada antes e depois.
Telefones antigos não serão modificados automaticamente.

## Tratamento de erros

- contato principal sem telefone: erro de campo obrigatório;
- passageiro ou VIP sem telefone: permitido;
- telefone preenchido mas inválido: erro específico indicando que o número
  deve conter DDD e formato brasileiro válido;
- e-mail preenchido e inválido: erro específico no campo correspondente;
- nome com menos de duas palavras: erro mantido;
- qualquer payload que contorne o frontend: rejeitado pelo backend antes da
  gravação ou cobrança.

## Testes e critérios de aceite

Adicionar ou atualizar testes para:

- aceitar `11999998888`, `(11) 99999-8888`, `5511999998888` e telefone fixo
  brasileiro estruturalmente válido;
- rejeitar `55119958957`, números com quantidade errada de dígitos, celular sem
  `9`, DDD inválido e sequências incompletas;
- permitir WhatsApp vazio em passageiros adicionais e VIPs;
- normalizar nomes com acentos, espaços repetidos e letras misturadas;
- converter e-mails para minúsculas;
- bloquear a progressão do checkout no navegador;
- confirmar que o payload e a persistência usam o formato canônico;
- confirmar que o painel gera o link correto com DDI `55`, abre em nova aba e
  não cria link para telefone inválido;
- confirmar que a migração altera apenas os campos previstos.

Critério final: nenhum novo registro poderá ser criado com nome ou e-mail fora
do padrão persistido, nem com WhatsApp preenchido e estruturalmente inválido.
