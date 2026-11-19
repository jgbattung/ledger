import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram, doneFromSummary } from './workout-loop-helpers';

/**
 * LG-012 visual gate. An artifact generator: writes full-viewport PNGs of
 * M1 (chip off), M2 (L/R on, mid-set with the pad), M3 (History) and M4
 * (merge confirm), both themes, at 384px, to test-results/lg-012-screens/.
 * Compare each with .lavish/unilateral-sets-alignment.html. Tagged @visual;
 * run with `npm run test:visual -- unilateral-sets.visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-012-screens');

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

const pad = (page: Page) => page.getByRole('group', { name: 'Number pad' });

async function type(page: Page, digits: string) {
  for (const digit of digits) {
    await pad(page).getByRole('button', { name: digit, exact: true }).click();
  }
}

async function next(page: Page) {
  await pad(page).getByRole('button', { name: 'Next', exact: true }).click();
}

for (const scheme of SCHEMES) {
  test(`@visual unilateral sets M1-M4 (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await seedActiveProgram(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();

    // M1: chip off.
    await shot(page, 'm1-chip-off', scheme);

    // M2: L/R on, set 1 logged L 20x12 / R 22x10, set 2 editing its L reps.
    const chip = page.getByRole('button', { name: 'L/R', exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Set 1 left weight in kilograms' }).click();
    await type(page, '20');
    await next(page);
    await type(page, '12');
    await next(page);
    await type(page, '22');
    await next(page);
    await type(page, '10');
    await page.getByRole('button', { name: 'Hide keypad' }).click();
    await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
    await page.getByRole('button', { name: 'Set 2 left weight in kilograms' }).click();
    await type(page, '20');
    await next(page);
    await type(page, '11');
    await shot(page, 'm2-lr-on-mid-set', scheme);

    // M4: differing sides, turn L/R off.
    await page.getByRole('button', { name: 'Hide keypad' }).click();
    await chip.click();
    await expect(page.getByRole('dialog', { name: 'Log both sides together?' })).toBeVisible();
    await shot(page, 'm4-merge-confirm', scheme);
    await page.getByRole('button', { name: 'Keep L/R' }).click();

    // M3: finish, then the exercise History tab.
    await page.getByRole('button', { name: 'Workout menu' }).click();
    await page.getByRole('button', { name: 'Finish workout' }).click();
    const confirm = page.getByRole('dialog', { name: /^Finish with/ });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: 'Finish workout' }).click();
    }
    await doneFromSummary(page);
    await page.goto('/exercises/db/barbell-bench-press');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText(/L 20 kg × 12 · R 22 kg × 10/)).toBeVisible();
    await shot(page, 'm3-history', scheme);
  });
}
