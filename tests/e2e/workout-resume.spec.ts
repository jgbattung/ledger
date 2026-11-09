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
  // No launch banner or modal: the bar is the only resume surface (AC 2, AC 10).
  await expect(page.getByRole('dialog')).toHaveCount(0);
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

/** Client-side navigation, so the store stays hydrated and the bar's absence is meaningful. */
async function spaGo(page: Page, to: string) {
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, to);
}

async function expectChromeless(page: Page, url: RegExp) {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
}

test('the bar shows on every tabbed screen and never on a full-screen route', async ({ page }) => {
  test.setTimeout(90_000);
  await startFromDashboard(page);
  const programs = await readStore<Row>(page, 'programs');
  const days = await readStore<Row>(page, 'programDays');
  const programId = programs[0].id as string;
  const dayId = days.find((d) => d.name === 'Push A')!.id as string;

  // Straight after launch on each tab (a full load), then by in-app navigation.
  const tabs = ['/', '/workout', '/levels', '/more', '/more/settings', '/more/library'];
  for (const tab of tabs) {
    await page.goto(tab);
    await expect(bar(page)).toBeVisible();
  }
  for (const tab of tabs) {
    await spaGo(page, tab);
    await expect.poll(() => new URL(page.url()).pathname).toBe(tab);
    await expect(bar(page)).toBeVisible();
  }

  // Every ChromelessShell route, reached in-app while the bar is already on screen.
  const editor = `/programs/${programId}`;
  await spaGo(page, editor);
  await expectChromeless(page, new RegExp(`${editor}$`));
  await page.getByRole('link', { name: 'Add exercises' }).first().click();
  await expectChromeless(page, new RegExp(`${editor}/exercises`));

  await spaGo(page, '/more');
  await expect(bar(page)).toBeVisible();
  await spaGo(page, `${editor}/days/${dayId}`);
  await expectChromeless(page, /\/days\//);

  await spaGo(page, '/more');
  await expect(bar(page)).toBeVisible();
  await spaGo(page, '/programs/new');
  const naming = page.getByRole('dialog', { name: 'Name your program' });
  await naming.getByRole('textbox', { name: 'Program name' }).fill('Scratch');
  await naming.getByRole('button', { name: 'Continue' }).click();
  await expectChromeless(page, /\/programs\/new$/);
  await page.getByRole('link', { name: 'Add exercises' }).first().click();
  await expectChromeless(page, /\/programs\/new\/exercises/);

  await spaGo(page, '/more');
  await expect(bar(page)).toBeVisible();
  await spaGo(page, '/session');
  await expect(page.getByRole('button', { name: 'Workout menu' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Swap' }).first().click();
  await expectChromeless(page, /\/session\/swap\//);
});

/** The bar's outer box, the FAB, and the viewport, in CSS px. */
async function layout(page: Page) {
  const box = (await bar(page).locator('xpath=..').boundingBox())!;
  const fab = (await page.getByRole('button', { name: 'Quick actions' }).boundingBox())!;
  const viewport = page.viewportSize()!;
  return { box, fab, viewport, bottomGap: viewport.height - (box.y + box.height) };
}

async function expectClearsFab(page: Page) {
  const { box, fab, viewport } = await layout(page);
  // 8px above the FAB's top edge, never overlapping it.
  expect(fab.y - (box.y + box.height)).toBeCloseTo(8, 0);
  // 16px gutters, 56px minimum height, 44px controls.
  expect(box.x).toBeCloseTo(16, 0);
  expect(viewport.width - (box.x + box.width)).toBeCloseTo(16, 0);
  expect(box.height).toBeGreaterThanOrEqual(56);
  for (const name of [/^(Pause|Resume) workout timer$/, /^Discard workout$/]) {
    const button = (await page.getByRole('button', { name }).boundingBox())!;
    expect(button.width).toBeCloseTo(44, 0);
    expect(button.height).toBeCloseTo(44, 0);
  }
}

test('the bar clears the raised FAB, with and without a gesture safe-area inset', async ({ page }) => {
  await startFromDashboard(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(bar(page)).toBeVisible();
  await expectClearsFab(page);
  const before = await layout(page);

  // Chromium's own env(safe-area-inset-*) override (index.html uses viewport-fit=cover).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: { bottom: 34 } } as never);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCSS('padding-bottom', '34px');
  await expectClearsFab(page);
  // The bar rises by exactly the inset, in step with the nav and the FAB.
  expect((await layout(page)).bottomGap - before.bottomGap).toBeCloseTo(34, 0);
});

test('a wrapped meta line keeps its leading and the bar grows upward, clear of the FAB', async ({
  page,
}) => {
  // Four exercises of three sets: a two-digit "0 of 12 sets".
  await seedActiveProgram(page, {
    days: [
      {
        name: 'Push A',
        exercises: ['barbell-bench-press', 'cable-lateral-raise', 'incline-dumbbell-press', 'face-pull'],
      },
    ],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toContainText('0 of 12 sets');
  const oneLine = await layout(page);
  expect(oneLine.box.height).toBeCloseTo(56, 0);

  // A 260px-wide viewport leaves the meta line ~110px, so it must wrap to two lines.
  await page.setViewportSize({ width: 260, height: 653 });
  const meta = page.getByLabel(/^Workout duration/).first().locator('xpath=..');
  const metrics = await meta.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(style.lineHeight),
      fontSize: parseFloat(style.fontSize),
    };
  });
  expect(metrics.lineHeight).toBeCloseTo(metrics.fontSize * 1.375, 1); // leading-snug
  expect(Math.round(metrics.height / metrics.lineHeight)).toBeGreaterThanOrEqual(2);

  const wrapped = await layout(page);
  expect(wrapped.box.height).toBeGreaterThan(oneLine.box.height);
  // Same bottom edge: the extra height went up, never down into the FAB.
  expect(wrapped.bottomGap).toBeCloseTo(oneLine.bottomGap, 0);
  await expectClearsFab(page);
});

test('while the bar shows, the end of a long list scrolls clear of it; the padding drops after', async ({
  page,
}) => {
  await startFromDashboard(page);
  await page.goto('/more/library');
  await expect(bar(page)).toBeVisible();
  const main = page.locator('main');
  const padWith = parseFloat(await main.evaluate((el) => getComputedStyle(el).paddingBottom));

  await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const contentBottom = await main.evaluate(
    (el) => el.lastElementChild!.getBoundingClientRect().bottom,
  );
  const barTop = (await bar(page).locator('xpath=..').boundingBox())!.y;
  expect(contentBottom).toBeLessThanOrEqual(barTop);

  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page
    .getByRole('dialog', { name: 'Discard this workout?' })
    .getByRole('button', { name: 'Discard workout' })
    .click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/more\/library$/);
  const padWithout = parseFloat(await main.evaluate((el) => getComputedStyle(el).paddingBottom));
  // The bar's 56px minimum height plus its 8px gap.
  expect(padWith - padWithout).toBeCloseTo(64, 0);
});

test('finishing while paused records a duration without the paused time', async ({ page }) => {
  test.setTimeout(60_000);
  await startFromDashboard(page);
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(page.getByLabel('Workout duration, paused')).toBeVisible();
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(bar(page)).toHaveCount(0);

  const [row] = await readStore<Row>(page, 'workouts');
  expect(row.status).toBe('finished');
  expect(row.pausedAt ?? null).toBeNull();
  const pausedMs = row.pausedMs as number;
  expect(pausedMs).toBeGreaterThanOrEqual(1900);
  const wall = (row.finishedAt as number) - (row.startedAt as number);
  expect(wall - pausedMs).toBeGreaterThanOrEqual(0);
  expect(wall - pausedMs).toBeLessThan(wall - 1900);
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
