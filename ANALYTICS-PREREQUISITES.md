# Pré-requisitos para execução do plano GTM + GA4

Este documento reúne todas as informações, decisões e autorizações necessárias para executar o plano de Analytics-as-Code do Kriativos On Board. Ele foi organizado para permitir o início com acesso somente de leitura, sem compartilhar segredos e sem conceder à IA permissão para publicar em produção.

> [!IMPORTANT]
> Não registre neste arquivo, no Git ou no chat senhas, tokens OAuth, cookies, chaves privadas, arquivos JSON de service account, códigos de recuperação, `api_secret` do Measurement Protocol ou qualquer outro segredo. A autenticação deve acontecer de forma interativa no navegador/CLI ou por um gerenciador de segredos.

## 1. Objetivo da coleta

As respostas deste documento serão usadas para:

1. auditar a instalação atual do GTM e GA4;
2. criar o tracking plan e os schemas do `dataLayer`;
3. definir conversões e eventos prioritários;
4. testar consentimento, eventos e requests reais;
5. preparar alterações em um workspace isolado do GTM;
6. validar as mudanças em ambiente de teste;
7. permitir revisão humana antes de qualquer publicação;
8. configurar, em fases posteriores, BigQuery e conversões confirmadas pela Royal Trip.

## 2. Informações já conhecidas

Não é necessário fornecer novamente os itens abaixo:

| Item | Informação conhecida |
|---|---|
| Site público | `https://kriativosonboard.com.br/` |
| Repositório | `kob-site` |
| Tipo de aplicação | Site estático |
| GTM Web Container | `GTM-TK5L6TJF` |
| GA4 Measurement ID observado | `G-8SYDL3EXVM` |
| Consentimento atual | Consent Mode avançado, com pings sem cookies antes do aceite |
| Conversão disponível no site | Clique para abrir o WhatsApp da Royal Trip |
| Páginas encontradas | Landing principal e política de cookies |
| Interações encontradas | Cabines, pacotes, CTAs, FAQ, vídeos, tours 360°, galeria, carrosséis, dialogs e links externos |
| Formulários tradicionais | Nenhum no site atual |
| Publicação automática | Não será permitida por padrão |

A auditoria inicial também encontrou eventos existentes no `dataLayer` para visualização de seção, clique no WhatsApp, busca no FAQ e profundidade de scroll. A nova implementação deverá preservar o que for válido, eliminar duplicidades e ampliar a cobertura de forma semântica.

## 3. Autorização de escopo

Antes do início, confirme o que está autorizado.

- [ ] Ler e analisar todos os arquivos versionados do repositório.
- [ ] Criar o diretório `analytics/` e seus artefatos.
- [ ] Alterar a instrumentação do `dataLayer` em branch dedicada.
- [ ] Adicionar dependências de desenvolvimento necessárias para testes, se justificadas no PR.
- [ ] Executar o site localmente e usar navegadores automatizados.
- [ ] Consultar GTM e GA4 inicialmente em modo read-only.
- [ ] Criar workspace de teste no GTM após a aprovação do baseline.
- [ ] Criar uma versão candidata no GTM após os testes.
- [ ] Manter a publicação em produção exclusivamente manual ou protegida por aprovação.

### Escopo que permanece proibido por padrão

- publicar diretamente no container live;
- apagar tags, triggers, variáveis, workspaces, versões, containers ou contas sem aprovação específica;
- gerenciar usuários ou permissões do GTM/GA4;
- incluir Custom HTML ou Custom JavaScript sem revisão específica;
- enviar eventos de teste para a propriedade de produção quando isso puder ser evitado;
- armazenar credenciais no repositório;
- enviar PII ao GA4.

**Aprovação do escopo acima:** `PREENCHER: aprovado / ajustes necessários`

**Ajustes de escopo, se houver:**

```text
PREENCHER
```

## 4. Google Cloud e autenticação

### 4.1 Projeto Google Cloud

Preencha:

