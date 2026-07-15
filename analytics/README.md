# Analytics-as-Code — Kriativos On Board

Este diretório é a fonte versionada do contrato **site → `dataLayer` → GTM → GA4**.

## Escopo da fase 1

- baseline read-only do GTM/GA4;
- contrato de eventos v1;
- helper único `window.KOBAnalytics.track`;
- eventos P0 no site;
- testes automatizados de jornada, consentimento, deduplicação e ausência de PII;
- workspace GTM candidato e publicação somente em etapas posteriores.

## Fronteiras

- **Site:** declara fatos de negócio e IDs estáveis no `dataLayer`.
- **GTM:** aplica consentimento, allowlist, variáveis, triggers e roteamento.
- **GA4:** recebe somente eventos aprovados e define dimensões/key events.
- **Git:** registra contrato, snapshots, políticas, testes e evidências.

O site não chama `gtag('event', ...)`. O componente de consentimento pode usar `gtag('consent', 'update', ...)` apenas como salvaguarda fail-closed ao negar/revogar.

## Regras essenciais

1. Eventos de negócio usam `lower_snake_case` e `schema_version: 1`.
2. Parâmetros ausentes são omitidos; não enviar `null`, `undefined` ou string vazia.
3. Nunca enviar e-mail, telefone, texto/URL do WhatsApp, termo de busca, `innerText` ou outra PII.
4. `kob_whatsapp_click` mede intenção de contato, não lead confirmado, checkout ou compra.
5. Eventos `cookie_*` são sinais de controle e não devem ser encaminhados ao GA4.
6. Não existe publicação automática do GTM. Cássio Lima revisa e publica manualmente.
7. Não há segundo aprovador; alterações de alto risco exigem registro explícito dessa exceção.

## Arquivos

- `tracking-plan.yaml`: catálogo, firing rules, deduplicação e destino.
- `data-layer.schema.json`: validação estrutural dos eventos versionados da fase 1.
- `pii-denylist.yaml`: chaves e padrões proibidos.
- `ga4/`: estado confirmado e configuração planejada.
- `gtm/canonical/`: baseline normalizado e diffs candidatos.
- `gtm/raw/`: reservado para exports reais da API; nunca contém dados inventados.
- `tests/`: testes Playwright do contrato e jornadas.
- `tests/live-pipeline.spec.js`: gate com GTM público real e endpoints de coleta abortados.

## Validação local

```bash
npm test
npm run test:analytics
npm run test:analytics:pii
npm run validate:analytics
npm run test:analytics:live
```

`npm test` inclui o gate de PII com o GTM público real: primeiro comprova que o interceptor observa um `collect` seguro e depois falha se qualquer request contiver telefone, mensagem ou e-mail. Nenhum hit chega ao GA4/DoubleClick, pois todas as tentativas de coleta são abortadas no navegador.

A suíte live completa acrescenta os gates de conta. Enquanto o GTM não tratar `cookie_consent_restored`, `npm run test:analytics:live` deve falhar porque o page view restaurado usa `G100` em vez de `G101`; essa falha bloqueia publicação.

A propriedade principal do GA4 será usada em Preview/DebugView. Isso não autoriza publicar o container GTM sem revisão humana.
