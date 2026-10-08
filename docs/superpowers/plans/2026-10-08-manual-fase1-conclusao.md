# Conclusão da Fase 1 do Manual de Bordo

**Objetivo:** validar a operação de atendimento e Sender, corrigir privacidade e paridade, publicar a entrega e fechar #21, #22 e #15 no escopo definido pelo mantenedor em 08/10/2026.

**Arquitetura:** manter HTML/CSS/JS estáticos e PHP 8.0 na Locaweb. Atendimento usa os canais externos confirmados pelo mantenedor. O formulário de contato permanece congelado, inclusive seu endpoint; nenhum teste envia e-mail ou cadastra assinantes reais.

## Escopo autorizado

- Grupo oficial dos embarcados: convite WhatsApp já publicado e confirmado pelo mantenedor.
- Royal Trip: WhatsApp +55 13 98158-0498 para contratação e dúvidas da viagem.
- Preservar todas as alterações atuais da main, incluindo busca global e formulários comentados.
- Aplicar conteúdo e atributos acessíveis em PT/EN/ES.
- Auditar Sender por MCP em modo somente leitura: domínio, conta, grupos, campanhas, descadastro e métricas agregadas; não extrair contatos.
- Não presumir comprovação do consentimento dos contatos importados a partir do status técnico de assinante.
- Não ativar formulário de contato, SMTP, automação de marketing ou assistente.

## Execução e evidências

- [x] Sincronizar e conferir main; criar branch `code-ia/manual-fase1-conclusao`.
- [x] Ler AGENTS, LGPD e i18n; confrontar as issues com o escopo revisado.
- [x] Auditar Sender: conta ativa, SPF/DKIM/DMARC prontos, 2 campanhas enviadas com descadastro e nenhum workflow ativo.
- [x] Adicionar o canal do grupo à seção `#contato`; remover do HTML ativo o modal congelado, preservando-o comentado.
- [x] Desativar o endpoint legado antes de leitura de dados/envio de e-mail; retornar HTTP 503 e `service_disabled` para POST, mantendo 405/204 nos métodos apropriados. Testar ausência de falso sucesso mesmo com payload válido e honeypot.
- [x] Atualizar a política real para incluir checklist local, YouTube, grupo WhatsApp e Sender, distinguir comunicação operacional de marketing e corrigir afirmações não sustentadas. Criar versões EN/ES e conectar links, canônicas, hreflang e sitemap.
- [x] Registrar a auditoria operacional; manter a Sender existente sem cadastro novo no site, coerente com o formulário congelado.
- [x] Regerar o índice da busca global se conteúdo indexado mudar.
- [x] Executar testes de servidor, analytics/PII, manual, checklist, live, consentimento e i18n; verificar teclado, sem JavaScript, storage bloqueado, redução de movimento e larguras 320/375/768/1440.
- [ ] Abrir e anexar PR; validar CI, integrar à main e conferir deploy e rotas de produção nos três idiomas.
- [ ] Atualizar critérios e comentários de #21/#22/#15 com evidências e exclusões explícitas; encerrar somente após comprovação.

## Referências verificadas

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm (art. 19 trata confirmação/acesso e diz 15 dias, sem qualificá-los como úteis).
- Política da Sender: https://www.sender.net/privacy-policy/ (Sender atua como operador dos dados de assinantes).
- Formularios e newsletter atuais estão no modal do manual, sem integração real com Sender no código. Endpoint legado ignora resultado de `mail()` e devolve sucesso: será congelado de forma efetiva.
