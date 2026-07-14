import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.resolve(here, '../../data-layer.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export const businessEventNames = [
  'kob_section_view',
  'view_item_list',
  'select_item',
  'view_item',
  'kob_whatsapp_click',
  'kob_faq_search'
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

export function assertSchema(payload) {
  const valid = validate(payload);
  expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
}

export function assertNoPii(payload) {
  const forbiddenKey = /^(?:e_?mail|phone|telefone|whatsapp_(?:url|message)|message|href|full_url|inner_text|search_term|user_name)$/i;
  const forbiddenValue = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|api\.whatsapp\.com|wa\.me|whatsapp:\/\/|(?:^|[?&])(?:phone|text)=|(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4})/i;

  function visit(value, key) {
    if (key) expect(key).not.toMatch(forbiddenKey);
    if (typeof value === 'string') expect(value).not.toMatch(forbiddenValue);
    if (Array.isArray(value)) value.forEach((item) => visit(item));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
    }
  }

  visit(payload);
}