```text
Google Cloud Project ID:
Nome do projeto:
Responsável pelo projeto:
Billing habilitado: sim / não / não sei
```

APIs que precisarão estar habilitadas no projeto:

- Google Tag Manager API;
- Google Analytics Data API;
- Google Analytics Admin API.

BigQuery API e demais serviços serão necessários apenas quando a fase de observabilidade for iniciada.

Se ainda não houver projeto, indique:

```text
Criar projeto novo: sim / não
Nome sugerido, se houver:
Organização/pasta GCP, se aplicável:
```

### 4.2 Forma de autenticação

Escolha a opção inicial:

- [ ] OAuth interativo com a conta Google de um usuário.
- [ ] Service account dedicada.
- [ ] Workload Identity/OIDC para CI.
- [ ] Ainda não decidido.

Recomendação:

- OAuth interativo para a auditoria local inicial;
- identidade separada e curta para automação;
- Workload Identity/OIDC para CI;
- evitar chave JSON persistente;
- se uma chave JSON for inevitável, armazená-la em Secret Manager ou 1Password e nunca no repositório.

### 4.3 Conta que realizará a autenticação

Não informe senha nem token. Forneça apenas uma identificação administrativa opcional:

```text
Conta Google que tem acesso ao GTM/GA4:
Responsável por concluir o login interativo:
```

### 4.4 Permissões iniciais

Para a fase de auditoria, conceder somente:

| Sistema | Acesso desejado |
|---|---|
| GTM | Leitura do account/container/workspaces/versions |
| GA4 | Viewer ou equivalente read-only na propriedade |
| Google Cloud | Uso das APIs habilitadas, sem administração ampla do projeto |

Scopes esperados:

- GTM: `https://www.googleapis.com/auth/tagmanager.readonly`;
- GA4: `https://www.googleapis.com/auth/analytics.readonly`.

Permissões de edição serão concedidas somente depois que o baseline e o plano forem revisados.

## 5. Identificação do GTM

O Public Container ID já é conhecido, mas a API também usa IDs numéricos e caminhos internos.

Preencha o que souber. Os campos desconhecidos podem ser descobertos via API após o login read-only.

```text
Nome da conta GTM:
Account ID numérico: não sei / PREENCHER
Nome do container:
Container ID numérico: não sei / PREENCHER
Public Container ID: GTM-TK5L6TJF
Tipo do container: Web / outro
Responsável atual pelo GTM:
```

### 5.1 Ambientes e workspaces existentes

```text
Existe GTM Environment de desenvolvimento: sim / não / não sei
Existe GTM Environment de homologação: sim / não / não sei
Existem workspaces ativos de outras pessoas: sim / não / não sei
Há alguma mudança ainda não publicada: sim / não / não sei
```

Se houver workspaces ativos, listar apenas nomes e responsáveis, sem credenciais:

```text
PREENCHER
```

### 5.2 Publicação

Escolha o processo desejado:

- [ ] Publicação manual na interface do GTM.
- [ ] Job manual protegido no GitHub Actions.
- [ ] Outro processo de aprovação.

**Default recomendado para o primeiro ciclo:** publicação manual pelo proprietário do container.

```text
Pessoa responsável por revisar:
Pessoa responsável por publicar:
Exigir segundo aprovador para mudanças de alto risco: sim / não
```

## 6. Identificação do GA4

O Measurement ID foi observado no tráfego, mas a API utiliza o Property ID numérico.

```text
Nome da conta GA4:
Account ID numérico: não sei / PREENCHER
Nome da propriedade:
Property ID numérico: não sei / PREENCHER
Nome do Web Data Stream:
Stream ID numérico: não sei / PREENCHER
Measurement ID: G-8SYDL3EXVM
Fuso horário da propriedade:
Moeda da propriedade:
Responsável atual pelo GA4:
```

Se o Property ID não for conhecido, ele poderá ser descoberto depois da autenticação read-only.

### 6.1 Configurações conhecidas

