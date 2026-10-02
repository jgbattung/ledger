import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Renames the selected day through the chip + sheet. */
export async function renameDay(page: Page, name: string) {
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  const field = page.getByLabel('Day name');
  await field.fill(name);
  await field.press('Enter');
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

/** Opens the picker for the selected day, picks the rows in order and adds them. */
export async function addExercises(page: Page, search: string, names: RegExp[]) {
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
  await page.getByLabel('Search exercises').fill(search);
  for (const name of names) {
    await page.getByRole('button', { name }).click();
  }
  const noun = names.length === 1 ? 'exercise' : 'exercises';
  await page.getByRole('button', { name: `Add ${names.length} ${noun}` }).click();
  await expect(page.getByRole('tablist', { name: 'Days' })).toBeVisible();
}
