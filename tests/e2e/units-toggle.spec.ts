import { expect, test, type Page } from '@playwright/test';
import { doneFromSummary, readStore, seedActiveProgram } from './workout-loop-helpers';

type Unit = 'kg' | 'lb';

const BENCH = 'Barbell Bench Press';

/** Stored set rows, in a stable order for a deep comparison. */
async function storedSets(page: Page) {
  const rows = await readStore<{ id: string }>(page, 'sets');
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

/** Switches the Settings Units control and waits until the choice is persisted. */
async function setUnit(page: Page, unit: Unit) {
  await page.goto('/more/settings');
  await page.getByRole('radiogroup', { name: 'Units' }).getByRole('radio', { name: unit }).click();
  await expect
    .poll(async () => (await readStore<{ unit: Unit }>(page, 'settings'))[0]?.unit)
    .toBe(unit);
}

/**
 * LG-016 accept test (LOG-15): a logged 100 kg set reads 220.5 lb everywhere
 * after switching Settings to lb, exactly 100 kg after switching back, and
 * the stored sets never change.
 */
test('LOG-15: 100 kg shows as 220.5 lb and back as 100 kg, and stored sets never change', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedActiveProgram(page, {
    days: [
      { name: 'Push A', exercises: ['barbell-bench-press'] },
      { name: 'Push B', exercises: ['barbell-bench-press'] },
    ],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();

  // Log 100 kg x 8 on set 1 through the number pad, then finish.
  const pad = page.getByRole('group', { name: 'Number pad' });
  const key = (name: string) => pad.getByRole('button', { name, exact: true });
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  for (const digit of '100') await key(digit).click();
  await key('Next').click();
  await key('8').click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const confirm = page.getByRole('dialog', { name: /^Finish with/ });
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Finish workout' }).click();
  }
  await expect(page).toHaveURL(/\/workouts\/[^/]+$/);
  const summaryUrl = new URL(page.url()).pathname;
  await doneFromSummary(page);

  // The next session shows the 100 kg set in its Previous column.
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Set 1' })).toContainText('100 kg × 8');
  const before = await storedSets(page);

  const volume = page.locator('dl').getByText('Volume').locator('..').locator('dd');
  const history = page.getByRole('tabpanel').locator('> ul > li').first();

  // lb: 100 kg reads 220.5 lb; summary volume 800 kg reads 1,764 lb.
  await setUnit(page, 'lb');
  await page.goto('/session');
  await expect(page.getByRole('columnheader', { name: 'lb', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Set 1' })).toContainText('220.5 lb × 8');
  await expect(page.getByRole('button', { name: 'Set 1 weight in pounds' })).toHaveText('220.5');
  await page.goto('/exercises/db/barbell-bench-press?tab=history');
  await expect(history).toContainText('220.5 lb × 8');
  await page.goto(summaryUrl);
  await expect(volume).toHaveText(/^1,764\s*lb$/);

  // Back to kg: exactly 100 kg again.
  await setUnit(page, 'kg');
  await page.goto('/session');
  await expect(page.getByRole('columnheader', { name: 'kg', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Set 1' })).toContainText('100 kg × 8');
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('100');
  await page.goto('/exercises/db/barbell-bench-press?tab=history');
  await expect(history).toContainText('100 kg × 8');
  await page.goto(summaryUrl);
  await expect(volume).toHaveText(/^800\s*kg$/);

  // Toggling twice never touched the stored sets.
  expect(await storedSets(page)).toEqual(before);
});

/**
 * F2 regression (PB5): the pad stays open across in-app navigation, so a pad
 * opened in kg must follow a switch to lb. Typing 225 then stores 225 lb as
 * kg, never 225 kg.
 */
test('a pad opened in kg and kept open across a switch to lb stores 225 lb, not 225 kg', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedActiveProgram(page, { days: [{ name: 'Push A', exercises: ['barbell-bench-press'] }] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { level: 2, name: BENCH })).toBeVisible();

  const pad = page.getByRole('group', { name: 'Number pad' });
  const key = (name: string) => pad.getByRole('button', { name, exact: true });
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  await expect(pad).toBeVisible();

  // Minimize and switch to lb through client-side navigation, so the store keeps the pad.
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: /Minimize/ }).click();
  await expect(page).not.toHaveURL(/\/session$/);
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radiogroup', { name: 'Units' }).getByRole('radio', { name: 'lb' }).click();
  await expect
    .poll(async () => (await readStore<{ unit: Unit }>(page, 'settings'))[0]?.unit)
    .toBe('lb');
  await page.getByRole('link', { name: /^Open workout, / }).click();
  await expect(page).toHaveURL(/\/session$/);

  // The pad is still open; typing 225 now means 225 lb.
  await expect(pad).toBeVisible();
  for (const digit of '225') await key(digit).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await expect(page.getByRole('button', { name: 'Set 1 weight in pounds' })).toHaveText('225');

  // The workout has one exercise, so set 1 is the live set with the lowest orderIndex.
  const set1Weight = async () => {
    const rows = await readStore<{ orderIndex: number; weight: number; deletedAt?: number }>(page, 'sets');
    const live = rows.filter((row) => row.deletedAt == null).sort((a, b) => a.orderIndex - b.orderIndex);
    return live[0]?.weight;
  };
  await expect.poll(set1Weight).toBeCloseTo(102.05828325, 6);
});
