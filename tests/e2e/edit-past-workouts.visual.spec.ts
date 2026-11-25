import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishedWorkout } from './edit-past-workouts-helpers';

/**
 * LG-015 visual gate. An artifact generator, not an assertion suite: writes
 * full-viewport PNGs of the summary and edit states (E1-E6), both themes, to
 * test-results/lg-015-screens/, plus the Ongoing Workout with the pad open to
 * confirm the shared-component refactors left it unchanged. Tagged @visual;
 * run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-015-screens');

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

async function notes(page: Page) {
  // Notes written straight into the draft keep the summary's note lines on screen.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Workout note').fill('Felt strong. Bench moved fast.');
  await page.getByLabel('Exercise note').first().fill('Pause the first rep.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual summary with Edit and notes, edit page, sheets (${scheme})`, async ({ page }) => {
      test.setTimeout(150_000);
      await finishedWorkout(page, 60);
      await notes(page);
      await expect(page.getByText('Felt strong. Bench moved fast.')).toBeVisible();
      await shot(page, 'E1-summary', scheme);

      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page).toHaveURL(/\/edit$/);
      await shot(page, 'E2-edit-top', scheme);

      await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).first().click();
      await expect(page.getByRole('group', { name: 'Number pad' })).toBeVisible();
      await shot(page, 'E3-edit-pad-weight', scheme);
      await page.getByRole('button', { name: 'Set 1 reps' }).first().click();
      await shot(page, 'E3-edit-pad-reps', scheme);
      await page.getByRole('button', { name: 'Hide keypad' }).click();

      await page.getByRole('button', { name: 'Barbell Bench Press actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'E4-exercise-sheet', scheme);
      await page.getByRole('button', { name: 'Remove exercise' }).click();
      await expect(page.getByRole('dialog', { name: /^Remove / })).toBeVisible();
      await shot(page, 'E4-remove-confirm', scheme);
      await page.getByRole('button', { name: 'Keep exercise' }).click();

      await page.getByRole('button', { name: 'Add exercise' }).scrollIntoViewIfNeeded();
      await shot(page, 'E2-edit-bottom', scheme);

      await page.getByRole('button', { name: 'Add set' }).first().click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('dialog', { name: /^Save without/ })).toBeVisible();
      await shot(page, 'E5-empty-sets-confirm', scheme);
      await page.getByRole('button', { name: 'Keep editing' }).click();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
      await shot(page, 'E6-discard-confirm', scheme);
    });

    test(`@visual add picker (${scheme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await finishedWorkout(page, 60);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: 'Add exercise' }).click();
      await page.getByRole('searchbox').fill('bench press');
      await page.getByRole('button', { name: /^Select Dumbbell Bench Press(?! with)/ }).click();
      await shot(page, 'E4-add-picker', scheme);
    });

    test(`@visual ongoing workout with the pad open, unchanged (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await finishedWorkout(page, 60);
      await page.getByRole('button', { name: 'Back' }).click();
      await page.goto('/');
      await page.getByRole('button', { name: 'Start workout' }).click();
      await expect(page).toHaveURL(/\/session$/);
      await page.getByRole('button', { name: 'Set 1 reps' }).click();
      await expect(page.getByRole('group', { name: 'Number pad' })).toBeVisible();
      await shot(page, 'S1-session-pad-reps', scheme);
    });
  });
}
