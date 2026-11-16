import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram } from './workout-loop-helpers';

/**
 * LG-013 visual gate. An artifact generator: writes full-viewport PNGs of the
 * S1-S6 screens (strip + tile, add picker with selection and position row,
 * position sheet, added exercise with the More chip, session exercise sheet,
 * remove confirm), both themes, at 384px, to test-results/lg-013-screens/,
 * plus the approved mockup phones for side-by-side review. Every shot also
 * asserts the page has no horizontal overflow. Tagged @visual; run with
 * `npm run test:visual -- add-unplanned-exercise.visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-013-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'add-unplanned-exercise-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main: (() => {
      const main = document.querySelector('main');
      return main ? main.scrollWidth - main.clientWidth : 0;
    })(),
  }));
  expect(overflow.page, `${name} page overflow`).toBeLessThanOrEqual(0);
  expect(overflow.main, `${name} main overflow`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

for (const scheme of SCHEMES) {
  test(`@visual add unplanned exercise S1-S6 (${scheme})`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await seedActiveProgram(page);
    await page.getByRole('link', { name: /Pull A/ }).click();
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();

    // S1: the strip with the + tile after the last exercise.
    await shot(page, 's1-strip-add-tile', scheme);

    // S2: the picker with two picks and the position row.
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Search exercises').fill('curl');
    await page.getByRole('button', { name: /^Select Cable Hammer Curl/ }).click();
    await page.getByRole('button', { name: /^Select Barbell Curl(?!s)/ }).click();
    await expect(page.getByRole('button', { name: 'Add 2 exercises' })).toBeVisible();
    await shot(page, 's2-add-picker', scheme);

    // S3: the position sheet.
    await page.getByRole('button', { name: /^Add At the end/ }).click();
    await expect(page.getByRole('dialog', { name: 'Where should they go?' })).toBeVisible();
    await shot(page, 's3-position-sheet', scheme);

    // S4: added after Bent Over Barbell Row; focus on the first new exercise, More chip scrolled into view.
    await page.getByRole('button', { name: /^After Bent Over Barbell Row/ }).click();
    await page.getByRole('button', { name: 'Add 2 exercises' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();
    await page.getByRole('button', { name: 'More' }).scrollIntoViewIfNeeded();
    await shot(page, 's4-added-with-more-chip', scheme);

    // S5: the session exercise sheet.
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog', { name: 'Cable Hammer Curl' })).toBeVisible();
    await shot(page, 's5-exercise-actions', scheme);

    // S6: the remove confirm.
    await page.getByRole('button', { name: 'Remove exercise' }).click();
    await expect(page.getByRole('dialog', { name: 'Remove Cable Hammer Curl?' })).toBeVisible();
    await shot(page, 's6-remove-confirm', scheme);
  });
}

test('@visual add unplanned exercise mockup phones', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  for (const scheme of SCHEMES) {
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), scheme);
    const phones = page.locator('.phone');
    const count = await phones.count();
    for (let i = 0; i < count; i++) {
      await phones.nth(i).screenshot({ path: path.join(OUT, `mockup-s${i + 1}-${scheme}.png`) });
    }
  }
});
