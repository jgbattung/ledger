import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readStore, seedActiveProgram, doneFromSummary } from './workout-loop-helpers';

type Row = Record<string, unknown>;
type ExerciseRow = { id: string; exerciseRef: { exerciseId: string }; deletedAt: number | null; orderIndex: number };
type SetRow = {
  workoutExerciseId: string;
  weight: number;
  reps: number;
  completedAt?: number;
  deletedAt: number | null;
  unilateral?: unknown;
};

const strip = (page: Page) => page.getByRole('navigation', { name: 'Exercises' });
const pad = (page: Page) => page.getByRole('group', { name: 'Number pad' });

/** Starts the named program day from the Workout tab. */
async function startDay(page: Page, day: string) {
  await seedActiveProgram(page);
  await page.getByRole('link', { name: new RegExp(day) }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
}

/** Opens the add picker from the strip and picks the named exercises by their circles. */
async function pickFromAddPicker(page: Page, search: string, circles: RegExp[]) {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await expect(page).toHaveURL(/\/session\/add$/);
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
  await page.getByLabel('Search exercises').fill(search);
  for (const circle of circles) await page.getByRole('button', { name: circle }).click();
}

const addButton = (page: Page, count: number) =>
  page.getByRole('button', { name: `Add ${count} ${count === 1 ? 'exercise' : 'exercises'}` });

/** Logs weight x reps on set `n` through the pad and checks it. */
async function logSet(page: Page, n: number, weight: string, reps: string) {
  await page.getByRole('button', { name: `Set ${n} weight in kilograms` }).click();
  for (const digit of weight) await pad(page).getByRole('button', { name: digit, exact: true }).click();
  await pad(page).getByRole('button', { name: 'Next', exact: true }).click();
  for (const digit of reps) await pad(page).getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  // Checking the last set of an exercise moves focus on, so read the stamp from storage.
  await expect
    .poll(async () =>
      (await readStore<SetRow>(page, 'sets')).some((row) => row.weight === Number(weight) && row.completedAt != null),
    )
    .toBe(true);
}

/** Finishes from the menu, confirming the unchecked-sets prompt when it shows. */
async function finishFromMenu(page: Page) {
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const confirm = page.getByRole('dialog', { name: /Finish with \d+ sets? not done\?/ });
  await confirm.getByRole('button', { name: 'Finish workout' }).click();
  await doneFromSummary(page);
}

test('LOG-11 accept: append cable curls to a program-day workout, they save with the workout', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');

  await pickFromAddPicker(page, 'cable hammer curl', [/^Select Cable Hammer Curl/]);
  await expect(page.getByRole('button', { name: /^Add At the end/ })).toBeVisible();
  await addButton(page, 1).click();

  // Back on the session, focus is on the new exercise and it is the last tile.
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();
  const tiles = strip(page).getByRole('button');
  await expect(tiles).toHaveText(['', '', '', '']);
  await expect(tiles.nth(2)).toHaveAttribute('aria-label', 'Cable Hammer Curl');
  await expect(tiles.nth(2)).toHaveAttribute('aria-current', 'true');
  await expect(tiles.nth(3)).toHaveAttribute('aria-label', 'Add exercise');

  await logSet(page, 1, '30', '10');
  await finishFromMenu(page);

  const exercises = await readStore<ExerciseRow>(page, 'workoutExercises');
  const curl = exercises.find((row) => row.exerciseRef.exerciseId === 'cable-hammer-curl')!;
  expect(curl.deletedAt).toBeNull();
  expect(curl.orderIndex).toBe(2);
  const sets = (await readStore<SetRow>(page, 'sets')).filter(
    (row) => row.workoutExerciseId === curl.id && row.deletedAt == null,
  );
  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({ weight: 30, reps: 10 });
  expect(sets[0].completedAt).toBeDefined();
  const workouts = await readStore<Row>(page, 'workouts');
  expect(workouts[0].status).toBe('finished');

  // The exercise's own History lists the finished workout.
  await page.goto('/exercises/db/cable-hammer-curl');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(/30 kg × 10/).first()).toBeVisible();
});

