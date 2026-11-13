import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addExercises, configureExercise, renameDay } from './program-builder-helpers';
import { fillAllSets, readStore, seedActiveProgram } from './workout-loop-helpers';

type Row = Record<string, unknown>;

const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { name });

/** Picks muscles on the two-step page: primary, then (optionally) secondary, then Done. */
async function chooseMuscles(page: Page, primary: string, secondary?: string) {
  await page.getByRole('button', { name: /^Primary/ }).click();
  await expect(heading(page, 'Primary muscles')).toBeVisible();
  if (['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(primary)) {
    await page.getByRole('radio', { name: /^Lower body/ }).click();
  }
  await page.getByRole('button', { name: new RegExp(`^${primary}`) }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'Secondary muscles')).toBeVisible();
  if (secondary) {
    await page.getByRole('radio', { name: /^Lower body/ }).click();
    await page.getByRole('button', { name: new RegExp(`^${secondary}`) }).click();
  }
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(heading(page, /New exercise|Edit exercise/)).toBeVisible();
}

/** Fills the rest of the form (the name is typed here unless already prefilled). */
async function fillForm(
  page: Page,
  opts: { name?: string; primary: string; secondary?: string; equipment?: string; mechanic: 'Compound' | 'Isolation' },
) {
  if (opts.name) await page.getByLabel('Name').fill(opts.name);
  await chooseMuscles(page, opts.primary, opts.secondary);
  if (opts.equipment) {
    await page.getByRole('button', { name: /^Equipment:/ }).click();
    await page.getByRole('dialog', { name: 'Equipment' }).getByRole('button', { name: opts.equipment }).click();
  }
  await page.getByRole('radio', { name: opts.mechanic }).click();
}

/** New program with a Legs day; leaves the page on the program editor. */
async function startProgram(page: Page) {
  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('PPL-R-UL');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page, 'PPL-R-UL')).toBeVisible();
  await renameDay(page, 'Legs');
}

/**
 * LIB-6 through the program picker: pick Barbell Squat, search "ssb squat",
 * create it from the empty state, and land back with both selected.
 */
