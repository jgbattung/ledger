import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram } from './workout-loop-helpers';

/**
 * LG-017 visual gate. An artifact generator, not an assertion suite: writes
 * full-viewport PNGs of the rest timer surfaces, both themes, to
 * test-results/lg-017-screens/, plus the approved mockup phones (S1-S4) for
 * side-by-side review. Tagged @visual; run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-017-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'rest-timer-core-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

async function startWorkout(page: Page) {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();
}

async function checkFirstSet(page: Page) {
  const pad = page.getByRole('group', { name: 'Number pad' });
  await page.getByRole('button', { name: 'Set 1 reps' }).click();
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await pad.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

/** Starts a 3:00 rest by checking a set, then moves the clock to 1:45 left (58%). */
async function restingAt145(page: Page) {
  await checkFirstSet(page);
  await page.clock.runFor(75_000);
  await expect(page.getByRole('button', { name: /^Rest timer, 1:4\d left$/ })).toBeVisible();
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.clock.install({ time: new Date('2026-11-10T10:00:00') });
    });

    test(`@visual S1 session top bar resting (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await startWorkout(page);
      await restingAt145(page);
      await shot(page, 'S1-top-bar-resting', scheme);
    });

    test(`@visual S2 rest sheet resting, and the strip scrolled (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await startWorkout(page);
      await restingAt145(page);
      await page.getByRole('button', { name: /^Rest timer, / }).click();
      const sheet = page.getByRole('dialog', { name: 'Rest timer' });
      await expect(sheet).toBeVisible();
      await shot(page, 'S2-sheet-resting', scheme);

      // Free scroll: move partway and tap nothing. The position must hold where it was left.
      const strip = sheet.getByRole('group', { name: 'Rest time presets' });
      const before = await strip.evaluate((el) => el.scrollLeft);
      await strip.evaluate((el) => (el.scrollLeft = 37));
      await page.waitForTimeout(400);
      expect(await strip.evaluate((el) => el.scrollLeft)).toBe(37);
      expect(before).not.toBe(37);
      await shot(page, 'S2b-strip-scrolled-partway', scheme);

      // Tapping a pill must not re-centre the strip. (A DOM click: Playwright's own click
      // would scroll the pill into view first and disturb the position being measured.)
      await sheet.getByRole('button', { name: 'Rest 1:15' }).evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(400);
      expect(await strip.evaluate((el) => el.scrollLeft)).toBe(37);
      await shot(page, 'S2c-pill-pressed-no-recentre', scheme);
    });

    test(`@visual S3 rest sheet idle, Skip disabled (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await startWorkout(page);
      await page.getByRole('button', { name: 'Rest timer, not running' }).click();
      await expect(page.getByRole('dialog', { name: 'Rest timer' })).toBeVisible();
      await shot(page, 'S3-sheet-idle', scheme);
    });

    test(`@visual S4 dashboard with the floating bar resting (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await startWorkout(page);
      await restingAt145(page);
      await page.getByRole('button', { name: 'Back' }).click();
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Open workout, Push A' })).toContainText('Rest 1:4');
      await shot(page, 'S4-dashboard-bar-resting', scheme);
    });
  });
}

test('@visual approved mockups S1-S4, both themes', async ({ page }) => {
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  for (const scheme of SCHEMES) {
    await page.getByRole('button', { name: scheme === 'light' ? 'Light' : 'Dark', exact: true }).click();
    const phones = page.locator('.phones .phone');
    const count = await phones.count();
    for (let i = 0; i < count; i++) {
      await phones
        .nth(i)
        .screenshot({ path: path.join(OUT, `mockup-S${i + 1}-${scheme}.png`) });
    }
  }
});
