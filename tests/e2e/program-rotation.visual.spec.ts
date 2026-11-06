import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram } from './program-rotation-helpers';

/**
 * LG-021 visual gate. An artifact generator, not an assertion suite: writes
 * full-viewport PNGs of the rotation states, both themes, to
 * test-results/lg-021-screens/, plus the approved mockups for side-by-side
 * review. Tagged @visual; run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-021-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'program-rotation-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual workout tab (${scheme})`, async ({ page }) => {
      // Mockup 1: two days done, Legs A up next.
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A'] });
      await expect(page.getByText('5 workouts · 2 of 6 done')).toBeVisible();
      await shot(page, 'workout-tab-1-legs-next', scheme);
    });

    test(`@visual workout tab, rest skipped (${scheme})`, async ({ page }) => {
      // Mockup 2: Push B trained while Rest was up next.
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A', 'Legs A', 'Push B'] });
      await expect(page.getByText('5 workouts · 4 of 6 done')).toBeVisible();
      await shot(page, 'workout-tab-2-rest-next', scheme);
    });

    test(`@visual dashboard (${scheme})`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('No active program')).toBeVisible();
      await shot(page, 'dashboard-4-empty', scheme);

      // Mockup 3: workout day up next.
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A'] });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Legs A' })).toBeVisible();
      await shot(page, 'dashboard-3-workout', scheme);
    });

    test(`@visual dashboard rest day (${scheme})`, async ({ page }) => {
      // Mockup 4: Rest up next, Push B already done.
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A', 'Legs A', 'Push B'] });
      await page.goto('/');
      await expect(page.getByRole('checkbox', { name: 'Mark rest day done' })).toBeVisible();
      await shot(page, 'dashboard-4-rest', scheme);
    });
  });
}

test('@visual approved mockup screens, both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  for (const scheme of SCHEMES) {
    await page.evaluate(
      (dark) => (window as unknown as { setTheme: (d: boolean) => void }).setTheme(dark),
      scheme === 'dark',
    );
    const phones = page.locator('.phone');
    const count = Math.min(await phones.count(), 4);
    for (let i = 0; i < count; i++) {
      await phones.nth(i).screenshot({ path: path.join(OUT, `mockup-${i + 1}-${scheme}.png`) });
    }
  }
});
