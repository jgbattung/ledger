import { expect, test } from '@playwright/test';
import { addExercises, configureExercise, renameDay } from './program-builder-helpers';
import { seedActiveProgram } from './program-rotation-helpers';

test('rotation: build Push / Rest / Pull, tick and untick Rest, Dashboard follows', async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Build and activate Push, Rest, Pull (complete targets).
  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('Rotation');
  await page.getByRole('button', { name: 'Continue' }).click();
  await renameDay(page, 'Push');
  await addExercises(page, 'bench press', [/^Barbell Bench Press/]);
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await renameDay(page, 'Rest');
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await renameDay(page, 'Pull');
  await addExercises(page, 'pull', [/^Pull-Up/]);
  await configureExercise(page, 'Pull-Up', { sets: '4', min: '6', max: '10' });
  await page.getByRole('tab', { name: 'Push' }).click();
  await configureExercise(page, 'Barbell Bench Press', { sets: '3', min: '8', max: '12' });
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active Program' })).toBeVisible();

  // 1. Push is up next; the rest row has an unchecked checkbox.
  await expect(page.getByText('2 workouts · 0 of 3 done')).toBeVisible();
  const items = page.getByRole('listitem');
  await expect(items.filter({ hasText: 'Push' })).toContainText('Up next');
  const rest = page.getByRole('checkbox', { name: 'Mark Rest done' });
  await expect(rest).toHaveAttribute('aria-checked', 'false');
  // Workout days have no control until they are done.
  await expect(page.getByRole('checkbox')).toHaveCount(1);

  // 2. Workout-day ticks cannot come from the UI yet (LG-010/LG-022); covered
  //    by the seeded test below and the unit tests.

  // 3. Tick Rest.
  await rest.click();
  await expect(page.getByText('2 workouts · 1 of 3 done')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Mark Rest not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // 4. The Dashboard reflects the pass: Push is still up next, 1 of 3 done.
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Day 1 of 3: 1 done' })).toBeVisible();

  // 5. Untick Rest on the Workout tab.
  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Mark Rest not done' }).click();
  await expect(page.getByText('2 workouts · 0 of 3 done')).toBeVisible();

  // The pass survives a reload.
  await page.getByRole('checkbox', { name: 'Mark Rest done' }).click();
  // Wait for the write to land (the card reloads from Dexie) before reloading.
  await expect(page.getByText('2 workouts · 1 of 3 done')).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 workouts · 1 of 3 done')).toBeVisible();
});

test('rotation: ticking the last undone rest day on the Dashboard wraps the pass', async ({
  page,
}) => {
  await seedActiveProgram(page, {
    name: 'Seeded',
    days: [
      { name: 'Push', exercises: ['barbell-bench-press'] },
      { name: 'Rest', exercises: [] },
      { name: 'Pull', exercises: ['pull-up'] },
    ],
    doneDays: ['Push', 'Pull'],
  });
  await expect(page.getByText('2 workouts · 2 of 3 done')).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rest', exact: true })).toBeVisible();
  await expect(page.getByText('Then Push')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mark rest day done' }).click();
  await expect(page.getByRole('heading', { name: 'Push', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Day 1 of 3: 0 done' })).toBeVisible();

});

test('rotation: removing a done day in the editor updates the pass on the Workout tab', async ({
  page,
}) => {
  await seedActiveProgram(page, {
    name: 'Seeded',
    days: [
      { name: 'Push', exercises: ['barbell-bench-press'] },
      { name: 'Rest', exercises: [] },
      { name: 'Pull', exercises: ['pull-up'] },
    ],
    doneDays: ['Push', 'Rest'],
  });
  await expect(page.getByText('2 workouts · 2 of 3 done')).toBeVisible();

  await page.getByRole('link', { name: /Seeded/ }).click();
  await page.getByRole('tab', { name: 'Push' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove day' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('1 workout · 1 of 2 done')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Pull' })).toContainText('Up next');
  await expect(page.getByRole('checkbox', { name: 'Mark Rest not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('rotation: a done workout day unticks only after confirming', async ({ page }) => {
  await seedActiveProgram(page, { doneDays: ['Push A'] });
  await page.getByRole('checkbox', { name: 'Mark Push A not done' }).click();
  await expect(page.getByRole('dialog', { name: 'Mark Push A not done?' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark not done' }).click();
  await expect(page.getByText('5 workouts · 0 of 6 done')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Mark Push A not done' })).toHaveCount(0);
});
