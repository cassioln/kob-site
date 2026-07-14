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

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.compile(schema);

const eventNames = trackingPlan.events.map((entry) => entry.name);
const schemaEventNames = schema.oneOf.map((entry) => {
  const definitionName = entry.$ref?.split('/').at(-1);
  return schema.$defs[definitionName]?.properties?.event?.const;
});
if (new Set(eventNames).size !== eventNames.length) throw new Error('Eventos duplicados no tracking plan.');
if (trackingPlan.schema_version !== 1) throw new Error('schema_version inesperado.');
if (schemaEventNames.some((name) => !name)) throw new Error('Evento sem const válido no JSON Schema.');
if (eventNames.slice().sort().join('\n') !== schemaEventNames.slice().sort().join('\n')) {
  throw new Error('Tracking plan e JSON Schema estão fora de sincronia.');
}
const p0EventNames = trackingPlan.events
  .filter((event) => event.priority === 'P0')
  .map((event) => event.name)
  .sort();
const forwardingAllowlist = [...gtmPolicies.event_forwarding.allowlist].sort();
if (p0EventNames.join('\n') !== forwardingAllowlist.join('\n')) {
  throw new Error('Allowlist GTM e eventos P0 estão fora de sincronia.');
}
if (trackingPlan.consent.default_owner !== 'gtm' || trackingPlan.consent.grant_owner !== 'gtm') {
  throw new Error('Consent default e grants devem permanecer sob responsabilidade do GTM.');
}
if (!denylist.prohibited_keys.length || !denylist.prohibited_value_patterns.length) throw new Error('Denylist de PII vazia.');
if (property.property.id !== '545265818') throw new Error('Property ID divergente do baseline.');
if (canonical.public_id !== 'GTM-TK5L6TJF') throw new Error('Container GTM divergente do baseline.');
if (canonical.workspace_pending_changes.total !== 12) throw new Error('Baseline das 12 alterações divergente.');

console.log(`analytics_config=ok events=${eventNames.length} p0_allowlist=${p0EventNames.length} schema_version=${trackingPlan.schema_version}`);
