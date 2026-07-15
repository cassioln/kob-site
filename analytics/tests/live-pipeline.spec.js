import { expect, test } from '@playwright/test';
import {
  collectRecordParam,
  collectTransportValueExemptions,
  findCollectPiiViolations,
  parseCollectRequests
} from './helpers/analytics.js';

const COLLECTION_HOST = /^https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|analytics\.google\.com|doubleclick\.net)\//;

async function captureCollection(context) {
  const captured = [];
  await context.route(COLLECTION_HOST, async (route) => {
    const request = route.request();
    captured.push({ url: request.url(), body: request.postData() || '' });
    await route.abort('blockedbyclient');
  });
  return captured;
}

function requestParams(record) {
  return {
    event: collectRecordParam(record, 'en'),
    gcs: collectRecordParam(record, 'gcs')
  };
}

function collectionRecords(entries) {
  return parseCollectRequests(entries);
}

function piiViolations(entries) {
  return findCollectPiiViolations(entries, {
    allowedKeys: ['link_url', 'link_text'],
    exemptPatternKeys: collectTransportValueExemptions
  });
}

async function startFresh(page, context) {
  await page.goto('/');
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function waitForGtm(page) {
  await expect.poll(() => page.evaluate(() => {
    return Boolean(window.google_tag_manager?.['GTM-TK5L6TJF']);
  }), { timeout: 15_000 }).toBe(true);
}

async function acceptAndWait(page, captured) {
  await page.locator('[data-cookie-action="accept"]').click();
  await waitForGtm(page);
  await expect.poll(() => collectionRecords(captured)
    .some((record) => requestParams(record).event === 'page_view'), {
    timeout: 15_000
  }).toBe(true);
}

async function proveEnhancedMeasurement(page, context, captured) {
  const recordCountBefore = collectionRecords(captured).length;
  let destinationRequested = false;
  await context.route('https://example.com/kob-ga-safe-probe', async (route) => {
    destinationRequested = true;
    await route.abort('blockedbyclient');
  });
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.id = 'kobGaSafeProbe';
    link.href = 'https://example.com/kob-ga-safe-probe';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'KOB analytics safe probe';
    document.body.append(link);
  });

  const popupPromise = context.waitForEvent('page');
  await page.locator('#kobGaSafeProbe').click();
  const popup = await popupPromise;
  await expect.poll(() => destinationRequested, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => collectionRecords(captured).slice(recordCountBefore)
    .filter((record) => requestParams(record).event === 'click').length, {
    timeout: 10_000
  }).toBeGreaterThan(0);

  await popup.close().catch(() => null);
  await page.locator('#kobGaSafeProbe').evaluate((link) => link.remove());
  return collectionRecords(captured).slice(recordCountBefore)
    .filter((record) => requestParams(record).event === 'click').length;
}

test('@code pipeline prova EM real e bloqueia PII no clique sensível sem gate vácuo', async ({ page, context }) => {
  const captured = await captureCollection(context);
  await startFresh(page, context);
  await acceptAndWait(page, captured);

  const safeAutomaticClickCount = await proveEnhancedMeasurement(page, context, captured);
  expect(safeAutomaticClickCount).toBeGreaterThan(0);

  const recordCountBeforeSensitiveAction = collectionRecords(captured).length;
  const businessEventCountBefore = await page.evaluate(() => {
    return (window.dataLayer || []).filter((entry) => entry?.event === 'kob_whatsapp_click').length;
  });
  let navigationEvidence = null;
  await context.route(/https:\/\/api\.whatsapp\.com\/send/, async (route) => {
    const destination = new URL(route.request().url());
    navigationEvidence = {
      host: destination.host,
      path: destination.pathname,
      hasPhone: destination.searchParams.has('phone'),
      hasText: destination.searchParams.has('text')
    };
    await route.abort('blockedbyclient');
  });

  const popupPromise = context.waitForEvent('page');
  await page.locator('[data-analytics-cta-id="hero_reserve"]').click();
  const popup = await popupPromise;
  await expect.poll(() => navigationEvidence, { timeout: 10_000 }).not.toBeNull();
  await expect.poll(() => page.evaluate(() => {
    return (window.dataLayer || []).filter((entry) => entry?.event === 'kob_whatsapp_click').length;
  }), { timeout: 10_000 }).toBe(businessEventCountBefore + 1);
  await page.waitForTimeout(1_000);

  const postActionRecords = collectionRecords(captured).slice(recordCountBeforeSensitiveAction);
  const postActionAutomaticClickCount = postActionRecords
    .filter((record) => requestParams(record).event === 'click').length;
  expect(navigationEvidence).toEqual({
    host: 'api.whatsapp.com',
    path: '/send',
    hasPhone: true,
    hasText: true
  });
  expect(postActionAutomaticClickCount).toBe(0);
  expect(piiViolations(captured)).toEqual([]);
  await popup.close().catch(() => null);
});

test('@account pipeline GTM live não encaminha eventos de controle nem duplica page_view', async ({ page, context }) => {
  const captured = await captureCollection(context);
  await startFresh(page, context);
  await acceptAndWait(page, captured);
  await page.waitForTimeout(1_000);

  const events = collectionRecords(captured).map(requestParams).map((entry) => entry.event).filter(Boolean);
  expect(events.filter((event) => event.startsWith('cookie_'))).toHaveLength(0);
  expect(events.filter((event) => event === 'page_view')).toHaveLength(1);
});

test('@account pipeline GTM live restaura analytics granted após reload', async ({ page, context }) => {
  const captured = await captureCollection(context);
  await startFresh(page, context);
  await acceptAndWait(page, captured);

  captured.length = 0;
  await page.reload();
  await waitForGtm(page);
  await expect.poll(() => collectionRecords(captured)
    .some((record) => requestParams(record).event === 'page_view'), {
    timeout: 15_000
  }).toBe(true);

  const restoredPageViews = collectionRecords(captured).map(requestParams).filter((entry) => entry.event === 'page_view');
  expect(restoredPageViews).toHaveLength(1);
  expect(restoredPageViews[0].gcs).toBe('G101');
});
