import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { expect } from '@playwright/test';
import { parse } from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.resolve(here, '../../data-layer.schema.json'), 'utf8'));
const piiPolicy = parse(fs.readFileSync(path.resolve(here, '../../pii-denylist.yaml'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const forbiddenKeys = new Set(piiPolicy.prohibited_keys.map((key) => key.toLowerCase()));
export const collectTransportValueExemptions = piiPolicy.collect_transport_value_exemptions;
const forbiddenPatterns = piiPolicy.prohibited_value_patterns.map(({ name, regex }) => ({
  name,
  pattern: new RegExp(regex, 'i')
}));

export const businessEventNames = [
  'kob_section_view',
  'view_item_list',
  'select_item',
  'view_item',
  'kob_whatsapp_click',
  'kob_faq_search',
  'kob_faq_open',
  'kob_content_expand',
  'kob_virtual_tour_open'
];

export async function blockAnalyticsNetwork(page) {
  await page.route(/https:\/\/(?:[^/]+\.)?googletagmanager\.com\//, (route) => route.abort('blockedbyclient'));
  await page.route(/https:\/\/(?:[^/]+\.)?google-analytics\.com\//, (route) => route.abort('blockedbyclient'));
  await page.route(/https:\/\/(?:[^/]+\.)?analytics\.google\.com\//, (route) => route.abort('blockedbyclient'));
  await page.route(/https:\/\/stats\.g\.doubleclick\.net\//, (route) => route.abort('blockedbyclient'));
}

export async function startFresh(page) {
  await page.goto('/');
  await page.context().clearCookies();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
}

export async function acceptAnalytics(page) {
  const accept = page.locator('[data-cookie-action="accept"]');
  if (await accept.isVisible()) {
    await accept.click();
    await expect(page.locator('[data-cookie-consent]')).toBeHidden();
  }
}

export async function preventExternalNavigation(page) {
  await page.evaluate(() => {
    window.__kobExternalNavigations = [];
    window.open = (url) => {
      window.__kobExternalNavigations.push(String(url));
      return null;
    };
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[target="_blank"]');
      if (link) event.preventDefault();
    }, true);
  });
}

export async function getBusinessEvents(page, eventName) {
  return page.evaluate(({ names, requested }) => {
    return (window.dataLayer || []).filter((entry) => {
      if (!entry || typeof entry !== 'object' || !names.includes(entry.event)) return false;
      return !requested || entry.event === requested;
    });
  }, { names: businessEventNames, requested: eventName || null });
}

export async function getControlEvents(page, eventName) {
  return page.evaluate((requested) => {
    return (window.dataLayer || []).filter((entry) => {
      return entry && typeof entry === 'object' && entry.event === requested;
    });
  }, eventName);
}

export async function getConsentCommands(page) {
  return page.evaluate(() => {
    return (window.dataLayer || []).map((entry) => {
      if (!entry || typeof entry !== 'object' || entry[0] !== 'consent') return null;
      return Array.from(entry);
    }).filter(Boolean);
  });
}

export function parseCollectRequests(entries) {
  return entries.flatMap((entry, requestIndex) => {
    const queryPairs = [...new URL(entry.url).searchParams.entries()];
    const bodyRecords = entry.body
      ? entry.body.split(/\r?\n/).filter((record) => record.length > 0)
      : [''];

    return bodyRecords.map((bodyRecord, recordIndex) => ({
      requestIndex,
      recordIndex,
      pairs: [...queryPairs, ...new URLSearchParams(bodyRecord).entries()]
    }));
  });
}

export function collectRecordParam(record, key) {
  return record.pairs.find(([parameter]) => parameter === key)?.[1] || null;
}

export function findCollectPiiViolations(entries, options = {}) {
  const violations = new Set();

  parseCollectRequests(entries).forEach((record) => {
    record.pairs.forEach(([key, rawValue], pairIndex) => {
      const candidates = [rawValue];
      let decoded = rawValue;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          candidates.push(next);
          decoded = next;
        } catch {
          break;
        }
      }

      candidates.forEach((value) => {
        findPiiViolations({ [key]: value }, options).forEach((violation) => {
          violations.add(
            `request[${record.requestIndex}].record[${record.recordIndex}].pair[${pairIndex}]:${violation}`
          );
        });
      });
    });
  });

  return [...violations].sort();
}

export function assertSchema(payload) {
  const valid = validate(payload);
  expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
}

export function findPiiViolations(payload, {
  allowedKeys = [],
  exemptPatternKeys = {}
} = {}) {
  const violations = new Set();
  const normalizedAllowedKeys = new Set(allowedKeys.map((key) => key.toLowerCase()));
  const normalizedExemptPatternKeys = new Map(Object.entries(exemptPatternKeys).map(([name, keys]) => {
    return [name, new Set(keys.map((key) => key.toLowerCase()))];
  }));

  function visit(value, key, path) {
    if (key) {
      const normalizedKey = key.toLowerCase();
      const unprefixedKey = normalizedKey.split('.').at(-1);
      const keyIsAllowed = normalizedAllowedKeys.has(normalizedKey)
        || normalizedAllowedKeys.has(unprefixedKey);
      if (!keyIsAllowed && (forbiddenKeys.has(normalizedKey) || forbiddenKeys.has(unprefixedKey))) {
        violations.add(`key:${path}`);
      }
    }
    if (typeof value === 'string') {
      forbiddenPatterns.forEach(({ name, pattern }) => {
        const exemptKeys = normalizedExemptPatternKeys.get(name);
        const normalizedKey = key?.toLowerCase();
        const unprefixedKey = normalizedKey?.split('.').at(-1);
        const keyIsExempt = exemptKeys?.has(normalizedKey)
          || exemptKeys?.has(unprefixedKey);
        if (!keyIsExempt && pattern.test(value)) {
          violations.add(`value:${name}@${path || '$'}`);
        }
      });
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, null, `${path || '$'}[${index}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        const childPath = path ? `${path}.${childKey}` : childKey;
        visit(childValue, childKey, childPath);
      });
    }
  }

  visit(payload, null, '');
  return [...violations].sort();
}

export function assertNoPii(payload) {
  expect(findPiiViolations(payload)).toEqual([]);
}
