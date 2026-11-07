import { expect, test, type Page } from '@playwright/test';
import { fillAllSets, readStore, seedActiveProgram } from './workout-loop-helpers';

type SetRow = {
  workoutExerciseId: string;
  orderIndex: number;
  weight: number;
  reps: number;
  completedAt?: number;
  deletedAt: number | null;
};

async function startFromDashboard(page: Page) {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();
}

test('AC24: set cells are buttons and the system keyboard never opens', async ({ page }) => {
  await startFromDashboard(page);
  await expect(page.locator('[role="row"] input, [role="row"] textarea')).toHaveCount(0);
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  await expect(page.getByRole('group', { name: 'Number pad' })).toBeVisible();
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(activeTag).not.toBe('INPUT');
  expect(activeTag).not.toBe('TEXTAREA');
});

test('AC18: Add set after a removal uses last orderIndex + 1 and copies the weight', async ({
  page,
}) => {
  await startFromDashboard(page);
  await fillAllSets(page, { reps: 8, weight: 50 });
  await page.getByRole('row', { name: 'Set 2' }).focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('row', { name: /^Set \d$/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Add set' }).click();
  await expect(page.getByRole('row', { name: /^Set \d$/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Set 3 weight in kilograms' })).toHaveText('50');

  // Persistence is write-through in the background, so poll IndexedDB.
  // Removed orderIndex 1, kept 0 and 2; the new set is 3 (never the row count, 2).
  await expect
    .poll(async () => {
      const exercises = await readStore<{ id: string; exerciseRef: { exerciseId: string } }>(
        page,
        'workoutExercises',
      );
      const bench = exercises.find((e) => e.exerciseRef.exerciseId === 'barbell-bench-press')!.id;
      const sets = await readStore<SetRow>(page, 'sets');
      return sets
        .filter((s) => s.workoutExerciseId === bench && s.deletedAt == null)
        .map((s) => s.orderIndex)
        .sort((a, b) => a - b);
    })
    .toEqual([0, 2, 3]);
});

test('AC23: notes survive leaving before the debounce and a reload', async ({ page }) => {
  await startFromDashboard(page);
  await page.getByRole('textbox', { name: 'Exercise note' }).fill('Elbows tucked');
  // Leave straight away: the unmount flush must save it.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.getByRole('link', { name: 'Resume workout' }).click();
  await expect(page.getByRole('textbox', { name: 'Exercise note' })).toHaveValue('Elbows tucked');

  // Workout note from the menu sheet.
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Workout note' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('textbox').fill('Felt strong');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await readStore<{ notes?: string }>(page, 'workouts'))[0].notes).toBe(
    'Felt strong',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Workout note' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Felt strong');
});

test('AC34: finishing from the menu with unchecked sets asks, then drops only the unchecked ones', async ({
  page,
}) => {
  await startFromDashboard(page);
  await fillAllSets(page, { reps: 8, weight: 60 });
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 2 done' }).click();

  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const confirm = page.getByRole('dialog', { name: 'Finish with 4 sets not done?' });
  await expect(confirm).toContainText("Unchecked sets aren't saved.");
  await confirm.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);

  const sets = await readStore<SetRow>(page, 'sets');
  expect(sets.filter((s) => s.deletedAt == null)).toHaveLength(2);
  expect(sets.filter((s) => s.deletedAt == null).every((s) => s.completedAt != null)).toBe(true);
  // Both exercises are kept even though Cable Lateral Raise has no sets done.
  const exercises = await readStore<{ deletedAt: number | null }>(page, 'workoutExercises');
  expect(exercises.filter((e) => e.deletedAt == null)).toHaveLength(2);
  const workouts = await readStore<{ status: string; finishedAt?: number }>(page, 'workouts');
  expect(workouts[0].status).toBe('finished');
  expect(typeof workouts[0].finishedAt).toBe('number');
});

test('AC13: Previous shows the matching set of the last finished workout', async ({ page }) => {
  test.setTimeout(90_000);
  await startFromDashboard(page);
  await fillAllSets(page, { reps: 8, weight: 60 });
  for (const exercise of ['Barbell Bench Press', 'Cable Lateral Raise']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Start Push A again from its Day page.
  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await page.getByRole('link', { name: /Push A/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  const firstRow = page.getByRole('row', { name: 'Set 1' });
  await expect(firstRow).toContainText('60 kg × 8');
  await expect(firstRow).not.toContainText('\u2014');
});

test('AC4: the FAB reads Resume workout and opens the session while one runs', async ({ page }) => {
  await startFromDashboard(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Quick actions' }).click();
  await page.getByRole('dialog', { name: 'Quick actions' }).getByRole('link', { name: 'Resume workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
});

test.describe('AC41: exercise switch motion', () => {
  test('slides with the exercise-in keyframes on transform and opacity only', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await startFromDashboard(page);
    await page.getByRole('button', { name: 'Cable Lateral Raise' }).click();
    const wrapper = page.locator('.exercise-enter');
    await expect(wrapper).toHaveCount(1);
    await expect(wrapper).toHaveCSS('animation-name', 'exercise-in');
    await expect(wrapper).toHaveCSS('animation-duration', '0.32s');

    const animated = await page.evaluate(() => {
      const props = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSKeyframesRule && (rule.name === 'exercise-in' || rule.name === 'pop-in')) {
            for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
              for (let i = 0; i < frame.style.length; i++) props.add(frame.style[i]);
            }
          }
        }
      }
      return [...props].sort();
    });
    expect(animated).toEqual(['opacity', 'transform']);
  });

  test('is instant under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startFromDashboard(page);
    await page.getByRole('button', { name: 'Cable Lateral Raise' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Cable Lateral Raise' })).toBeVisible();
    const wrapper = page.locator('.exercise-enter');
    await expect(wrapper).toHaveCSS('animation-name', 'none');
    await expect(page.getByTestId('strip-indicator')).toHaveCSS('transition-duration', /^(0s|1e-05s)$/);
  });
});