async function addSsbSquatFromPicker(page: Page) {
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(heading(page, /^Add to /)).toBeVisible();
  await page.getByLabel('Search exercises').fill('barbell squat');
  await page.getByRole('button', { name: /^Barbell Squat/ }).first().click();

  await page.getByLabel('Search exercises').fill('ssb squat');
  await page.getByRole('link', { name: 'Create "ssb squat"' }).click();
  await expect(heading(page, 'New exercise')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('ssb squat');
  await page.getByLabel('Name').fill('SSB Squat');
  await fillForm(page, { primary: 'Quads', secondary: 'Glutes', equipment: 'Barbell', mechanic: 'Compound' });
  await page.getByRole('button', { name: 'Save exercise' }).click();

  // Back in the picker with the new exercise selected and the earlier pick intact.
  await expect(heading(page, /^Add to /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add 2 exercises' })).toBeVisible();
  const tray = page.getByRole('list', { name: 'Selected exercises' });
  await expect(tray).toContainText('Barbell Squat');
  await expect(tray).toContainText('SSB Squat');
  await page.getByRole('button', { name: 'Add 2 exercises' }).click();
  await expect(page.getByRole('tablist', { name: 'Days' })).toBeVisible();
  await expect(page.getByText('2 exercises')).toBeVisible();
}

async function saveAndActivate(page: Page) {
  await configureExercise(page, 'Barbell Squat', { sets: '3', min: '5', max: '8' });
  await configureExercise(page, 'SSB Squat', { sets: '3', min: '5', max: '8' });
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(heading(page, 'Active Program')).toBeVisible();
}

test('LIB-6: create SSB Squat from the picker, add it to a program, log it', async ({ page }) => {
  test.setTimeout(120_000);
  await startProgram(page);
  await addSsbSquatFromPicker(page);
  await saveAndActivate(page);

  const stored = await readStore<Row>(page, 'customExercises');
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    name: 'SSB Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipmentTag: 'barbell',
    mechanic: 'compound',
  });

  // Start the day and log the custom exercise.
  await page.getByRole('link', { name: /Legs/ }).first().click();
  await expect(page.getByRole('link', { name: /SSB Squat/ })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8, weight: 100 });
  for (const exercise of ['Barbell Squat', 'SSB Squat']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);

  const exercises = await readStore<{ exerciseRef: { source: string } }>(page, 'workoutExercises');
  expect(exercises.some((e) => e.exerciseRef.source === 'custom')).toBe(true);

  // Search finds it in the Library with the Custom pill.
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('ssb squat');
  const row = page.getByRole('link', { name: /^SSB Squat/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Custom');
});

test('LIB-7: delete keeps the program row, its page and its history', async ({ page }) => {
  test.setTimeout(120_000);
  await startProgram(page);
  await addSsbSquatFromPicker(page);
  await saveAndActivate(page);

  await page.getByRole('link', { name: /Legs/ }).first().click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  // Wait for the session to open before writing sets (the reload would race the navigation).
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8, weight: 100 });
  for (const exercise of ['Barbell Squat', 'SSB Squat']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Delete it from its page: the confirm names the program.
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('ssb squat');
  await page.getByRole('link', { name: /^SSB Squat/ }).click();
  await expect(heading(page, /SSB Squat/)).toBeVisible();
  await page.getByRole('button', { name: 'Exercise actions' }).click();
  await page.getByRole('button', { name: 'Delete exercise' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete SSB Squat?' });
  await expect(confirm).toContainText('It stays in 1 program (PPL-R-UL) until you remove it there.');
  await confirm.getByRole('button', { name: 'Delete exercise' }).click();
  await expect(page.getByText('Deleted', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible();

  // Gone from the Library and from the pickers.
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('ssb squat');
  await expect(page.getByText('0 exercises')).toBeVisible();
  await page.goto('/workout');
  await page.getByRole('link', { name: /PPL-R-UL/ }).first().click();
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await page.getByLabel('Search exercises').fill('ssb squat');
  await expect(page.getByRole('link', { name: 'Create "ssb squat"' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await page.getByRole('searchbox').fill('ssb squat');
  await expect(page.getByRole('link', { name: 'Create "ssb squat"' })).toBeVisible();

  // The program day still names it, with a Deleted pill, and its page opens with the logged set.
  await page.goto('/workout');
  await page.getByRole('link', { name: /Legs/ }).first().click();
  const dayRow = page.getByRole('link', { name: /SSB Squat/ });
  await expect(dayRow).toContainText('Deleted');
  await dayRow.click();
  await expect(heading(page, /SSB Squat/)).toBeVisible();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(/100 kg × 8/).first()).toBeVisible();
});

test('FAB: Create exercise saves and lands on the new page, and Back returns to the dashboard', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: 'Quick actions' })
    .click();
  await page.getByRole('link', { name: 'Create exercise' }).click();
  await expect(heading(page, 'New exercise')).toBeVisible();
  await fillForm(page, {
    name: 'Zercher Squat',
    primary: 'Quads',
    equipment: 'Barbell',
    mechanic: 'Compound',
  });
  await page.getByRole('button', { name: 'Save exercise' }).click();

  await expect(page).toHaveURL(/\/exercises\/custom\//);
  await expect(heading(page, /Zercher Squat/)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Edit renames a custom exercise and the new name shows on the program day', async ({ page }) => {
  test.setTimeout(120_000);
  await startProgram(page);
  await addSsbSquatFromPicker(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(heading(page, 'Workout Library')).toBeVisible();

  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('ssb squat');
  await page.getByRole('link', { name: /^SSB Squat/ }).click();
  await page.getByRole('button', { name: 'Exercise actions' }).click();
  await page.getByRole('button', { name: 'Edit exercise' }).click();
  await expect(heading(page, 'Edit exercise')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('SSB Squat');
  await page.getByLabel('Name').fill('SSB Box Squat');
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(heading(page, /SSB Box Squat/)).toBeVisible();

  await page.goto('/workout');
  await page.getByRole('link', { name: /PPL-R-UL/ }).click();
  await expect(page.getByRole('button', { name: 'Configure SSB Box Squat' })).toBeVisible();
});

test('Duplicate of a bundled exercise prefills "name copy"', async ({ page }) => {
  await page.goto('/exercises/db/barbell-squat');
  await page.getByRole('button', { name: 'Exercise actions' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(heading(page, 'New exercise')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Barbell Squat copy');
  await expect(page.getByRole('button', { name: /^Primary/ })).toContainText('Quads');
  await expect(page.getByRole('button', { name: /^Equipment:/ })).toContainText('Barbell');
  await expect(page.getByRole('radio', { name: 'Compound' })).toHaveAttribute('aria-checked', 'true');
});

test('the form asks before discarding changes', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: 'Quick actions' })
    .click();
  await page.getByRole('link', { name: 'Create exercise' }).click();
  await page.getByLabel('Name').fill('Half done');
  await page.getByRole('button', { name: 'Back' }).click();
  const sheet = page.getByRole('dialog', { name: 'Discard this exercise?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Half done');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('dialog', { name: 'Discard this exercise?' }).getByRole('button', { name: 'Discard' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await readStore(page, 'customExercises')).toHaveLength(0);
});

test('Save with gaps names each problem under its field and writes nothing', async ({ page }) => {
  await page.goto('/exercises/new');
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(page.getByText('Enter a name.')).toBeVisible();
  await expect(page.getByText('Pick at least one primary muscle.')).toBeVisible();
  await expect(page.getByText('Choose compound or isolation.')).toBeVisible();
  expect(await readStore(page, 'customExercises')).toHaveLength(0);
});

test('from the swap picker, Create then Save opens the Keep / Reset sheet', async ({ page }) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);
  await page.getByRole('searchbox').fill('ssb squat');
  await page.getByRole('link', { name: 'Create "ssb squat"' }).click();
  await page.getByLabel('Name').fill('SSB Squat');
  await fillForm(page, { primary: 'Quads', mechanic: 'Compound' });
  await page.getByRole('button', { name: 'Save exercise' }).click();

  const sheet = page.getByRole('dialog', { name: /Swap to SSB Squat/ });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /Reset/ }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'SSB Squat' })).toBeVisible();
});
