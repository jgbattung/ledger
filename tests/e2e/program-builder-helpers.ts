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

/** Opens an exercise's config drawer, fills the targets and saves. */
export async function configureExercise(
  page: Page,
  name: string,
  targets: { sets: string; min: string; max: string; rest?: string },
) {
  await page.getByRole('button', { name: `Configure ${name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Sets', exact: true }).fill(targets.sets);
  await dialog.getByRole('textbox', { name: 'Rep min' }).fill(targets.min);
  await dialog.getByRole('textbox', { name: 'Rep max' }).fill(targets.max);
  if (targets.rest) await dialog.getByRole('textbox', { name: 'Rest', exact: true }).fill(targets.rest);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}
