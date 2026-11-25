import { expect, test } from '@playwright/test';
import { finishedWorkout, typeCell } from './edit-past-workouts-helpers';

/**
 * LG-015 accept test (LOG-13): a past workout holds a typo'd 1000 kg set;
 * editing it to 80 kg and saving updates the summary's volume.
 */
test('fix a typo\'d 1000 kg set from the summary and the volume updates', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  const volume = page.locator('dl').getByText('Volume').locator('..').locator('dd');
  const before = await volume.innerText();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await typeCell(page, 'Set 1 weight in kilograms', ['8', '0']);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  await expect(volume).not.toHaveText(before);
});

test('Cancel with changes asks, and discarding leaves the workout unchanged', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  const volume = page.locator('dl').getByText('Volume').locator('..').locator('dd');
  const before = await volume.innerText();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await typeCell(page, 'Set 1 weight in kilograms', ['8', '0']);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  await expect(volume).toHaveText(before);
});

test('Cancel without changes leaves silently', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('an empty set asks before saving and is not saved', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Add set' }).first().click();
  await typeCell(page, 'Set 4 weight in kilograms', ['5']);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog', { name: 'Save without 1 empty set?' })).toBeVisible();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
});

test('the last exercise cannot be removed, another can', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Barbell Bench Press actions' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await expect(page.getByRole('button', { name: 'Barbell Bench Press actions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cable Lateral Raise actions' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await expect(page.getByRole('status')).toHaveText('A workout needs at least one exercise.');
});

test('adding an exercise through the picker keeps the draft, and Save writes it', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await typeCell(page, 'Set 1 weight in kilograms', ['8', '0']);
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await expect(page).toHaveURL(/\/edit\/add$/);
  await page.getByRole('searchbox').fill('barbell curl');
  await page.getByRole('button', { name: /^Select Barbell Curl/ }).first().click();
  await page.getByRole('button', { name: /^Add 1 exercise/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByRole('region', { name: /Barbell Curl/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' }).first()).toHaveText('80');
  await page.getByRole('region', { name: /Barbell Curl/ }).getByRole('button', { name: /^Set 1 reps/ }).click();
  await page.getByRole('group', { name: 'Number pad' }).getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  await expect(page.getByRole('heading', { name: /Barbell Curl/ })).toBeVisible();
});

test('system Back with unsaved changes asks to discard', async ({ page }) => {
  test.setTimeout(120_000);
  await finishedWorkout(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await typeCell(page, 'Set 1 weight in kilograms', ['8', '0']);
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page).toHaveURL(/\/edit$/);
});
