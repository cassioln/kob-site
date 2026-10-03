import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const locales = [
  { path: '/onibus.html', label: 'Ônibus', pending: 'Ônibus a confirmar', consult: /Confirme/, confirmed: /ônibus 1 está confirmado/, conditional: /ônibus 2 depende/, extra: /ônibus 3 depende/ },
  { path: '/en/onibus.html', label: 'Bus', pending: 'Bus to be confirmed', consult: /Confirm/, confirmed: /Bus 1 is confirmed/, conditional: /Bus 2 requires/, extra: /Bus 3 requires/ },
  { path: '/es/onibus.html', label: 'Autobús', pending: 'Autobús por confirmar', consult: /Confirma/, confirmed: /autobús 1 está confirmado/, conditional: /autobús 2 depende/, extra: /autobús 3 depende/ }
];

async function restorePaidBooking(page, busNumber) {
  await page.route('**/api/bus-registration-status**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'confirmed', busNumber, groupName: null })
  }));
  await page.addInitScript(() => {
    sessionStorage.setItem('kob-checkout-state-v1', JSON.stringify({
      registrationId: '00000000-0000-4000-8000-000000000001',
      snapshot: {
        registrationId: '00000000-0000-4000-8000-000000000001',
        orderId: 'ORD_TEST', totalAmount: '120.00',
        passengers: [{ name: 'Pessoa de Teste' }], children: [], childrenCount: 0
      },
      savedAt: Date.now()
    }));
  });
}

for (const locale of locales) {
  for (const busNumber of [1, 2, null, 3, 'invalid']) {
    test(`${locale.path}: reserva paga com ônibus ${busNumber}`, async ({ page }) => {
      await restorePaidBooking(page, busNumber);
      await page.goto(locale.path);
      await expect(page.locator('#confirmation-panel')).toBeVisible();
      const assigned = typeof busNumber === 'number';
      await expect(page.locator('#confirmed-bus')).toHaveText(assigned ? `${locale.label} ${busNumber}` : locale.pending);
      const meeting = page.locator('#confirmed-meeting');
      const instructions = page.locator('#confirmed-instructions');
      if (busNumber === 1) {
        await expect(meeting).toContainText('06:00');
        await expect(meeting).toContainText('06:30');
        await expect(meeting).not.toContainText('07:20');
        await expect(instructions).toContainText('06:30');
        await expect(page.locator('#confirmation-panel')).not.toContainText('07:20');
        await expect(page.locator('#confirmed-operation')).toContainText(locale.confirmed);
      } else if (busNumber === 2) {
        await expect(meeting).toContainText('06:40');
        await expect(meeting).toContainText('07:20');
        await expect(meeting).not.toContainText('06:00');
        await expect(instructions).toContainText('07:20');
        await expect(page.locator('#confirmation-panel')).not.toContainText('06:00');
        await expect(page.locator('#confirmed-operation')).toContainText(locale.conditional);
      } else {
        await expect(meeting).toContainText(locale.consult);
        await expect(meeting).not.toContainText(/06:00|06:40|07:20/);
        await expect(instructions).toContainText(locale.consult);
        await expect(page.locator('#confirmation-panel')).not.toContainText(/06:00|06:40|07:20/);
        if (busNumber === 3) await expect(page.locator('#confirmed-operation')).toContainText(locale.extra);
      }
      // The support link must also work for solo bookings without a group nickname.
      await expect(page.locator('#confirmed-group .bus-confirmed__wa-btn')).toBeVisible();
      if (locale.path.startsWith('/en/') && (busNumber === 1 || busNumber === 2)) {
        await expect(meeting).toContainText('AM');
      }
    });
  }
}

test('reabrir a confirmação consulta a atribuição atual, após mudança de ônibus', async ({ page }) => {
  await restorePaidBooking(page, 1);
  await page.goto('/onibus.html');
  await expect(page.locator('#confirmed-bus')).toHaveText('Ônibus 1');
  await page.route('**/api/bus-registration-status**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'confirmed', busNumber: 2 })
  }));
  await page.reload();
  await expect(page.locator('#confirmed-bus')).toHaveText('Ônibus 2');
  await expect(page.locator('#confirmed-meeting')).toContainText('07:20');
});
