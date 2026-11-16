import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedActiveProgram } from './workout-loop-helpers';

/** Scrolls the shell's main and returns the offset it settled on. */
async function scrollMain(page: Page, to: number) {
  const main = page.locator('main');
  await main.evaluate((el, top) => el.scrollTo(0, top), to);
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(to - 100);
  return main.evaluate((el) => el.scrollTop);
}

test('program picker: opening an exercise page and coming back keeps query, selection, day and scroll', async ({
  page,
}) => {
  await page.goto('/programs/new');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();

  await page.getByLabel('Search exercises').fill('curl');
  const count = page.getByText(/^\d+ exercises$/);
  await expect(count).not.toHaveText('438 exercises');
  const countText = await count.textContent();
  const circle = page.getByRole('button', { name: /^Select Barbell Curl(?!s)/ });
  await circle.click();
  await expect(page.getByRole('button', { name: 'Add 1 exercise' })).toBeVisible();
  const urlBefore = page.url();
  const before = await scrollMain(page, 400);

  // Tapping a name opens its page and selects nothing.
  const link = page.getByRole('link', { name: /Curl/ }).nth(6);
  await link.click();
  await expect(page).toHaveURL(/\/exercises\/db\//);
  await page.getByRole('button', { name: 'Back' }).click();

  expect(page.url()).toBe(urlBefore);
  await expect(page.getByLabel('Search exercises')).toHaveValue('curl');
  await expect(count).toHaveText(countText ?? '');
  await expect(page.getByRole('button', { name: 'Add 1 exercise' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Deselect Barbell Curl(?!s)/ })).toBeVisible();
  await expect
    .poll(async () => Math.abs((await page.locator('main').evaluate((el) => el.scrollTop)) - before))
    .toBeLessThanOrEqual(4);
});

test('swap picker: the name opens the exercise page, the circle opens Keep / Reset', async ({ page }) => {
  test.setTimeout(90_000);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);
  await page.getByRole('searchbox').fill('curl');
  const urlBefore = page.url();

  await page.getByRole('link', { name: /^Barbell Curl(?!s)/ }).click();
  await expect(page).toHaveURL(/\/exercises\/db\//);
  await page.getByRole('button', { name: 'Back' }).click();
  expect(page.url()).toBe(urlBefore);
  await expect(page.getByRole('searchbox')).toHaveValue('curl');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: /^Select Barbell Curl(?!s)/ }).click();
  const sheet = page.getByRole('dialog', { name: /Swap to Barbell Curl/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Reset/ })).toBeVisible();
});
