import { expect, test, type Page } from '@playwright/test';
import { readStore, seedActiveProgram } from './workout-loop-helpers';

type SetRow = {
  workoutExerciseId: string;
  orderIndex: number;
  weight: number;
  reps: number;
  rir: number;
  completedAt?: number;
  deletedAt: number | null;
};

const BENCH = 'Barbell Bench Press';

async function startPushA(page: Page) {
  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await page.getByRole('link', { name: /Push A/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
}

/** Types weight x reps into set `n` through the number pad, hides the pad and checks the set. */
async function logSet(page: Page, n: number, weight: string, reps: string) {
  const pad = page.getByRole('group', { name: 'Number pad' });
  const key = (name: string) => pad.getByRole('button', { name, exact: true });
  await page.getByRole('button', { name: `Set ${n} weight in kilograms` }).click();
  for (const digit of weight) await key(digit).click();
  await key('Next').click();
  for (const digit of reps) await key(digit).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  await expect(page.getByRole('checkbox', { name: `Mark set ${n} not done` })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

/** Finishes from the menu, confirming the "unchecked sets" prompt when it appears. */
async function finish(page: Page) {
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const confirm = page.getByRole('dialog', { name: /^Finish with/ });
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Finish workout' }).click();
  }
  await expect(page).toHaveURL(/\/$/);
}

test('LIB-10: log 100x8, and the next session pre-fills set 1 with 100 and 8', async ({ page }) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
  await logSet(page, 1, '100', '8');
  await finish(page);

  await startPushA(page);
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('100');
  await expect(page.getByRole('button', { name: /^Set 1 reps/ })).toHaveText(/^8/);

  const rows = (await readStore<SetRow>(page, 'sets')).filter(
    (s) => s.deletedAt == null && s.completedAt == null && s.orderIndex === 0 && s.weight === 100,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ weight: 100, reps: 8, rir: 0 });
});

test('row mapping: 100x8 and 90x6 come back as set 1 and set 2, matching Previous', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
  await logSet(page, 1, '100', '8');
  await logSet(page, 2, '90', '6');
  await finish(page);

  await startPushA(page);
  const first = page.getByRole('row', { name: 'Set 1' });
  const second = page.getByRole('row', { name: 'Set 2' });
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('100');
  await expect(page.getByRole('button', { name: /^Set 1 reps/ })).toHaveText(/^8/);
  await expect(page.getByRole('button', { name: 'Set 2 weight in kilograms' })).toHaveText('90');
  await expect(page.getByRole('button', { name: /^Set 2 reps/ })).toHaveText(/^6/);
  await expect(first).toContainText('100 kg × 8');
  await expect(second).toContainText('90 kg × 6');
});

test('a pre-filled set is checked with one tap, without opening the number pad', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
  await logSet(page, 1, '100', '8');
  await finish(page);

  await startPushA(page);
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('group', { name: 'Number pad' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('100');
  await expect(page.getByRole('button', { name: /^Set 1 reps/ })).toHaveText(/^8/);
});
