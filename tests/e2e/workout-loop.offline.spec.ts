import { expect, test } from '@playwright/test';
import { readStore, seedActiveProgram } from './workout-loop-helpers';

// Offline is the normal state in the gym: the whole program workout loop must
// run with the network off. Runs against `vite preview` of the prod build
// (offline-chrome project), so a service worker serves the app shell.
test('the program workout loop runs end to end while offline', async ({ page, context }) => {
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

  // Log set 1 with the pad and check it.
  const pad = page.getByRole('group', { name: 'Number pad' });
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  await pad.getByRole('button', { name: '6', exact: true }).click();
  await pad.getByRole('button', { name: '0', exact: true }).click();
  await pad.getByRole('button', { name: 'Next', exact: true }).click();
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Writes go through to IndexedDB in the background; wait for the stamp.
  await expect
    .poll(async () =>
      (await readStore<{ completedAt?: number }>(page, 'sets')).some((s) => s.completedAt != null),
    )
    .toBe(true);

  // An offline reload keeps the workout.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('60');
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toBeVisible();

  // Finish (unchecked sets are dropped) and land on the Dashboard, still offline.
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page
    .getByRole('dialog', { name: /Finish with \d+ sets not done\?/ })
    .getByRole('button', { name: 'Finish workout' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Pull A' })).toBeVisible();

  const workouts = await readStore<{ status: string }>(page, 'workouts');
  expect(workouts.map((w) => w.status)).toEqual(['finished']);
});
