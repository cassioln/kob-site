import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';
import { validateTrackingPlanSchema } from '../scripts/validate-config.mjs';
import * as configValidators from '../scripts/validate-config.mjs';
import * as analyticsHelpers from './helpers/analytics.js';
import liveConfig from '../../playwright.live.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const analyticsRoot = path.resolve(here, '..');
const denylist = parse(fs.readFileSync(path.join(analyticsRoot, 'pii-denylist.yaml'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(analyticsRoot, 'data-layer.schema.json'), 'utf8'));
const trackingPlan = parse(fs.readFileSync(path.join(analyticsRoot, 'tracking-plan.yaml'), 'utf8'));
const gtmPolicies = parse(fs.readFileSync(path.join(analyticsRoot, 'gtm/policies.yaml'), 'utf8'));

function compilePatterns() {
  return Object.fromEntries(denylist.prohibited_value_patterns.map(({ name, regex }) => {
    return [name, new RegExp(regex, 'i')];
  }));
}

test('denylist compila e reconhece fixtures de PII sem falsos positivos de catálogo', () => {
  const patterns = compilePatterns();

  denylist.test_cases.prohibited_values.forEach(({ pattern, value }) => {
    expect(patterns[pattern].test(value)).toBe(true);
  });
  denylist.test_cases.allowed_values.forEach((value) => {
    Object.values(patterns).forEach((pattern) => expect(pattern.test(value)).toBe(false));
  });
});

test('denylist cobre parâmetros automáticos de link do GA4', () => {
  expect(denylist.prohibited_keys).toEqual(expect.arrayContaining(['link_url', 'link_text']));
});

test('scanner compartilhado detecta PII em parâmetros prefixados de collect', () => {
  const violations = analyticsHelpers.findPiiViolations({
    'ep.link_url': 'https://api.whatsapp.com/send?phone=5511900000000&text=Oi',
    'ep.link_text': 'Fale com lead@example.com'
  });

  expect(violations).toEqual(expect.arrayContaining([
    'key:ep.link_url',
    'key:ep.link_text',
    'value:whatsapp_url@ep.link_url',
    'value:email@ep.link_text'
  ]));
});

test('scanner de collect permite metadados de link apenas quando seus valores são seguros', () => {
  const violations = analyticsHelpers.findPiiViolations({
    'ep.link_url': 'https://api.whatsapp.com/send?phone=5511900000000&text=Oi',
    'ep.link_text': 'Fale com lead@example.com'
  }, { allowedKeys: ['link_url', 'link_text'] });

  expect(violations.filter((violation) => violation.startsWith('key:'))).toEqual([]);
  expect(violations).toEqual(expect.arrayContaining([
    'value:whatsapp_url@ep.link_url',
    'value:email@ep.link_text'
  ]));
});

test('scanner de collect mantém varredura global de telefone e só isenta IDs de transporte declarados', () => {
  expect(denylist.collect_transport_value_exemptions).toEqual({
    brazil_phone: ['_p', 'cid', 'gtm', 'sid', 'tag_exp']
  });
  expect(analyticsHelpers.collectTransportValueExemptions)
    .toEqual(denylist.collect_transport_value_exemptions);

  const businessPhone = encodeURIComponent('+55 11 90000-0000');
  const violations = analyticsHelpers.findCollectPiiViolations([{
    url: 'https://www.google-analytics.com/g/collect?v=2&_p=1784071130123456&cid=1234567890.9876543210',
    body: `en=view_item&sid=1784071130&tag_exp=101509157~103116026&ep.item_name=${businessPhone}`
  }], {
    allowedKeys: ['link_url', 'link_text'],
    exemptPatternKeys: denylist.collect_transport_value_exemptions
  });

  const phoneViolations = violations.filter((violation) => violation.includes('value:brazil_phone@'));
  expect(phoneViolations).toHaveLength(1);
  expect(phoneViolations[0]).toMatch(/@ep\.item_name$/);
});

test('gate live não retém artefatos que possam reproduzir PII', () => {
  expect(liveConfig.use).toMatchObject({
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  });
});

test('parser de collect separa batches e preserva parâmetros duplicados', () => {
  expect(typeof analyticsHelpers.parseCollectRequests).toBe('function');

  const records = analyticsHelpers.parseCollectRequests([{
    url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST',
    body: 'en=page_view&ep.link_url=https%3A%2F%2Fexample.com%2Fa&ep.link_url=https%3A%2F%2Fexample.com%2Fb\nen=cookie_consent_accepted'
  }]);

  expect(records).toHaveLength(2);
  expect(records.map((record) => analyticsHelpers.collectRecordParam(record, 'en')))
    .toEqual(['page_view', 'cookie_consent_accepted']);
  expect(records[0].pairs.filter(([key]) => key === 'ep.link_url'))
    .toEqual([
      ['ep.link_url', 'https://example.com/a'],
      ['ep.link_url', 'https://example.com/b']
    ]);
});

test('scanner de collect inspeciona toda duplicata e decodifica valores repetidamente', () => {
  expect(typeof analyticsHelpers.findCollectPiiViolations).toBe('function');

  const sensitiveUrl = 'https://api.whatsapp.com/send?phone=5511900000000&text=Oi';
  const doubleEncodedEmail = encodeURIComponent(encodeURIComponent('lead@example.com'));
  const violations = analyticsHelpers.findCollectPiiViolations([{
    url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST',
    body: `en=click&ep.link_url=${encodeURIComponent(sensitiveUrl)}&ep.link_url=${encodeURIComponent('https://example.com/safe')}\nen=view_item&ep.item_name=${doubleEncodedEmail}`
  }], {
    allowedKeys: ['link_url', 'link_text'],
    exemptPatternKeys: denylist.collect_transport_value_exemptions
  });

  expect(violations).toEqual(expect.arrayContaining([
    expect.stringMatching(/record\[0\].*value:whatsapp_url@ep\.link_url/),
    expect.stringMatching(/record\[1\].*value:email@ep\.item_name/)
  ]));
});

test('allowed_business_fields é exatamente o conjunto de campos aceitos pelo schema', () => {
  const schemaFields = new Set(Object.values(schema.$defs).flatMap((definition) => {
    return Object.keys(definition.properties || {});
  }));
  const allowedFields = new Set(denylist.allowed_business_fields);

  expect([...allowedFields].sort()).toEqual([...schemaFields].sort());
});

test('validador rejeita campo liberado na policy sem representação no schema', () => {
  expect(typeof configValidators.validateAllowedBusinessFields).toBe('function');
  const changedDenylist = structuredClone(denylist);
  changedDenylist.allowed_business_fields.push('stale_field');

  expect(() => configValidators.validateAllowedBusinessFields(schema, changedDenylist))
    .toThrow(/allowed_business_fields.*schema/i);

  changedDenylist.allowed_business_fields = denylist.allowed_business_fields
    .filter((field) => field !== 'item_name');
  expect(() => configValidators.validateAllowedBusinessFields(schema, changedDenylist))
    .toThrow(/allowed_business_fields.*schema/i);
});

test('eventos fora da allowlist declaram forwarding adiado', () => {
  const allowlist = new Set(gtmPolicies.event_forwarding.allowlist);
  const undeclared = trackingPlan.events.filter((event) => {
    return !allowlist.has(event.name)
      && event.forwarding_status !== 'deferred_not_in_phase_1_allowlist';
  }).map((event) => event.name);

  expect(undeclared).toEqual([]);
});

test('kob_faq_search possui um único estado adiado e não emitido na fase 1', () => {
  const faqSearch = trackingPlan.events.find((event) => event.name === 'kob_faq_search');

  expect({
    baseline: trackingPlan.baseline_matrix.kob_faq_search,
    status: faqSearch.status,
    forwarding: faqSearch.forwarding_status
  }).toEqual({
    baseline: 'deferred_to_phase_1_backlog',
    status: 'deferred_not_emitted',
    forwarding: 'deferred_not_in_phase_1_allowlist'
  });
});

test('validador rejeita schema_version diferente do tracking plan', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.sectionView.properties.schema_version.const = 2;

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/schema_version.*kob_section_view/i);
});

