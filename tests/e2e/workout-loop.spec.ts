import { expect, test } from '@playwright/test';
import { fillAllSets, readStore, seedActiveProgram } from './workout-loop-helpers';

type Row = Record<string, unknown>;

test('start from a Workout tab day row, check every set, finish, and the day is ticked', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);

  // Rest rows open nothing; the Push A row opens the Day page.
  await page.getByRole('link', { name: /Push A/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push A' })).toBeVisible();
  await expect(page.getByText('2 exercises · 6 working sets')).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();

  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toContainText('0:00');

  // Checking a set with 0 reps does not stamp it.
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 done' })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  // Give every set reps, then check them all (both exercises).
  await fillAllSets(page, { reps: 8, weight: 60 });
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();
  for (const exercise of ['Barbell Bench Press', 'Cable Lateral Raise']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout' }).click();

  // Finish lands on the Dashboard, which now offers Pull A.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Pull A' })).toBeVisible();

  const workouts = await readStore<Row>(page, 'workouts');
  expect(workouts).toHaveLength(1);
  expect(workouts[0].status).toBe('finished');

  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark Push A not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('Dashboard Start opens the workout; Back keeps it running and Resume returns', async ({
  page,
}) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/In progress · started/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout' })).toHaveCount(0);

  // It survives a reload.
  await page.reload();
  await expect(page.getByText(/In progress · started/)).toBeVisible();
  await page.getByRole('link', { name: 'Resume workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();
});

test('the Day page shows Resume while a workout is running', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await page.getByRole('link', { name: /Push A/ }).click();
  await expect(page.getByRole('button', { name: 'Resume workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
});

test('discard leaves the day unticked and returns to the Workout tab', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard this workout?' });
  await confirm.getByRole('button', { name: 'Discard workout' }).click();

  await expect(page).toHaveURL(/\/workout$/);
  const workouts = await readStore<Row>(page, 'workouts');
  expect(workouts.map((w) => w.status)).toEqual(['discarded']);
  await expect(page.getByRole('checkbox', { name: 'Mark Push A not done' })).toHaveCount(0);
});
