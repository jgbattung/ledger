import { expect, test } from '@playwright/test';
import { addExercises, configureExercise } from './program-builder-helpers';
import type { Page } from '@playwright/test';
import { fillAllSets, seedActiveProgram } from './workout-loop-helpers';

test('Library: open a result, read it, and Back restores query, count and scroll', async ({ page }) => {
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('curl');
  const count = page.getByText(/^\d+ exercises$/);
  await expect(count).toBeVisible();
  // The list filters on a deferred value, so wait until the count has narrowed.
  await expect(count).not.toHaveText('438 exercises');
  const countText = await count.textContent();

  // Scroll the shell's main so Back has something to restore.
  const main = page.locator('main');
  await main.evaluate((el) => el.scrollTo(0, 400));
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
  const before = await main.evaluate((el) => el.scrollTop);

  const rows = page.getByRole('link', { name: /Curl/ });
  const row = rows.nth(6);
  const name = (await row.locator('p').first().textContent()) ?? '';
  await row.click();

  await expect(page).toHaveURL(/\/exercises\/db\//);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Instructions' })).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/more\/library\?q=curl$/);
  await expect(page.getByLabel('Search exercises')).toHaveValue('curl');
  await expect(count).toHaveText(countText ?? '');
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(before - 4);
  expect(Math.abs((await main.evaluate((el) => el.scrollTop)) - before)).toBeLessThanOrEqual(4);
});

test('a bundled exercise with no photos shows no media block', async ({ page }) => {
  await page.goto('/exercises/db/cable-lateral-raise');
  await expect(page.getByRole('heading', { level: 1, name: 'Cable Lateral Raise' })).toBeVisible();
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
});

test('an unknown exercise id shows Exercise not found and Back goes to the Library', async ({ page }) => {
  await page.goto('/exercises/db/no-such-exercise');
  await expect(page.getByText('Exercise not found')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exercise actions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/more\/library$/);
});

test('the actions drawer lists the Soon rows and closes', async ({ page }) => {
  await page.goto('/exercises/db/barbell-bench-press');
  await page.getByRole('button', { name: 'Exercise actions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Barbell Bench Press' });
  await expect(dialog.getByRole('button')).toHaveCount(5); // four rows plus Close
  for (const label of ['Rest timer', 'Warm-up sets', 'Reset to defaults']) {
    await expect(dialog.getByRole('button', { name: new RegExp(label) })).toBeDisabled();
  }
  // LG-007 enabled Duplicate in place.
  await expect(dialog.getByRole('button', { name: 'Duplicate' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

/** Like fillAllSets, but only for the sets of the in-progress workout, so earlier history is untouched. */
async function fillInProgressSets(page: Page, values: { reps: number; weight: number }) {
  await page.evaluate(async (v) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = <T,>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(store, 'readonly').objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const workouts = await all<{ id: string; status: string }>('workouts');
    const live = workouts.find((w) => w.status === 'in_progress')!;
    const exercises = await all<{ id: string; workoutId: string }>('workoutExercises');
    const ids = new Set(exercises.filter((e) => e.workoutId === live.id).map((e) => e.id));
    const sets = await all<{ workoutExerciseId: string; deletedAt: number | null }>('sets');
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sets', 'readwrite');
      for (const row of sets) {
        if (row.deletedAt == null && ids.has(row.workoutExerciseId)) {
          tx.objectStore('sets').put({ ...row, reps: v.reps, weight: v.weight });
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, values);
  await page.reload();
}

async function finishPushWorkout(page: Page, weight: number, reps: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillInProgressSets(page, { reps, weight });
  await expect(page.getByRole('heading', { level: 2, name: 'Barbell Bench Press' })).toBeVisible();
  for (const n of [1, 2, 3]) {
    await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('LIB-9: sets logged across two workouts show both sessions, newest first', async ({ page }) => {
  test.setTimeout(120_000);
  await seedActiveProgram(page, {
    days: [
      { name: 'Push A', exercises: ['barbell-bench-press'] },
      { name: 'Push B', exercises: ['barbell-bench-press'] },
    ],
  });
  await finishPushWorkout(page, 60, 8);
  await finishPushWorkout(page, 62.5, 10);

  await page.goto('/exercises/db/barbell-bench-press');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page).toHaveURL(/tab=history/);

  const panel = page.getByRole('tabpanel');
  const blocks = panel.locator('> ul > li');
  await expect(blocks).toHaveCount(2);
  await expect(blocks.nth(0)).toContainText('62.5 kg × 10');
  await expect(blocks.nth(0)).toContainText('Push B');
  await expect(blocks.nth(1)).toContainText('60 kg × 8');
  await expect(blocks.nth(1)).toContainText('Push A');
  await expect(page.locator('body')).not.toContainText(/e1rm|1rm/i);
});

test('the session Info chip opens the page and Back returns with logged values intact', async ({
  page,
}) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8, weight: 60 });
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('60');

  await page.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Barbell Bench Press' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('60');
});

test('a Day page row opens the exercise page and Back returns to the Day page', async ({ page }) => {
  await seedActiveProgram(page);
  await page.getByRole('link', { name: /Push A/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push A' })).toBeVisible();
  await page.getByRole('link', { name: /Barbell Bench Press/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Barbell Bench Press' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push A' })).toBeVisible();
});

test('a dirty program editor opens Exercise info with no prompt and keeps its draft', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('Info Test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await addExercises(page, 'bench press', [/^Barbell Bench Press/, /^Incline Barbell Bench Press/]);
  await configureExercise(page, 'Barbell Bench Press', { sets: '3', min: '8', max: '12' });

  await page.getByRole('button', { name: 'Configure Incline Barbell Bench Press', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Incline Barbell Bench Press' });
  await dialog.getByRole('link', { name: 'Exercise info' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Incline Barbell Bench Press' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('tablist', { name: 'Days' })).toBeVisible();
  await expect(page.getByText('3 × 8–12 · RIR 0')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0);
});
