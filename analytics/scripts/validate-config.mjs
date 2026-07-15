import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const trackingPlan = parse(read('analytics/tracking-plan.yaml'));
const denylist = parse(read('analytics/pii-denylist.yaml'));
const property = parse(read('analytics/ga4/property.yaml'));
const schema = JSON.parse(read('analytics/data-layer.schema.json'));
const canonical = JSON.parse(read('analytics/gtm/canonical/container-live.json'));
const gtmPolicies = parse(read('analytics/gtm/policies.yaml'));
const siteMain = read('assets/js/main.js');

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.compile(schema);

export function validateTrackingPlanSchema(plan, jsonSchema) {
  const planEvents = plan.events.map((entry) => entry.name);
  const schemaEventEntries = jsonSchema.oneOf.map((entry) => {
    const definitionName = entry.$ref?.split('/').at(-1);
    const definition = jsonSchema.$defs[definitionName];
    const eventName = definition?.properties?.event?.const;
    if (!eventName) throw new Error('Evento sem const válido no JSON Schema.');
    return [eventName, definition];
  });
  const schemaEventNames = schemaEventEntries.map(([eventName]) => eventName);
  const schemaEvents = new Map(schemaEventEntries);

  if (new Set(planEvents).size !== planEvents.length) throw new Error('Eventos duplicados no tracking plan.');
  if (new Set(schemaEventNames).size !== schemaEventNames.length) {
    throw new Error('Eventos duplicados no JSON Schema.');
  }
  if (planEvents.slice().sort().join('\n') !== [...schemaEvents.keys()].sort().join('\n')) {
    throw new Error('Tracking plan e JSON Schema estão fora de sincronia.');
  }

  plan.events.forEach((event) => {
    const definition = schemaEvents.get(event.name);
    if (definition.additionalProperties !== false) {
      throw new Error(`additionalProperties deve ser false em ${event.name}.`);
    }
    if (definition.properties?.schema_version?.const !== plan.schema_version) {
      throw new Error(`Divergência de schema_version em ${event.name}.`);
    }
    const missingControlField = ['event', 'schema_version']
      .find((field) => !(definition.required || []).includes(field));
    if (missingControlField) {
      throw new Error(`Campo de controle ${missingControlField} ausente de required em ${event.name}.`);
    }
    const planRequired = Object.keys(event.required_parameters || {}).sort();
    const schemaRequired = (definition.required || [])
      .filter((field) => !['event', 'schema_version'].includes(field))
      .sort();
    if (planRequired.join('\n') !== schemaRequired.join('\n')) {
      throw new Error(`Divergência de parâmetros obrigatórios em ${event.name}.`);
    }

    const planParameters = {
      ...(event.required_parameters || {}),
      ...(event.optional_parameters || {})
    };
    const schemaParameters = Object.keys(definition.properties || {})
      .filter((field) => !['event', 'schema_version'].includes(field))
      .sort();
    if (Object.keys(planParameters).sort().join('\n') !== schemaParameters.join('\n')) {
      throw new Error(`Divergência de parâmetros em ${event.name}.`);
    }
    Object.entries(planParameters).forEach(([parameterName, parameter]) => {
      const schemaParameter = definition.properties?.[parameterName];
      const resolvedSchemaParameter = schemaParameter?.$ref
        ? jsonSchema.$defs[schemaParameter.$ref.split('/').at(-1)]
        : schemaParameter;
      const schemaType = resolvedSchemaParameter?.type
        || (resolvedSchemaParameter?.enum?.length ? typeof resolvedSchemaParameter.enum[0] : undefined);
      if (parameter.type !== schemaType) {
        throw new Error(`Divergência de tipo em ${parameterName} do evento ${event.name}.`);
      }
      const schemaEnum = resolvedSchemaParameter?.enum || [];
      const planEnum = parameter.allowed_values || [];
      if (schemaEnum.slice().sort().join('\n') !== planEnum.slice().sort().join('\n')) {
        throw new Error(`Divergência de enum em ${parameterName} do evento ${event.name}.`);
      }
    });
  });

  return planEvents;
}

