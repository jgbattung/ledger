import { expect, test, type Page } from '@playwright/test';
import { readStore, seedActiveProgram } from './workout-loop-helpers';

type Row = Record<string, unknown>;

const bar = (page: Page) => page.getByRole('link', { name: 'Open workout, Push A' });
const clock = (page: Page) => page.getByLabel(/^Workout duration/).first();

async function startFromDashboard(page: Page) {
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
}

async function logAndCheckSet(page: Page, n: number) {
  const pad = page.getByRole('group', { name: 'Number pad' });
  await page.getByRole('button', { name: `Set ${n} reps` }).click();
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await pad.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  await expect(page.getByRole('checkbox', { name: `Mark set ${n} not done` })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

test('LOG-14: a paused workout survives a force-close; the bar restores it and a checked set resumes it', async ({
  context,
}) => {
  test.setTimeout(90_000);
  let page = await context.newPage();
  await startFromDashboard(page);
  await logAndCheckSet(page, 1);

  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(page.getByLabel('Workout duration, paused')).toBeVisible();
  await expect
    .poll(async () => (await readStore<Row>(page, 'workouts'))[0].pausedAt)
    .not.toBeNull();

  // Force-close: drop the page and open a fresh one in the same browser context.
  await page.close();
  page = await context.newPage();
  await page.goto('/');

  await expect(bar(page)).toBeVisible();
  await expect(page.getByLabel('Workout duration, paused')).toBeVisible();
  const frozen = await clock(page).textContent();
  await page.waitForTimeout(2000);
  expect(await clock(page).textContent()).toBe(frozen);

  // Tapping the bar restores the full state, still paused.
  await bar(page).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByLabel('Workout duration, paused')).toBeVisible();

  // Checking another set starts the clock again.
  await logAndCheckSet(page, 2);
  await expect(page.getByLabel('Workout duration', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await readStore<Row>(page, 'workouts'))[0].pausedAt)
    .toBeNull();
});

test('Stop on the Workout tab confirms, discards in place, and the discarded sets are never Previous', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startFromDashboard(page);
  await logAndCheckSet(page, 1);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('link', { name: 'Workout', exact: true }).click();
  await expect(page).toHaveURL(/\/workout$/);

  // Keep workout leaves everything alone.
  await page.getByRole('button', { name: 'Discard workout' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard this workout?' });
  await confirm.getByRole('button', { name: 'Keep workout' }).click();
  await expect(bar(page)).toBeVisible();

  // Confirming discards and stays put.
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await confirm.getByRole('button', { name: 'Discard workout' }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/workout$/);
  expect((await readStore<Row>(page, 'workouts')).map((w) => w.status)).toEqual(['discarded']);
  await expect(page.getByRole('checkbox', { name: 'Mark Push A not done' })).toHaveCount(0);

  // A new workout of the same day shows no Previous from the discarded one.
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('row', { name: 'Set 1' }).getByRole('cell').nth(2)).toHaveText('–');
});

test('Minimize goes to the last tab, or the Dashboard on a cold start', async ({ page }) => {
  await startFromDashboard(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('link', { name: 'Levels', exact: true }).click();
  await expect(page).toHaveURL(/\/levels$/);
  await bar(page).click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: /Minimize/ }).click();
  await expect(page).toHaveURL(/\/levels$/);
  await expect(bar(page)).toBeVisible();

  // Cold start straight into the session: nothing was visited, so Dashboard.
  await page.goto('/session');
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: /Minimize/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(bar(page)).toBeVisible();
});

test('the bar shows on tabbed screens and never on full-screen routes', async ({ page }) => {
  await startFromDashboard(page);
  const programs = await readStore<Row>(page, 'programs');
  const days = await readStore<Row>(page, 'programDays');
  const programId = programs[0].id as string;
  const dayId = days.find((d) => d.name === 'Push A')!.id as string;

  for (const tab of ['/', '/workout', '/levels', '/more', '/more/settings', '/more/library']) {
    await page.goto(tab);
    await expect(bar(page)).toBeVisible();
  }
  for (const chromeless of [
    `/programs/${programId}`,
    `/programs/${programId}/days/${dayId}`,
    '/session',
  ]) {
    await page.goto(chromeless);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
    await expect(bar(page)).toHaveCount(0);
  }
});

test('paused time is excluded from the duration', async ({ page }) => {
  test.setTimeout(60_000);
  await startFromDashboard(page);
  await page.getByRole('button', { name: 'Back' }).click();

  const readSeconds = async () => {
    const [h, m, s] = ((await clock(page).textContent()) ?? '0:00:00').split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };

  await page.getByRole('button', { name: 'Pause workout timer' }).click();
  await expect(page.getByLabel('Workout duration, paused')).toBeVisible();
  const atPause = await readSeconds();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Resume workout timer' }).click();
  await expect(page.getByLabel('Workout duration', { exact: true })).toBeVisible();
  // Three real seconds passed while paused; the clock gained at most a tick.
  expect((await readSeconds()) - atPause).toBeLessThanOrEqual(1);
  await expect
    .poll(async () => (await readStore<Row>(page, 'workouts'))[0].pausedMs as number)
    .toBeGreaterThanOrEqual(2900);
});
