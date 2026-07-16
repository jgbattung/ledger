import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Exercise = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
);

test('LIB-2: typing "curl" filters the visible list live', async ({ page }) => {
  await page.goto('/library');

  const fullCount = exercises.length;
  await expect(page.getByText(`${fullCount} exercises`)).toBeVisible();

  await page.getByLabel('Search exercises').fill('curl');

  const expectedCount = exercises.filter((e) => e.name.toLowerCase().includes('curl')).length;
  await expect(page.getByText(`${expectedCount} exercises`)).toBeVisible();
  await expect(page.getByText('Barbell Curl', { exact: true })).toBeVisible();
});

test('LIB-3: Muscle=Chest + Equipment=Barbell combine with AND', async ({ page }) => {
  await page.goto('/library');

  await page.getByRole('button', { name: 'Muscle' }).click();
  await page.getByRole('button', { name: 'Chest' }).click();

  const chestExpected = exercises.filter((e) => e.primaryMuscles.includes('chest')).length;
  await expect(page.getByText(`${chestExpected} exercises`)).toBeVisible();

  await page.getByRole('button', { name: 'Equipment' }).click();
  await page.getByRole('button', { name: 'Barbell' }).click();

  const combinedExpected = exercises.filter(
    (e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell',
  );
  await expect(page.getByText(`${combinedExpected.length} exercises`)).toBeVisible();
  await expect(page.getByText(combinedExpected[0].name, { exact: true })).toBeVisible();
});

test('mobile scroll: the full list scrolls to its last exercise', async ({ page }) => {
  await page.goto('/library');

  const lastExercise = exercises[exercises.length - 1];
  await page.getByText(lastExercise.name, { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText(lastExercise.name, { exact: true })).toBeVisible();
});

test('sticky header regression: count line is not clipped, header stays pinned after scroll', async ({
  page,
}) => {
  await page.goto('/library');

  const header = page.locator('div.sticky.top-0').first();
  const count = page.getByText(`${exercises.length} exercises`);

  const headerBoxAtRest = await header.boundingBox();
  const countBoxAtRest = await count.boundingBox();
  expect(headerBoxAtRest).not.toBeNull();
  expect(countBoxAtRest).not.toBeNull();
  // The count line's top edge must sit at or below the header's bottom
  // edge - no overlap, so the header never clips it.
  expect(countBoxAtRest!.y).toBeGreaterThanOrEqual(
    headerBoxAtRest!.y + headerBoxAtRest!.height,
  );

  const searchField = page.getByLabel('Search exercises');
  await searchField.scrollIntoViewIfNeeded();

  const lastExercise = exercises[exercises.length - 1];
  await page.getByText(lastExercise.name, { exact: true }).scrollIntoViewIfNeeded();

  const headerBoxAfterScroll = await header.boundingBox();
  expect(headerBoxAfterScroll).not.toBeNull();
  // The header must still occupy the same position at the top of the
  // viewport after the list scrolled underneath it (real sticking, not a
  // container that never scrolls in the first place).
  expect(headerBoxAfterScroll!.y).toBeCloseTo(headerBoxAtRest!.y, 0);

  await expect(searchField).toBeVisible();
  const searchBoxAfterScroll = await searchField.boundingBox();
  expect(searchBoxAfterScroll).not.toBeNull();
  expect(searchBoxAfterScroll!.y).toBeGreaterThanOrEqual(0);
  expect(searchBoxAfterScroll!.y).toBeLessThan(200);

  // Seal-the-band invariant (missed by the assertions above, which only
  // proved the header's position was stable - true even with an open
  // padding band above it): while scrolled, the pinned header's top must
  // equal the scroll container's top, with no gap for list rows to paint
  // through.
  const mainBox = await page.evaluate(() => {
    const main = document.querySelector('main');
    const rect = main!.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  expect(headerBoxAfterScroll!.y).toBeCloseTo(mainBox.y, 0);
});

test('both themes: Library renders after switching theme in Settings', async ({ page }) => {
  await page.goto('/settings');
  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });

  await themeGroup.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Settings' }).click();
  await themeGroup.getByRole('radio', { name: 'Light' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();
});
