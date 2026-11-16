import { expect, test } from '@playwright/test';
import { readStore, seedActiveProgram } from './workout-loop-helpers';

// Adding an exercise mid-workout is part of the gym loop, so it must work with
// the network off. Runs against `vite preview` of the prod build (offline-chrome).
test('adding and removing exercises mid-workout works while offline', async ({ page, context }) => {
  test.setTimeout(120_000);

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 120_000,
  });

  await context.setOffline(true);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);

  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises').fill('cable hammer curl');
  await page.getByRole('button', { name: /^Select Cable Hammer Curl/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('navigation', { name: 'Exercises' }).getByRole('button', { name: 'Cable Hammer Curl' }),
  ).toBeVisible();

  // Remove the first planned exercise, still offline.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await page
    .getByRole('dialog', { name: /^Remove / })
    .getByRole('button', { name: 'Remove exercise' })
    .click();
  await expect
    .poll(async () =>
      (await readStore<{ deletedAt: number | null }>(page, 'workoutExercises')).filter(
        (row) => row.deletedAt != null,
      ).length,
    )
    .toBe(1);
  await expect(page.getByRole('navigation', { name: 'Exercises' }).getByRole('button')).toHaveCount(
    // two planned (one removed) + the added one + the + tile
    3,
  );
});
