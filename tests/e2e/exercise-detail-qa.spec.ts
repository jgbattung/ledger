import { expect, test, type Page } from '@playwright/test';
import { addExercises } from './program-builder-helpers';
import { seedActiveProgram } from './workout-loop-helpers';

/** Real-browser checks QA added for LG-006 on top of exercise-detail.spec.ts. */

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) <= 400;

async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('Library search keeps every typed character and the caret while the query lives in the URL', async ({
  page,
}) => {
  await page.goto('/more/library');
  const field = page.getByLabel('Search exercises');
  await field.click();
  // 50ms between keys is a fast phone typist; fill() would hide this (it sets the value once).
  await field.pressSequentially('bench press', { delay: 50 });
  await expect(field).toHaveValue('bench press');
  await expect(page).toHaveURL(/q=bench\+press/);

  // Edit in the middle: the caret must stay where the user typed.
  await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2));
  await page.keyboard.type('x', { delay: 50 });
  await expect(field).toHaveValue('bexnch press');
  expect(await field.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(3);
});

test('Android Back from the exercise page restores Library query and filters; tab switches add no history', async ({
  page,
}) => {
  await page.goto('/more');
  await page.goto('/more/library');
  await page.getByLabel('Search exercises').fill('press');
  await page.getByRole('button', { name: /^Equipment/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dumbbell', exact: true }).click();
  await expect(page).toHaveURL(/equipment=dumbbell/);
  const count = page.getByText(/^\d+ exercises?$/);
  const countText = await count.textContent();

  await page.locator('div.divide-y > a').first().click();
  await expect(page).toHaveURL(/\/exercises\/db\//);
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page).toHaveURL(/tab=history/);
  await page.getByRole('tab', { name: 'Info' }).click();

  // One system Back lands on the Library, not on a previous tab.
  await page.goBack();
  await expect(page).toHaveURL(/\/more\/library\?/);
  await expect(page.getByLabel('Search exercises')).toHaveValue('press');
  await expect(page).toHaveURL(/equipment=dumbbell/);
  await expect(count).toHaveText(countText ?? '');
});

test('a reload on ?tab=history stays on History', async ({ page }) => {
  await page.goto('/exercises/db/barbell-bench-press?tab=history');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('No sets logged yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
});

test('a dirty program editor survives Android Back from Exercise info with no prompt', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('Back Test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await addExercises(page, 'bench press', [/^Barbell Bench Press/]);

  await page.getByRole('button', { name: 'Configure Barbell Bench Press', exact: true }).click();
  await page.getByRole('dialog', { name: 'Barbell Bench Press' }).getByRole('link', { name: 'Exercise info' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Barbell Bench Press' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('tablist', { name: 'Days' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configure Barbell Bench Press', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0);
});

test('History leaves out the workout still in progress', async ({ page }) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();

  await page.getByRole('button', { name: 'Info' }).click();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('No sets logged yet')).toBeVisible();
});

test('the four session chips fit at 384px and each is at least 44px', async ({ page }) => {
  test.skip(!isMobile(page), 'mobile layout only');
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);

  const viewport = page.viewportSize()!;
  for (const name of ['Swap', 'Targets', 'Warm Up', 'Info']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width);
  }
});

test('long names, long aliases and eight secondary muscles wrap without overflow', async ({ page }) => {
  test.skip(!isMobile(page), 'mobile layout only');
  for (const id of [
    'lying-close-grip-barbell-triceps-extension-behind-the-head',
    'close-neutral-grip-seated-cable-row',
    'barbell-deadlift',
  ]) {
    await page.goto(`/exercises/db/${id}`);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    // Never truncated: the full name fits inside the heading box.
    expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await noHorizontalOverflow(page);
  }
});

test('the Library list keeps one height as rows scroll in and out (ROW_HEIGHT_PX)', async ({ page }) => {
  await page.goto('/more/library');
  const list = page.locator('div.divide-y').first();
  await expect(list.locator('> a')).toHaveCount(438);
  const heightAtTop = await list.evaluate((el) => el.getBoundingClientRect().height);
  const main = page.locator('main');
  await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(200);
  const heightAtBottom = await list.evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(heightAtBottom - heightAtTop)).toBeLessThanOrEqual(1);
  const rowHeights = await list
    .locator('> a')
    .evaluateAll((rows) => rows.slice(-10).map((row) => Math.round(row.getBoundingClientRect().height)));
  // 1px is the divide-y border on every row after the first.
  for (const h of rowHeights) expect(h).toBeGreaterThanOrEqual(56);
});

test('the program picker and swap picker rows keep their size and carry no info affordance', async ({
  page,
}) => {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole('button', { name: 'Swap' }).click();
  await expect(page).toHaveURL(/\/session\/swap\//);
  const swapRows = page.locator('ul.divide-y > li');
  await expect(swapRows.first()).toBeVisible();
  for (const h of await swapRows.evaluateAll((rows) =>
    rows.slice(0, 5).map((row) => row.getBoundingClientRect().height),
  )) {
    expect(h).toBeGreaterThanOrEqual(56);
  }
  await expect(page.locator('a[href^="/exercises/"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /info/i })).toHaveCount(0);

  await page.goto('/workout');
  await page.getByRole('link', { name: 'New program' }).or(page.getByRole('link', { name: 'Create your first program' })).first().click();
  await page.getByLabel('Program name').fill('Picker Test');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
  const pickerRows = page.locator('ul.divide-y > li');
  await expect(pickerRows.first()).toBeVisible();
  for (const h of await pickerRows.evaluateAll((rows) =>
    rows.slice(0, 5).map((row) => row.getBoundingClientRect().height),
  )) {
    expect(h).toBeGreaterThanOrEqual(56);
  }
  await expect(page.locator('a[href^="/exercises/"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /info/i })).toHaveCount(0);
});
