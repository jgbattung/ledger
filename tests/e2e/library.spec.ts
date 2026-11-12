import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram } from './workout-loop-helpers';

type Exercise = {
  id: string;
  name: string;
  aliases: string[];
  equipment: string;
  primaryMuscles: string[];
  images: string[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
);

test('LIB-2: typing "curl" filters the visible list live', async ({ page }) => {
  await page.goto('/more/library');

  const fullCount = exercises.length;
  await expect(page.getByText(`${fullCount} exercises`)).toBeVisible();

  await page.getByLabel('Search exercises').fill('curl');

  const curlMatches = exercises.filter((e) => e.name.toLowerCase().includes('curl'));
  await expect(page.getByText(`${curlMatches.length} exercises`)).toBeVisible();
  await expect(page.getByText(curlMatches[0].name, { exact: true })).toBeVisible();
});

test('LG-048: word order does not matter in search', async ({ page }) => {
  await page.goto('/more/library');

  await page.getByLabel('Search exercises').fill('bench close grip incline');

  await expect(page.getByText('Incline Close Grip Bench Press', { exact: true })).toBeVisible();
});

test('LG-048: a one-letter typo still finds dumbbell presses', async ({ page }) => {
  await page.goto('/more/library');

  await page.getByLabel('Search exercises').fill('dumbell press');

  await expect(page.getByText('Dumbbell Bench Press', { exact: true })).toBeVisible();
});

/** Clears the search field back to the full list, types a query, waits for the
 * count line to leave the unfiltered total and returns the result names in
 * display order. Clearing first means a stale count from the previous query
 * can never be read as this query's result. */
async function searchResultNames(page: Page, rows: Locator, query: string) {
  const field = page.getByLabel('Search exercises');
  const count = page.getByText(/^\d+ exercises?$/);
  await field.fill('');
  await expect(count).toHaveText(`${exercises.length} exercises`);
  await field.fill(query);
  await expect(count).not.toHaveText(`${exercises.length} exercises`);
  const total = Number((await count.textContent())!.split(' ')[0]);
  await expect(rows).toHaveCount(total);
  return rows.locator('p.text-base').allTextContents();
}

const libraryRows = (page: Page) => page.locator('div.divide-y > div');
const pickerRows = (page: Page) => page.locator('ul.divide-y > li');

/** One query in canonical order, one reordered with a typo: both must give the
 * same ranked list on every surface (AC1 + AC5 + AC7). */
const CROSS_SURFACE_QUERIES = ['cable row', 'press dumbell'];

async function libraryResults(page: Page) {
  await page.goto('/more/library');
  const results: string[][] = [];
  for (const q of CROSS_SURFACE_QUERIES) {
    results.push(await searchResultNames(page, libraryRows(page), q));
  }
  expect(results.every((r) => r.length > 0)).toBe(true);
  return results;
}

test('LG-048 AC7: the program picker returns the same ranked results as the Library', async ({
  page,
}) => {
  const expected = await libraryResults(page);

  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('Search parity');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();

  for (const [i, q] of CROSS_SURFACE_QUERIES.entries()) {
    expect(await searchResultNames(page, pickerRows(page), q), q).toEqual(expected[i]);
  }
});

test('LG-048 AC7: the swap picker returns the same ranked results as the Library', async ({
  page,
}) => {
  const expected = await libraryResults(page);

  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);

  for (const [i, q] of CROSS_SURFACE_QUERIES.entries()) {
    expect(await searchResultNames(page, pickerRows(page), q), q).toEqual(expected[i]);
  }
});

test('LG-048: a query that matches nothing shows the empty state, and clearing it restores the list', async ({
  page,
}) => {
  await page.goto('/more/library');

  await page.getByLabel('Search exercises').fill('zzzzqq');
  await expect(page.getByText('0 exercises')).toBeVisible();

  await page.getByLabel('Search exercises').fill('');
  await expect(page.getByText(`${exercises.length} exercises`)).toBeVisible();
});

test('LIB-3: Muscle=Chest + Equipment=Barbell combine with AND', async ({ page }) => {
  await page.goto('/more/library');

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
  await page.goto('/more/library');

  const lastExercise = exercises[exercises.length - 1];
  await page.getByText(lastExercise.name, { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText(lastExercise.name, { exact: true })).toBeVisible();
});

test('sticky header regression: count line is not clipped, header stays pinned after scroll', async ({
  page,
}) => {
  await page.goto('/more/library');

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

test('imageless entry renders the placeholder glyph (not a broken image) in both themes', async ({
  page,
}) => {
  // LG-047 introduced the first imageless catalog rows (net-new additions ship
  // with no photography and render a Dumbbell placeholder). Derive one from the
  // dataset - never hardcode a curated name - and prove it paints the glyph, not
  // a broken <img>, in a real browser under both themes. The jsdom component
  // test covers the img-vs-svg branch; this guards the real render pipeline +
  // design-system tokens end to end.
  const imageless = exercises.find((e) => e.images.length === 0)!;
  const rowFor = () =>
    page
      .locator('div.divide-y > div')
      .filter({ has: page.getByText(imageless.name, { exact: true }) });

  // Light theme.
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill(imageless.name);
  await expect(rowFor()).toBeVisible();
  await expect(rowFor().locator('svg')).toBeVisible();
  await expect(rowFor().locator('img')).toHaveCount(0);

  // Dark theme.
  await page.goto('/more/settings');
  await page
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Dark' })
    .click();
  await page.goto('/more/library');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByLabel('Search exercises').fill(imageless.name);
  await expect(rowFor()).toBeVisible();
  await expect(rowFor().locator('svg')).toBeVisible();
  await expect(rowFor().locator('img')).toHaveCount(0);
});

test('both themes: Library renders after switching theme in Settings', async ({ page }) => {
  await page.goto('/more/settings');
  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });

  // LG-049: the catalog is no longer a bottom tab - it is reached through More.
  const openLibrary = async () => {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'More' }).click();
    await page.getByRole('link', { name: 'Exercise Library' }).click();
  };
  const openSettings = async () => {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'More' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();
  };

  await themeGroup.getByRole('radio', { name: 'Dark' }).click();
  await openLibrary();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();

  await openSettings();
  await themeGroup.getByRole('radio', { name: 'Light' }).click();
  await openLibrary();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();
});