test('inserting after a middle exercise lands in that strip slot and takes focus', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Pull A');

  await pickFromAddPicker(page, 'cable hammer curl', [/^Select Cable Hammer Curl/]);
  await page.getByRole('button', { name: /^Add At the end/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Where should they go?' });
  await expect(sheet.getByRole('button', { name: /^After Bent Over Barbell Row/ })).toBeVisible();
  await sheet.getByRole('button', { name: /^After Bent Over Barbell Row/ }).click();
  await expect(page.getByRole('button', { name: /^Add After Bent Over Barbell Row/ })).toBeVisible();
  await addButton(page, 1).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();
  await expect(strip(page).getByRole('button')).toHaveCount(5);
  const labels = await strip(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
  expect(labels).toEqual([
    'Pull-Up',
    'Bent Over Barbell Row',
    'Cable Hammer Curl',
    'Face Pull',
    'Add exercise',
  ]);
  await expect(strip(page).getByRole('button', { name: 'Cable Hammer Curl' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('an added exercise behaves like a planned one: sets, check-off, note, L/R, and survives a reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await pickFromAddPicker(page, 'cable hammer curl', [/^Select Cable Hammer Curl/]);
  await addButton(page, 1).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();

  // One blank set (no history); Add set adds a second.
  await expect(page.getByRole('checkbox', { name: /^Mark set \d done$/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Add set' }).click();
  await expect(page.getByRole('checkbox', { name: /^Mark set \d done$/ })).toHaveCount(2);

  await logSet(page, 1, '25', '12');
  await page.getByRole('textbox', { name: 'Exercise note' }).fill('cable at the low pulley');
  await page.getByRole('button', { name: 'L/R' }).click();
  await expect(page.getByRole('button', { name: 'L/R' })).toHaveAttribute('aria-pressed', 'true');

  // Focus is not persisted: a reload opens the first exercise, so go back to the added one.
  await page.reload();
  await strip(page).getByRole('button', { name: 'Cable Hammer Curl' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Mark set \d (not )?done$/ })).toHaveCount(2);
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Exercise note' })).toHaveValue('cable at the low pulley');
  await expect(page.getByRole('button', { name: 'L/R' })).toHaveAttribute('aria-pressed', 'true');
  await expect(strip(page).getByRole('button', { name: 'Cable Hammer Curl' })).toBeVisible();

  const exercises = await readStore<ExerciseRow>(page, 'workoutExercises');
  const curl = exercises.find((row) => row.exerciseRef.exerciseId === 'cable-hammer-curl')!;
  const sets = (await readStore<SetRow>(page, 'sets')).filter(
    (row) => row.workoutExerciseId === curl.id && row.deletedAt == null,
  );
  expect(sets).toHaveLength(2);
  expect(sets.every((row) => row.unilateral !== undefined)).toBe(true);
});

test('removing a planned exercise with a logged set: confirm, finish, and it is absent', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await logSet(page, 1, '60', '8');

  await page.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('dialog', { name: 'Barbell Bench Press' });
  await expect(sheet.getByText('Changes apply to this workout only.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Remove exercise' }).click();
  const confirm = page.getByRole('dialog', { name: 'Remove Barbell Bench Press?' });
  await expect(confirm.getByText('Its 1 logged set is removed from this workout too.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Remove exercise' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Cable Lateral Raise' })).toBeVisible();
  await expect(strip(page).getByRole('button', { name: 'Barbell Bench Press' })).toHaveCount(0);
  await finishFromMenu(page);

  const exercises = await readStore<ExerciseRow>(page, 'workoutExercises');
  const bench = exercises.find((row) => row.exerciseRef.exerciseId === 'barbell-bench-press')!;
  expect(bench.deletedAt).not.toBeNull();
  const benchSets = (await readStore<SetRow>(page, 'sets')).filter((row) => row.workoutExerciseId === bench.id);
  expect(benchSets.length).toBeGreaterThan(0);
  expect(benchSets.every((row) => row.deletedAt != null)).toBe(true);

  // Nothing of it reaches the exercise's History.
  await page.goto('/exercises/db/barbell-bench-press');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(/60 kg × 8/)).toHaveCount(0);
});

test('the only exercise left cannot be removed: a hint explains and nothing is removed', async ({ page }) => {
  await startDay(page, 'Push B');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await expect(page.getByRole('status')).toContainText('This is the only exercise.');
  await expect(page.getByRole('dialog', { name: /^Remove / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(strip(page).getByRole('button')).toHaveCount(2);
});

test('add picker round trip through an exercise page keeps query, picks and scroll', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await pickFromAddPicker(page, 'curl', [/^Select Barbell Curl(?!s)/]);
  const count = page.getByText(/^\d+ exercises$/);
  await expect(count).not.toHaveText('438 exercises');
  const countText = await count.textContent();
  await expect(addButton(page, 1)).toBeVisible();
  const urlBefore = page.url();

  const main = page.locator('main');
  await main.evaluate((el) => el.scrollTo(0, 400));
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
  const before = await main.evaluate((el) => el.scrollTop);

  await page.getByRole('link', { name: /Curl/ }).nth(6).click();
  await expect(page).toHaveURL(/\/exercises\/db\//);
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  expect(page.url()).toBe(urlBefore);
  await expect(page.getByLabel('Search exercises')).toHaveValue('curl');
  await expect(count).toHaveText(countText ?? '');
  await expect(addButton(page, 1)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Deselect Barbell Curl(?!s)/ })).toBeVisible();
  await expect
    .poll(async () => Math.abs((await main.evaluate((el) => el.scrollTop)) - before))
    .toBeLessThanOrEqual(4);
});

test('Create new exercise from the add picker returns with it selected, then Add puts it in the workout', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises').fill('zq cable fly');
  await page.getByRole('link', { name: 'Create "zq cable fly"' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('zq cable fly');
  await page.getByLabel('Name').fill('ZQ Cable Fly');
  await page.getByRole('button', { name: /^Primary/ }).click();
  await page.getByRole('button', { name: /^Chest/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('radio', { name: 'Isolation' }).click();
  await page.getByRole('button', { name: 'Save exercise' }).click();

  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
  await expect(addButton(page, 1)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Selected exercises' })).toContainText('ZQ Cable Fly');
  await addButton(page, 1).click();
  await expect(page.getByRole('heading', { level: 2, name: 'ZQ Cable Fly' })).toBeVisible();
});
