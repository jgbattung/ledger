import { expect, type Page } from '@playwright/test';
import { fillAllSets, seedActiveProgram } from './workout-loop-helpers';

/**
 * Logs and finishes a two-exercise workout (Push A: bench press + lateral
 * raise, 3 sets each, 10 reps at `weight` kg) and leaves the page on its
 * summary. Returns the workout id.
 */
export async function finishedWorkout(page: Page, weight = 1000): Promise<string> {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();
  await fillAllSets(page, { reps: 10, weight });
  for (const exercise of ['Barbell Bench Press', 'Cable Lateral Raise']) {
    await page.getByRole('button', { name: exercise }).first().click();
    for (const n of [1, 2, 3]) {
      await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
    }
  }
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  return page.url().split('/').pop()!;
}

/** Types a value on the pad for one cell of the edit page, then hides the pad. */
export async function typeCell(page: Page, cell: string, keys: string[]) {
  await page.getByRole('button', { name: cell }).first().click();
  const pad = page.getByRole('group', { name: 'Number pad' });
  for (const k of keys) {
    await pad.getByRole('button', { name: k === '.' ? 'Decimal point' : k, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Hide keypad' }).click();
}