const eventNames = validateTrackingPlanSchema(trackingPlan, schema);
if (trackingPlan.schema_version !== 1) throw new Error('schema_version inesperado.');
// A allowlist do GTM deve conter exatamente os eventos encaminhados nesta fase:
// todos os P0, mais os P1 explicitamente promovidos com forwarding_status: forwarded_phase_1.
const forwardedEventNames = trackingPlan.events
  .filter((event) => event.priority === 'P0' || event.forwarding_status === 'forwarded_phase_1')
  .map((event) => event.name)
  .sort();
const forwardingAllowlist = [...gtmPolicies.event_forwarding.allowlist].sort();
if (forwardedEventNames.join('\n') !== forwardingAllowlist.join('\n')) {
  throw new Error('Allowlist GTM e eventos encaminhados (P0 + forwarded_phase_1) estão fora de sincronia.');
}
const p0EventNames = trackingPlan.events
  .filter((event) => event.priority === 'P0')
  .map((event) => event.name)
  .sort();
if (trackingPlan.consent.default_owner !== 'gtm' || trackingPlan.consent.grant_owner !== 'gtm') {
  throw new Error('Consent default e grants devem permanecer sob responsabilidade do GTM.');
}
const undeclaredDeferredEvents = trackingPlan.events.filter((event) => {
  return !forwardingAllowlist.includes(event.name)
    && event.forwarding_status !== 'deferred_not_in_phase_1_allowlist';
});
if (undeclaredDeferredEvents.length) throw new Error('Eventos fora da allowlist sem adiamento explícito.');

if (!denylist.prohibited_keys.length || !denylist.prohibited_value_patterns.length) throw new Error('Denylist de PII vazia.');
const piiPatterns = Object.fromEntries(denylist.prohibited_value_patterns.map(({ name, regex }) => {
  return [name, new RegExp(regex, 'i')];
}));
denylist.test_cases.prohibited_values.forEach(({ pattern, value }) => {
  if (!piiPatterns[pattern]?.test(value)) throw new Error(`Fixture PII não reconhecida: ${pattern}.`);
});
denylist.test_cases.allowed_values.forEach((value) => {
  if (Object.values(piiPatterns).some((pattern) => pattern.test(value))) {
    throw new Error(`Falso positivo na denylist de PII: ${value}.`);
  }
});
export function validateAllowedBusinessFields(jsonSchema, policy) {
  const schemaFields = new Set(Object.values(jsonSchema.$defs).flatMap((definition) => {
    return Object.keys(definition.properties || {});
  }));
  const allowedBusinessFields = new Set(policy.allowed_business_fields);
  const missing = [...schemaFields].filter((field) => !allowedBusinessFields.has(field));
  const extra = [...allowedBusinessFields].filter((field) => !schemaFields.has(field));
  if (missing.length || extra.length) {
    throw new Error('allowed_business_fields e schema estão fora de sincronia.');
  }
  return [...schemaFields].sort();
}

validateAllowedBusinessFields(schema, denylist);

Object.entries(trackingPlan.item_catalogs).forEach(([listId, list]) => {
  if (!siteMain.includes(`item_list_id: '${listId}'`)) throw new Error(`Lista ausente do site: ${listId}.`);
  list.items.forEach((item) => {
    if (!siteMain.includes(`item_id: '${item.item_id}'`)) throw new Error(`Item ausente do site: ${item.item_id}.`);
  });
});
if (property.enhanced_measurement.outbound_clicks
  && !siteMain.includes("'/whatsapp.html?cta='")) {
  throw new Error('Outbound clicks ativo sem sanitização do href do WhatsApp.');
}
if (property.property.id !== '545265818') throw new Error('Property ID divergente do baseline.');
if (canonical.public_id !== 'GTM-TK5L6TJF') throw new Error('Container GTM divergente do baseline.');

console.log(`analytics_config=ok events=${eventNames.length} p0_allowlist=${p0EventNames.length} pii_patterns=${Object.keys(piiPatterns).length} schema_version=${trackingPlan.schema_version}`);