test('validador rejeita campo de controle ausente da lista required', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.sectionView.required = changedSchema.$defs.sectionView.required
    .filter((field) => field !== 'event');

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/controle.*event.*kob_section_view/i);
});

test('validador exige additionalProperties false em cada evento', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.sectionView.additionalProperties = true;

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/additionalProperties.*kob_section_view/i);
});

test('validador rejeita divergência nos parâmetros obrigatórios do contrato', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.sectionView.required = ['event', 'schema_version'];

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/parâmetros obrigatórios.*kob_section_view/i);
});

test('validador rejeita evento declarado só no tracking plan', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.oneOf = changedSchema.oneOf.slice(0, -1);

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/fora de sincronia/i);
});

test('validador rejeita evento declarado só no JSON Schema', () => {
  const changedPlan = structuredClone(trackingPlan);
  changedPlan.events = changedPlan.events.slice(0, -1);

  expect(() => validateTrackingPlanSchema(changedPlan, schema))
    .toThrow(/fora de sincronia/i);
});

test('validador rejeita eventos duplicados no tracking plan', () => {
  const changedPlan = structuredClone(trackingPlan);
  changedPlan.events.push(changedPlan.events[0]);

  expect(() => validateTrackingPlanSchema(changedPlan, schema))
    .toThrow(/eventos duplicados.*tracking plan/i);
});

test('validador rejeita eventos duplicados no JSON Schema', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.oneOf.push(changedSchema.oneOf[0]);

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/eventos duplicados.*JSON Schema/i);
});

test('validador rejeita divergência nos enums do contrato', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.sectionView.properties.section_id.enum.push('checkout');

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/enum.*section_id.*kob_section_view/i);
});

test('validador rejeita parâmetros opcionais não declarados no tracking plan', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.whatsappClick.properties.campaign = { type: 'string' };

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/parâmetros.*kob_whatsapp_click/i);
});

test('validador rejeita divergência de tipo dos parâmetros', () => {
  const changedSchema = structuredClone(schema);
  changedSchema.$defs.faqSearch.properties.has_results.type = 'string';

  expect(() => validateTrackingPlanSchema(trackingPlan, changedSchema))
    .toThrow(/tipo.*has_results.*kob_faq_search/i);
});
