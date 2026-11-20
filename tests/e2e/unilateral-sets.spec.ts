import { expect, test, type Page } from '@playwright/test';
import { readStore, seedActiveProgram, doneFromSummary } from './workout-loop-helpers';

type SetRow = {
  workoutExerciseId: string;
  orderIndex: number;
  weight: number;
  reps: number;
  partialReps?: number;
  unilateral?: {
    leftWeight: number;
    leftReps: number;
    rightWeight: number;
    rightReps: number;
  };
  completedAt?: number;
  deletedAt: number | null;
};

const BENCH = 'Barbell Bench Press';

const pad = (page: Page) => page.getByRole('group', { name: 'Number pad' });
const key = (page: Page, name: string) => pad(page).getByRole('button', { name, exact: true });
const cell = (page: Page, label: string | RegExp) => page.getByRole('button', { name: label });

async function type(page: Page, digits: string) {
  for (const digit of digits) await key(page, digit).click();
}

/**
 * Logs one L/R set through the pad and asserts Next walks L kg -> L reps ->
 * R kg -> R reps, then hides the pad and checks the set.
 */
async function logSides(
  page: Page,
  n: number,
  left: { weight: string; reps: string },
  right: { weight: string; reps: string },
) {
  await cell(page, `Set ${n} left weight in kilograms`).click();
  await type(page, left.weight);
  await key(page, 'Next').click();
  await expect(cell(page, new RegExp(`^Set ${n} left reps`))).toHaveAttribute(
    'aria-current',
    'true',
  );
  await type(page, left.reps);
  await key(page, 'Next').click();
  await expect(cell(page, `Set ${n} right weight in kilograms`)).toHaveAttribute(
    'aria-current',
    'true',
  );
  await type(page, right.weight);
  await key(page, 'Next').click();
  await expect(cell(page, `Set ${n} right reps`)).toHaveAttribute('aria-current', 'true');
  await type(page, right.reps);
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  await expect(page.getByRole('checkbox', { name: `Mark set ${n} not done` })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const confirm = page.getByRole('dialog', { name: /^Finish with/ });
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Finish workout' }).click();
  }
  await doneFromSummary(page);
}

test('LG-012: log L/R sets, persist, merge confirm, history and next-session carry', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();

  const chip = page.getByRole('button', { name: 'L/R', exact: true });
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // LOG-4: L 20x12 / R 20x10 persist and display, also after a reload.
  await logSides(page, 1, { weight: '20', reps: '12' }, { weight: '20', reps: '10' });
  await page.reload();
  await expect(cell(page, 'Set 1 left weight in kilograms')).toHaveText('20');
  await expect(cell(page, /^Set 1 left reps/)).toContainText('12');
  await expect(cell(page, 'Set 1 right weight in kilograms')).toHaveText('20');
  await expect(cell(page, 'Set 1 right reps')).toHaveText('10');

  // Differing weights: both sides display, the aggregate is the heavier side (LOG-6).
  await logSides(page, 2, { weight: '20', reps: '12' }, { weight: '22', reps: '10' });
  await expect(cell(page, 'Set 2 left weight in kilograms')).toHaveText('20');
  await expect(cell(page, 'Set 2 right weight in kilograms')).toHaveText('22');
  await expect(cell(page, 'Set 2 right reps')).toHaveText('10');

  const stored = (await readStore<SetRow>(page, 'sets'))
    .filter((s) => s.deletedAt == null && s.completedAt != null)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  expect(stored).toHaveLength(2);
  expect(stored[0].unilateral).toEqual({
    leftWeight: 20,
    leftReps: 12,
    rightWeight: 20,
    rightReps: 10,
  });
  expect(stored[0]).toMatchObject({ weight: 20, reps: 10 });
  expect(stored[0].partialReps).toBeUndefined();
  expect(stored[1].unilateral).toEqual({
    leftWeight: 20,
    leftReps: 12,
    rightWeight: 22,
    rightReps: 10,
  });
  expect(stored[1]).toMatchObject({ weight: 22, reps: 10 });

  // Turning L/R off with differing sides asks first; Keep L/R changes nothing.
  await chip.click();
  const confirm = page.getByRole('dialog', { name: 'Log both sides together?' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('set 1 becomes 20 kg × 10');
  await confirm.getByRole('button', { name: 'Keep L/R' }).click();
  await expect(confirm).toBeHidden();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(cell(page, 'Set 2 right weight in kilograms')).toHaveText('22');

  await finish(page);

  // History shows both sides on one line.
  await page.goto('/exercises/db/barbell-bench-press');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(/L 20 kg × 12 · R 20 kg × 10/)).toBeVisible();
  await expect(page.getByText(/L 20 kg × 12 · R 22 kg × 10/)).toBeVisible();

  // Next session opens in L/R, pre-filled per side from last session.
  await page.goto('/workout');
  await page.getByRole('link', { name: /Push A/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
  await expect(page.getByRole('button', { name: 'L/R', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(cell(page, 'Set 1 left weight in kilograms')).toHaveText('20');
  await expect(cell(page, /^Set 1 left reps/)).toContainText('12');
  await expect(cell(page, 'Set 1 right reps')).toHaveText('10');
  await expect(cell(page, 'Set 2 right weight in kilograms')).toHaveText('22');
  await expect(page.getByRole('row', { name: 'Set 1' })).toContainText('20 kg × 12');

  // Confirming the merge plays the Sheet close animation (it stays mounted in the
  // closed state for a moment) and merges every differing set to its heavier side.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const nextChip = page.getByRole('button', { name: 'L/R', exact: true });
  await nextChip.click();
  const merge = page.getByRole('dialog', { name: 'Log both sides together?' });
  await expect(merge).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __mergeClosedSeen?: boolean };
    w.__mergeClosedSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[role="dialog"][data-state="closed"]')) w.__mergeClosedSeen = true;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await merge.getByRole('button', { name: 'Log both sides together' }).click();
  await expect(merge).toBeHidden();
  expect(
    await page.evaluate(() => (window as unknown as { __mergeClosedSeen?: boolean }).__mergeClosedSeen),
  ).toBe(true);
  await expect(nextChip).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 'Set 1 weight in kilograms')).toHaveText('20');
  await expect(cell(page, /^Set 1 reps/)).toContainText('10');
  await expect(cell(page, 'Set 2 weight in kilograms')).toHaveText('22');
  await expect(cell(page, /^Set 2 reps/)).toContainText('10');
});