Preencha apenas se souber. A auditoria também verificará esses itens.

```text
Enhanced Measurement habilitado: sim / não / não sei
Google Signals habilitado: sim / não / não sei
Retenção de dados atual: não sei / PREENCHER
Existem custom dimensions: sim / não / não sei
Existem custom metrics: sim / não / não sei
Existem key events configurados: sim / não / não sei
Existe link com Google Ads: sim / não / não sei
Existe BigQuery Export: sim / não / não sei
```

### 6.2 Propriedade e stream de teste

A melhor configuração é não poluir a propriedade de produção durante a validação.

```text
Existe propriedade GA4 de teste: sim / não / não sei
Property ID de teste, se existir:
Existe Web Data Stream de teste: sim / não / não sei
Measurement ID de teste, se existir:
Podemos criar propriedade/stream de teste: sim / não
```

## 7. Decisão sobre Consent Mode e LGPD

### 7.1 Estado atual

O site utiliza Consent Mode avançado:

- os cookies de Analytics permanecem bloqueados antes do aceite;
- o navegador ainda envia pings sem cookies ao Google;
- o comportamento foi observado com `analytics_storage: denied`.

Essa decisão precisa ser alinhada com a política de privacidade e com o entendimento jurídico/de negócio. A automação pode testar a implementação, mas não substitui parecer jurídico.

### 7.2 Escolha desejada

Selecione uma opção:

- [ ] **Consent Mode básico:** nenhuma requisição de Analytics antes do consentimento.
- [ ] **Consent Mode avançado:** permite pings sem cookies antes do consentimento.
- [ ] **Ainda não decidido:** preservar o comportamento atual até decisão explícita.

```text
Decisão:
Responsável pela decisão:
Existe parecer/política interna: sim / não
Observações:
```

**Default técnico seguro enquanto não houver decisão:** auditar e documentar o comportamento existente, criar testes para os dois modos e não alterar produção.

### 7.3 Categorias de consentimento

Confirme as categorias que o produto deseja apresentar:

- [ ] Necessários.
- [ ] Analytics.
- [ ] Publicidade.
- [ ] Personalização.
- [ ] Funcionalidade.
- [ ] Outras: `PREENCHER`.

### 7.4 Requisitos regionais

```text
Público principal: Brasil / outros países
Há requisito regional adicional além da LGPD: sim / não / não sei
Regiões específicas, se houver:
Responsável jurídico/privacidade:
```

## 8. Definição do funil e das conversões

### 8.1 Funil proposto

```text
Aquisição
  → consumo do conteúdo
  → visualização da seção de valores
  → visualização/seleção de cabine
  → abertura do detalhe
  → clique no WhatsApp
  → conversa iniciada
  → lead qualificado
  → reserva confirmada
```

Confirme se o funil representa o negócio:

```text
Funil aprovado: sim / não
Ajustes:
```

### 8.2 Classificação recomendada

| Ação | Classificação sugerida | Confirmar |
|---|---|---|
| Clique no WhatsApp | Intenção/microconversão | `sim / alterar` |
| Conversa efetivamente iniciada | Lead | `sim / alterar` |
| Lead aceito pela Royal Trip | Lead qualificado | `sim / alterar` |
| Reserva confirmada | Conversão principal/compra | `sim / alterar` |
| Cancelamento/reembolso | Ajuste de receita | `sim / não se aplica` |

### 8.3 Key events

```text
Clique no WhatsApp deve ser key event: sim / não / decidir após baseline
Lead confirmado deve ser key event: sim / não
Reserva confirmada deve ser key event: sim / não
Outros key events desejados:
```

Recomendação: tratar o clique no WhatsApp como intenção. Não usar `generate_lead` ou `purchase` até existir confirmação externa correspondente.

### 8.4 Valores e receita

```text
O GA4 deve receber preço da cabine visualizada: sim / não
O GA4 deve receber valor estimado do lead: sim / não
O GA4 deve receber receita da reserva confirmada: sim / não
Moeda: BRL / outra
Impostos/taxas devem entrar na receita: sim / não / ainda não decidido
Política para cancelamentos/reembolsos:
```

