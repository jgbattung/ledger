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

test('log a set with the number pad, including partials and RIR, and it survives a reload', async ({
  page,
}) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);

  const pad = page.getByRole('group', { name: 'Number pad' });
  const key = (name: string) => pad.getByRole('button', { name, exact: true });

  // Weight 62.5.
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  await expect(pad).toBeVisible();
  await key('6').click();
  await key('2').click();
  await key('Decimal point').click();
  await key('5').click();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('62.5');

  // Reps 8 with 2 partials and RIR 1, via Next.
  await key('Next').click();
  await key('8').click();
  await key('Partial reps').click();
  await key('2').click();
  await pad.getByRole('button', { name: 'RIR 1', exact: true }).click();
  const reps = page.getByRole('button', { name: 'Set 1 reps, RIR 1' });
  await expect(reps).toHaveText(/8\s*\|\s*2/);

  // Geometry: the pad takes at most 2/5 of the viewport and the active cell sits above it.
  const viewport = page.viewportSize()!;
  const padBox = (await pad.boundingBox())!;
  expect(padBox.height).toBeLessThanOrEqual(viewport.height * 0.4 + 1);
  expect(padBox.y + padBox.height).toBeLessThanOrEqual(viewport.height + 1);
  const cellBox = (await reps.boundingBox())!;
  expect(cellBox.y + cellBox.height).toBeLessThanOrEqual(padBox.y);

  // Next moves to set 2's weight; hide closes the pad.
  await key('Next').click();
  await expect(page.getByRole('button', { name: 'Set 2 weight in kilograms' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await expect(pad).toBeHidden();

  // Check the set, reload, and everything is still there.
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('62.5');
  await expect(page.getByRole('button', { name: 'Set 1 reps, RIR 1' })).toHaveText(/8\s*\|\s*2/);
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toBeVisible();
});

test('RIR 6+ is a distinct value and an empty reps cell shows the target range', async ({
  page,
}) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('button', { name: 'Set 1 reps' })).toHaveText('8–12');

  await page.getByRole('button', { name: 'Set 1 reps' }).click();
  const pad = page.getByRole('group', { name: 'Number pad' });
  await pad.getByRole('button', { name: '9', exact: true }).click();
  await pad.getByRole('button', { name: 'RIR 6 or more' }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set 1 reps, RIR 6+' })).toBeVisible();
});

test('swipe a set row left, tap the minus, and the rows renumber', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('row', { name: /^Set \d$/ })).toHaveCount(3);

  const row = page.getByRole('row', { name: 'Set 2' });
  const surface = row.locator('[style*="translateX"]');
  await expect(surface).toHaveCSS('touch-action', 'pan-y');
  const box = (await surface.boundingBox())!;
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 90;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 30, y, { steps: 4 });
  await page.mouse.move(startX - 70, y, { steps: 4 });
  await page.mouse.up();

  // Held open 52px, with the minus on the right edge.
  await expect(surface).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -52, 0)');
  await row.getByRole('button', { name: 'Remove set 2' }).click();

  await expect(page.getByRole('row', { name: /^Set \d$/ })).toHaveCount(2);
  await expect(page.getByRole('row', { name: 'Set 3' })).toHaveCount(0);
  const sets = await readStore<Row>(page, 'sets');
  expect(sets.filter((s) => s.deletedAt != null)).toHaveLength(1);
});

test('a set row can be removed from the keyboard with Delete', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('row', { name: 'Set 3' }).focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('row', { name: /^Set \d$/ })).toHaveCount(2);
});

test('LOG-10: swap bench to DB press keeping targets, finish, and swappedFrom is recorded', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();

  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);
  await page.getByRole('searchbox').fill('dumbbell bench press');
  // Exercises already in the workout are disabled.
  await page.getByRole('searchbox').fill('barbell bench press');
  await expect(page.getByRole('button', { name: /^Barbell Bench Press/ }).first()).toBeDisabled();
  await page.getByRole('searchbox').fill('dumbbell bench press');
  await page.getByRole('button', { name: /^Dumbbell Bench Press(?! with)/ }).click();
  const sheet = page.getByRole('dialog', { name: /Swap to Dumbbell Bench Press/ });
  await sheet.getByRole('button', { name: /Keep targets/ }).click();

  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Dumbbell Bench Press' })).toBeVisible();
  await expect(page.getByText('Swapped from Barbell Bench Press')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Set \d reps$/ })).toHaveText(['8–12', '8–12', '8–12']);

  // Log and finish.
  await fillAllSets(page, { reps: 10, weight: 30 });
  for (const exercise of ['Dumbbell Bench Press', 'Cable Lateral Raise']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);

  const exercises = await readStore<{
    exerciseRef: { exerciseId: string };
    swappedFrom?: { exerciseId: string };
  }>(page, 'workoutExercises');
  const swapped = exercises.find((e) => e.exerciseRef.exerciseId === 'dumbbell-bench-press');
  expect(swapped?.swappedFrom?.exerciseId).toBe('barbell-bench-press');
});

test('Swap is refused with an explanation once a set is checked', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8 });
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  // aria-disabled (not disabled) so the tap can explain itself; Playwright treats it as not actionable.
  await page.getByRole('button', { name: 'Swap' }).click({ force: true });
  await expect(page.getByRole('status')).toContainText('only available before any set');
  await expect(page).toHaveURL(/\/session$/);
});

test('checking the last set of an exercise moves focus to the next exercise', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8 });

  const bench = page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' });
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 2 done' }).click();
  await expect(bench).toBeVisible();

  await page.getByRole('checkbox', { name: 'Mark set 3 done' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Lateral Raise' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cable Lateral Raise' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
