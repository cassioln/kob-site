import { expect, test } from '@playwright/test';

// Seed the shuffle so coverage includes both portrait-heavy selections and the
// landscape selection that formerly created a third, implicit mobile column.
for (const locale of ['', 'en/', 'es/']) {
  for (const seed of [1, 5]) {
    test(`mosaico 2025 preenche o mobile sem colunas extras (${locale || 'pt'}, sorteio ${seed})`, { tag: locale === '' && seed === 5 ? '@smoke' : [] }, async ({ page }) => {
      await page.addInitScript(initial => {
        localStorage.setItem('cookie_consent_status', 'denied');
        let value = initial;
        Math.random = () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
      }, seed);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`/${locale}?lang=${locale ? locale.slice(0, 2) : 'pt'}`);
      const gallery = page.locator('#gallery');
      await expect(gallery.locator('[data-highlight]')).toHaveCount(8);

      async function expectFilledMobile(allowLastCell = false) {
        const geometry = await gallery.evaluate(grid => {
          const style = getComputedStyle(grid);
          const rect = grid.getBoundingClientRect();
          const columns = style.gridTemplateColumns.split(' ').map(Number.parseFloat);
          const rowHeight = Number.parseFloat(style.gridAutoRows);
          const gap = Number.parseFloat(style.rowGap);
          const photos = [...grid.querySelectorAll('[data-memory]:not([hidden])')].map(el => el.getBoundingClientRect());
          const rows = Math.round((rect.height + gap) / (rowHeight + gap));
          const empty = [];
          for (let row = 0; row < rows; row++) {
            for (let column = 0; column < 2; column++) {
              const x = rect.left + (column + .5) * ((rect.width + gap) / 2);
              const y = rect.top + row * (rowHeight + gap) + rowHeight / 2;
              if (!photos.some(photo => x > photo.left && x < photo.right && y > photo.top && y < photo.bottom)) empty.push({ row, column });
            }
          }
          return { columns: columns.length, rows, empty, overflow: grid.scrollWidth > grid.clientWidth };
        });
        expect(geometry.columns).toBe(2);
        expect(geometry.overflow).toBe(false);
        if (allowLastCell) expect(geometry.empty.every(cell => cell.row === geometry.rows - 1)).toBe(true);
        else expect(geometry.empty).toEqual([]);
      }

      for (const width of [320, 390, 640]) {
        await page.setViewportSize({ width, height: 900 });
        await expectFilledMobile();
      }
      await page.locator('#galleryExpand').click();
      await expect(gallery.locator('[data-memory]:visible')).toHaveCount(51);
      await expectFilledMobile(true);
      await page.locator('#galleryExpand').click();
      await expect(gallery.locator('[data-memory]:visible')).toHaveCount(8);
      await expectFilledMobile();

      for (const [width, columns] of [[820, 6], [1440, 12]]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await gallery.evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length)).toBe(columns);
      }
    });
  }
}