## 9. KPIs e perguntas prioritárias

Marque o que é importante:

- [ ] Usuários que chegam à seção de valores.
- [ ] Taxa de visualização dos detalhes das cabines.
- [ ] Cabines com maior interesse.
- [ ] Pacotes com maior interesse.
- [ ] CTA e placement com maior taxa de clique.
- [ ] Cliques no WhatsApp por campanha/origem.
- [ ] Conversão por dispositivo.
- [ ] Relação entre vídeos e intenção de reserva.
- [ ] Relação entre FAQ e intenção de contato.
- [ ] Perguntas/categorias mais consultadas no FAQ.
- [ ] Abandono entre valores e contato.
- [ ] Leads confirmados.
- [ ] Reservas confirmadas.
- [ ] Receita e retorno por campanha.
- [ ] Outros: `PREENCHER`.

Priorize até cinco perguntas para o primeiro ciclo:

```text
1.
2.
3.
4.
5.
```

## 10. Google Ads, pixels e destinos adicionais

Informe quais integrações existem ou estão planejadas:

| Destino | Em uso | Planejado | Observações |
|---|---:|---:|---|
| Google Ads | `sim/não/não sei` | `sim/não` | |
| Meta Pixel/CAPI | `sim/não/não sei` | `sim/não` | |
| Microsoft Ads | `sim/não/não sei` | `sim/não` | |
| TikTok | `sim/não/não sei` | `sim/não` | |
| Floodlight | `sim/não/não sei` | `sim/não` | |
| Hotjar/Clarity | `sim/não/não sei` | `sim/não` | |
| CRM/CDP | `sim/não/não sei` | `sim/não` | |
| Outro | | | |

```text
Há campanhas ativas que não podem sofrer interrupção: sim / não
Responsável por mídia:
Janela de mudança proibida, se houver:
```

## 11. Hospedagem, deploy e staging

```text
Provedor de hospedagem:
Processo atual de deploy:
URL de staging/preview, se existir:
Deploy de preview por pull request: sim / não
Domínio/URL que pode ser usado nos testes:
Há autenticação no staging: sim / não
Responsável pelo deploy:
```

Se não houver staging, a primeira fase poderá usar:

- servidor local;
- GTM workspace isolado;
- GTM Environment de homologação;
- propriedade ou stream GA4 de teste.

## 12. GitHub, revisão e governança

Defaults propostos:

| Item | Default |
|---|---|
| Branch de implementação | `feat/analytics-foundation` |
| Diretório dos artefatos | `analytics/` |
| Revisão | Pull request |
| Publicação GTM | Manual no primeiro ciclo |
| Credencial da IA | Read-only inicialmente; edit sem publish depois |
| Rollback | Versão anterior conhecida do GTM |
| Alterações de alto risco | Exigem segundo aprovador |

Preencha:

```text
Repositório remoto responsável:
Branch base:
Pessoa que revisará o PR:
Exigir checks de CI antes do merge: sim / não
Exigir segundo aprovador para consentimento/publicidade: sim / não
GitHub Actions pode usar ambientes protegidos: sim / não / não sei
```

Confirme ou altere os defaults:

```text
Defaults aprovados: sim / não
Alterações:
```

## 13. Royal Trip, WhatsApp e conversões confirmadas

Esta seção é necessária apenas para medir lead e reserva reais. Não bloqueia o baseline nem a instrumentação client-side.

### 13.1 Sistema utilizado

```text
WhatsApp comum ou WhatsApp Business:
Existe WhatsApp Business API: sim / não / não sei
Existe CRM: sim / não
Nome do CRM:
Existe webhook de conversa/lead: sim / não / não sei
Reservas ficam em sistema: sim / não
Nome do sistema:
Existe planilha ou export periódico: sim / não
Responsável técnico/comercial na Royal Trip:
```

