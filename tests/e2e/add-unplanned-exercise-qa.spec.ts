import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readStore, seedActiveProgram } from './workout-loop-helpers';

// QA coverage for LG-013: program immutability, leaving the add picker by system Back,
// and filters + scroll surviving the exercise-page round trip in the add and swap pickers.

const strip = (page: Page) => page.getByRole('navigation', { name: 'Exercises' });
const count = (page: Page) => page.getByText(/^\d+ exercises?$/);

/** Starts the named program day from the Workout tab. */
async function startDay(page: Page, day: string) {
  await seedActiveProgram(page);
  await page.getByRole('link', { name: new RegExp(day) }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
}

async function openAddPicker(page: Page) {
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await expect(page).toHaveURL(/\/session\/add$/);
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
}

/** Applies the Dumbbell equipment filter and waits for the list to settle on it. */
async function filterDumbbell(page: Page) {
  const before = await count(page).textContent();
  await page.getByRole('button', { name: /^Equipment/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dumbbell', exact: true }).click();
  await expect(page).toHaveURL(/equipment=dumbbell/);
  await expect(count(page)).not.toHaveText(before ?? '');
  return count(page).textContent();
}

/** Scrolls the shell's main and returns the offset it settled on. */
async function scrollMain(page: Page, to: number) {
  const main = page.locator('main');
  await main.evaluate((el, top) => el.scrollTo(0, top), to);
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(to - 100);
  return main.evaluate((el) => el.scrollTop);
}

/**
 * Opens the nth exercise link and returns the list offset at the moment it was tapped
 * (Playwright scrolls a partly hidden link into view before clicking, so measure after that).
 */
async function openExerciseLink(page: Page, nth: number) {
  const link = page.locator('main a[href^="/exercises/db/"]').nth(nth);
  await link.hover();
  const at = await page.locator('main').evaluate((el) => el.scrollTop);
  await link.click();
  await expect(page).toHaveURL(/\/exercises\/db\//);
  return at;
}

async function expectScroll(page: Page, before: number) {
  await expect
    .poll(async () => Math.abs((await page.locator('main').evaluate((el) => el.scrollTop)) - before))
    .toBeLessThanOrEqual(4);
}

const programTree = async (page: Page) => ({
  programs: await readStore(page, 'programs'),
  programDays: await readStore(page, 'programDays'),
  programExercises: await readStore(page, 'programExercises'),
});

test('adding and removing exercises mid-workout never changes the program', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  const before = await programTree(page);

  await openAddPicker(page);
  await page.getByLabel('Search exercises').fill('cable hammer curl');
  await page.getByRole('button', { name: /^Select Cable Hammer Curl/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Cable Hammer Curl' })).toBeVisible();

  await strip(page).getByRole('button', { name: 'Barbell Bench Press' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Remove exercise' }).click();
  await page
    .getByRole('dialog', { name: 'Remove Barbell Bench Press?' })
    .getByRole('button', { name: 'Remove exercise' })
    .click();
  await expect(strip(page).getByRole('button', { name: 'Barbell Bench Press' })).toHaveCount(0);

  await expect.poll(async () => JSON.stringify(await programTree(page))).toBe(JSON.stringify(before));

  // The Day page of the program still lists the planned exercises and not the added one.
  await page.goto('/');
  await page.getByRole('link', { name: /Push A/ }).click();
  await expect(page.getByText('Barbell Bench Press').first()).toBeVisible();
  await expect(page.getByText('Cable Hammer Curl')).toHaveCount(0);
});

test('system Back from the add picker to the session discards the picks', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await openAddPicker(page);
  await page.getByLabel('Search exercises').fill('curl');
  await page.getByRole('button', { name: /^Select Barbell Curl(?!s)/ }).click();
  await expect(page.getByRole('button', { name: 'Add 1 exercise' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/session$/);

  await openAddPicker(page);
  await expect(page.getByRole('button', { name: /^Add \d+ exercises?$/ })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Selected exercises' })).toHaveCount(0);
  await page.getByLabel('Search exercises').fill('curl');
  await expect(page.getByRole('button', { name: /^Select Barbell Curl(?!s)/ })).toBeVisible();
});

test('add picker: system Back from an exercise page keeps query, filter, picks and scroll', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await openAddPicker(page);
  await page.getByLabel('Search exercises').fill('press');
  await expect(count(page)).not.toHaveText(/^4\d\d exercises$/);
  const countText = await filterDumbbell(page);
  await page.getByRole('button', { name: /^Select Dumbbell Bench Press/ }).first().click();
  await expect(page.getByRole('button', { name: 'Add 1 exercise' })).toBeVisible();
  const urlBefore = page.url();
  expect(await scrollMain(page, 300)).toBeGreaterThan(200);
  const before = await openExerciseLink(page, 9);
  expect(before).toBeGreaterThan(0);
  await page.goBack();

  await expect(page).toHaveURL(/\/session\/add\?/);
  expect(page.url()).toBe(urlBefore);
  await expect(page.getByLabel('Search exercises')).toHaveValue('press');
  await expect(page).toHaveURL(/equipment=dumbbell/);
  await expect(count(page)).toHaveText(countText ?? '');
  await expect(page.getByRole('button', { name: 'Add 1 exercise' })).toBeVisible();
  await expectScroll(page, before);
});

test('swap picker: Back from an exercise page keeps query, filter and scroll', async ({ page }) => {
  test.setTimeout(90_000);
  await startDay(page, 'Push A');
  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);
  await page.getByRole('searchbox').fill('press');
  await expect(count(page)).not.toHaveText(/^4\d\d exercises$/);
  const countText = await filterDumbbell(page);
  const urlBefore = page.url();
  expect(await scrollMain(page, 300)).toBeGreaterThan(200);
  const before = await openExerciseLink(page, 9);
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  expect(page.url()).toBe(urlBefore);
  await expect(page.getByRole('searchbox')).toHaveValue('press');
  await expect(page).toHaveURL(/equipment=dumbbell/);
  await expect(count(page)).toHaveText(countText ?? '');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectScroll(page, before);
});
