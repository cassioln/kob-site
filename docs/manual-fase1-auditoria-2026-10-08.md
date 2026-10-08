# Manual de Bordo — operação e auditoria da Fase 1

Data: 08/10/2026. Escopo das issues #21, #22 e #15 revisado pelo mantenedor.

## Operação definida

- Organização / avisos aos embarcados: grupo oficial do WhatsApp, usando o convite confirmado pelo mantenedor. Não é necessário entrar no grupo para ler o guia.
- Contratação e dúvidas individuais da viagem: Royal Trip, WhatsApp +55 13 98158-0498. Documentos, reserva e saúde devem seguir canal privado adequado.
- Fretado: página oficial do Busão e canais específicos da operação.
- Privacidade: contato@kriativosonboard.com.br, canal já divulgado no site e usado como resposta nas campanhas da Sender. Sem atribuir nomeação formal de DPO não demonstrada.
- Urgências a bordo: recepção/equipe MSC, sem aguardar atendimento online.
- Formulário de contato congelado por decisão do mantenedor. HTML preservado em comentário, modal ausente do DOM e endpoint legado desativado com HTTP 503. Não há envio de e-mail, armazenamento de mensagem ou cadastro via esse endpoint.

## Sender — verificação somente leitura por MCP

- Conta Kriativos On Board ativa, fuso America/Sao_Paulo.
- Domínio kriativosonboard.com.br: verificado, SPF/DKIM/DMARC aprovados e `ready_to_send=true`.
- 3 grupos existentes; nenhum workflow de automação cadastrado.
- 2 campanhas enviadas em setembro de 2026, para 99 e 87 destinatários. Ambas incluem link de descadastro e referência de privacidade. Nenhuma alteração, inscrição, reativação de contato ou envio foi realizado nesta auditoria.
- Campanha inicial: 3 hard bounces, 1 descadastro, zero reclamações de spam. Reenvio: 1 soft bounce, zero hard bounces/descadastros/reclamações. Respeitar supressões existentes, sem reativação automática.
- A conta informa trial até 18/10/2026. Confirmar o plano disponível antes do próximo envio; não contratar nem alterar plano automaticamente.
- Não há integração real de cadastro Sender no repositório: o antigo código de formulário mencionava integração futura, sem chamada API. A operação atual é realizada pela Sender.

**Limite da auditoria:** autenticação do domínio, descadastro e envio comprovam funcionamento técnico. Nomes de grupos e o status de assinante não comprovam consentimento para marketing. Não foram consultadas listas individuais nem comprovantes de autorização. Antes de novos envios promocionais, o responsável deve verificar a origem e a autorização dos destinatários; comunicações operacionais e marketing têm finalidades diferentes.

## Procedimentos de privacidade

- Não adicionar à newsletter quem apenas entra no grupo, usa o checklist, pede suporte ou contrata transporte.
- Newsletter: manter prova da autorização específica, origem, data e texto autorizado. Preservar descadastros; usar o mínimo de informações necessárias para evitar novo envio indevido.
- Solicitações de direitos: receber pelo e-mail divulgado, verificar identidade apenas quando necessário, responder conforme o direito solicitado e encaminhar fornecedores envolvidos quando aplicável.
- Revisar dados operacionais após a viagem e remover o que deixou de ser necessário; conservar separadamente apenas registros necessários a obrigação legal ou exercício de direitos. Não aplicar um prazo único presumido a todos os dados.
- Mensagens com dados sensíveis: orientar canal privado, restringir acesso e remover conteúdo desnecessário; não incluir em analytics, marketing ou base de assistente.
- Serviços externos: política identifica Sender, WhatsApp, YouTube, hospedagem, agência e serviços do fretado, sem declarar cláusulas contratuais internacionais ou certificação não verificadas.

## Referências

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Sender: https://www.sender.net/privacy-policy/
- Política publicada: `/politica-de-privacidade.html`, `/en/politica-de-privacidade.html`, `/es/politica-de-privacidade.html`.

O assistente #23 permanece uma Fase 2 independente. Congelar o formulário não ativa implicitamente assistente, newsletters ou automações.

## Verificação da entrega

- 18 testes focados de suporte/privacidade: PT/EN/ES, ausência de formulário e opt-in ativos, links reais, dados estruturados, âncoras, larguras 320/375/768/1440, cookies localizados, checklist com JSON inválido e storage bloqueado, canais e FAQ sem JavaScript.
- Ajustes de navegação: FAQ do rodapé aponta a `#duvidas`; transporte do menu mobile leva ao domínio oficial do Busão no idioma correspondente. `#checklist` continua sendo uma rota virtual que abre o painel.
- 1 teste de links legais e 3 de menu/live novamente aprovados após atualização dos destinos esperados; a primeira regressão ainda esperava os links antigos.
- 129 testes de servidor aprovados; seleção/publicação de assets verificada com Python 3.14; lint PHP e sintaxe do JS aprovados.
- Revisão visual local do atendimento em desktop e mobile e da política EN em mobile. Sem envio de mensagens, inscrição de contatos ou ativação do formulário.
- Regressão ampla: 333 aprovados, 1 ignorado (formulário congelado), 5 falhas iniciais. Quatro expectativas de links foram corrigidas e os 4 casos passaram novamente; um timeout de inicialização da live no servidor local não se reproduziu na execução isolada (caso mobile PT/EN/ES aprovado em 18 s). Sem alterar o player por causa do timeout.
- Teste de pipeline/PII `@code`: aprovado, com integração simulada.
- CI e publicação: PR #53 integrado à main (`4b2931afa8680825a4297e1264d14ac6f9e1d7c1`), [CI aprovado](https://github.com/cassioln/kob-site/actions/runs/37819643928) e [deploy Locaweb concluído](https://github.com/cassioln/kob-site/actions/runs/37819996005) em 08/10/2026.
- Produção: Manual PT/EN/ES, políticas PT/EN/ES, JS de cookies e sitemap retornam HTTP 200 e correspondem byte a byte aos arquivos validados. Canais de atendimento conferidos no navegador; endpoint legado retorna POST 503 `service_disabled`, GET 405 e OPTIONS 204, todos com `Cache-Control: no-store`.
- Issues #21, #22 e épico #15 encerrados com critérios atualizados e evidências. #23 permanece uma Fase 2 opcional. Não houve envio de mensagens, cadastro de assinantes ou reativação do formulário.