### 13.2 Dados disponíveis

Não cole dados reais de clientes. Informe apenas quais campos existem.

- [ ] ID de lead.
- [ ] ID de reserva.
- [ ] Timestamp da conversa.
- [ ] Timestamp da reserva.
- [ ] Status do lead.
- [ ] Status da reserva.
- [ ] Tipo de cabine.
- [ ] Valor e moeda.
- [ ] Origem/campanha.
- [ ] Identificador de clique ou sessão permitido.
- [ ] Cancelamento/reembolso.
- [ ] Outros: `PREENCHER`.

```text
Frequência de atualização desejada: realtime / diária / semanal
Existe autorização para correlacionar dados de marketing e reserva: sim / não / precisa de validação
Política de retenção aplicável:
```

### 13.3 Restrições

Nenhum destes dados deve ser enviado ao GA4 como parâmetro comum:

- nome;
- telefone;
- e-mail;
- CPF/documento;
- conteúdo de conversa;
- endereço;
- qualquer identificador diretamente pessoal.

A correlação futura deverá ser pseudônima, consentida, documentada e executada no backend.

## 14. BigQuery e observabilidade

Esta seção pode ser preenchida posteriormente.

```text
Configurar BigQuery agora ou depois:
Google Cloud Project do BigQuery:
Região desejada:
Billing habilitado: sim / não / não sei
Export diário desejado: sim / não
Export intraday/streaming necessário: sim / não
Dataset adicional para modelos de qualidade:
Ferramenta de BI atual:
Responsável por dados/BI:
```

Default recomendado:

- habilitar export diário cedo para preservar histórico;
- não habilitar streaming sem necessidade de SLO intradiário;
- manter dados brutos separados dos modelos de qualidade;
- reprocessar os três dias anteriores para absorver eventos atrasados;
- não exigir igualdade absoluta entre BigQuery e interface do GA4.

## 15. Server-side GTM e infraestrutura adicional

Esta fase não faz parte da implantação inicial. Preencha somente se já houver um requisito.

```text
Existe necessidade de endpoint first-party: sim / não / não sei
Existem múltiplos destinos server-side: sim / não
Há requisito de redaction/enriquecimento: sim / não
Há equipe para operar Cloud Run/Docker: sim / não
Existe orçamento para infraestrutura recorrente: sim / não
```

Sem business case mensurável, o default é manter GTM Web + GA4 e revisar sGTM depois que o tracking client-side estiver confiável.

## 16. Segurança e gestão de segredos

Confirme o método desejado:

- [ ] 1Password.
- [ ] Google Secret Manager.
- [ ] GitHub Actions Secrets/Environments.
- [ ] Outro gerenciador: `PREENCHER`.

### Regras obrigatórias

- nenhum segredo no Git, tracking plan ou export normalizado;
- OAuth/service account com privilégio mínimo;
- identidade de leitura separada da identidade de publicação;
- tokens curtos e rotacionáveis;
- logs de tool calls sem tokens ou payloads sensíveis;
- MCP de GTM self-hosted e fixado por versão/commit;
- serviço deve falhar fechado se autenticação estiver ausente;
- nenhum uso de endpoint MCP público para administrar o container de produção sem revisão de segurança;
- nenhum `latest`, `curl | bash` ou instalação não fixada no pipeline de produção.

```text
Responsável por segurança/credenciais:
Gerenciador escolhido:
Rotação exigida:
Restrições adicionais:
```

## 17. Pessoas e responsabilidades

| Responsabilidade | Nome/contato interno |
|---|---|
| Proprietário de negócio | `PREENCHER` |
| Responsável pelo site | `PREENCHER` |
| Responsável pelo GTM | `PREENCHER` |
| Responsável pelo GA4 | `PREENCHER` |
| Responsável por mídia | `PREENCHER` |
| Responsável pela Royal Trip | `PREENCHER` |
| Responsável por privacidade/LGPD | `PREENCHER` |
| Revisor técnico | `PREENCHER` |
| Publicador de produção | `PREENCHER` |

## 18. Resposta mínima para iniciar o baseline

Para começar a fase read-only, basta preencher este bloco:

```text
1. Aprovo o escopo read-only e a criação dos artefatos no repositório: sim / não
2. Google Cloud Project ID:
3. Forma de autenticação: OAuth interativo / service account / ainda não decidido
4. GA4 Property ID: não sei / número
5. Consent Mode desejado: básico / avançado / ainda não decidido
6. Clique no WhatsApp será key event: sim / não / decidir após baseline
7. Existe acesso a dados da Royal Trip ou CRM: sim / não
8. Google Ads ou outros pixels em uso:
9. Existe staging: sim + URL / não
10. BigQuery: configurar agora / depois
11. Publicação final: manual / GitHub Actions protegido
12. Cinco KPIs prioritários:
13. Aprovo os defaults de branch, diretório e governança: sim / ajustes
14. Responsável por concluir o login Google interativo:
```

Os IDs numéricos de GTM e GA4 podem ser descobertos via API se a conta autenticada tiver acesso de leitura.

## 19. Critérios para considerar cada etapa pronta

### Pronto para iniciar a auditoria

- [ ] Escopo read-only aprovado.
- [ ] Projeto Google Cloud definido.
- [ ] Autenticação Google disponível.
- [ ] Conta autenticada possui acesso ao GTM e GA4.
- [ ] Responsável técnico identificado.

### Pronto para implementar no site

- [ ] Baseline do GTM exportado.
- [ ] Tracking plan revisado.
- [ ] Consent Mode decidido ou explicitamente congelado.
- [ ] Conversões e KPIs aprovados.
- [ ] Branch e fluxo de PR aprovados.
- [ ] Ambiente de teste definido.

### Pronto para criar versão candidata no GTM

- [ ] Testes do `dataLayer` aprovados.
- [ ] Testes de rede aprovados.
- [ ] Ausência de PII validada.
- [ ] Consentimento validado em todos os estados.
- [ ] Diff semântico revisado.
- [ ] Workspace sem conflitos.
- [ ] `quick_preview` sem erro de compilação.
- [ ] Tag Assistant e DebugView aprovados.

### Pronto para publicar em produção

- [ ] PR aprovado e checks verdes.
- [ ] Versão candidata identificada e imutável.
- [ ] Plano de rollback registrado.
- [ ] Aprovador humano autorizou a publicação.
- [ ] Publicador separado possui a permissão necessária.
- [ ] Smoke test pós-publicação preparado.

## 20. Próximos passos após o preenchimento

1. autenticação read-only;
2. export do container live e inventário da propriedade GA4;
3. criação do baseline em Git;
4. tracking plan e JSON Schemas;
5. revisão humana do plano;
6. instrumentação semântica no site;
7. testes Playwright e evidências;
8. workspace isolado no GTM;
9. validação com Tag Assistant, DebugView e Realtime;
10. versão candidata;
11. aprovação humana e publicação;
12. BigQuery e conversões externas em fases posteriores.

## Referências oficiais

- [Google Analytics para desenvolvedores](https://developers.google.com/analytics/devguides/collection/ga4)
- [MCP oficial do Google Analytics](https://developers.google.com/analytics/devguides/MCP)
- [Google Tag Manager API v2](https://developers.google.com/tag-platform/tag-manager/api/v2)
- [Autorização da GTM API](https://developers.google.com/tag-platform/tag-manager/api/v2/authorization)
- [Google Analytics Admin API](https://developers.google.com/analytics/devguides/config/admin/v1)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Consent Mode](https://developers.google.com/tag-platform/security/guides/consent)
- [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Tag Assistant](https://support.google.com/tagassistant/answer/10039345)
- [GA4 DebugView](https://support.google.com/analytics/answer/7201382)
- [BigQuery Export](https://support.google.com/analytics/answer/9358801)
