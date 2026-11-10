import { expect, test, type Page } from '@playwright/test';
import { seedActiveProgram } from './workout-loop-helpers';

/**
 * LG-017 rest timer: TIM-1 (auto-start), TIM-3 (amended: presets, floating bar),
 * TIM-4 (reload), and the finish/discard lifecycle. page.clock is installed
 * before navigation so no test waits in real time.
 */
const START = new Date('2026-11-10T10:00:00');
const STORAGE_KEY = 'ledger-rest-timer';

const restButton = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name: name instanceof RegExp ? name : `Rest timer, ${name}` });
const bar = (page: Page) => page.getByRole('link', { name: 'Open workout, Push A' });
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

/** Gives the Push A bench press an exercise-level rest (before the workout snapshots its targets). */
async function setBenchRest(page: Page, restSeconds: number) {
  await page.evaluate(async (seconds) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('programExercises', 'readwrite');
      const store = tx.objectStore('programExercises');
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        const row = cursor.value;
        if (row.exerciseRef.exerciseId === 'barbell-bench-press') {
          row.restSeconds = seconds;
          cursor.update(row);
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, restSeconds);
}

async function startWorkout(page: Page, opts: { benchRest?: number } = {}) {
  await seedActiveProgram(page);
  if (opts.benchRest) await setBenchRest(page, opts.benchRest);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();
}

async function checkSet(page: Page, n: number) {
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

async function openSheet(page: Page) {
  await restButton(page, /^Rest timer, /).click();
  return page.getByRole('dialog', { name: 'Rest timer' });
}

async function minimize(page: Page) {
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/\/session$/);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: START });
});

test('TIM-1: checking a set starts the exercise rest; no exercise rest uses the Settings default', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await expect(restButton(page, 'not running')).toContainText('0:00');
  await checkSet(page, 1);
  await expect(restButton(page, /^Rest timer, 2:00 left$/)).toContainText('2:00');

  // Cable Lateral Raise has no rest of its own: the Settings default (3:00).
  await page.getByRole('button', { name: 'Cable Lateral Raise' }).click();
  await checkSet(page, 1);
  await expect(restButton(page, /^Rest timer, 3:00 left$/)).toContainText('3:00');
});

test('TIM-3: a preset restarts the countdown and the floating bar shows and counts it down', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await checkSet(page, 1);

  const sheet = await openSheet(page);
  await sheet.getByRole('button', { name: 'Rest 2:30' }).click();
  await expect(sheet.getByRole('button', { name: 'Rest 2:30' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet).toContainText('2:30');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  await minimize(page);
  await expect(bar(page)).toContainText('Rest 2:30');
  await page.clock.runFor(10_000);
  await expect(bar(page)).toContainText(/Rest 2:(1[89]|20)/);
});

test('TIM-4: a reload mid-rest keeps the right time with no 0:00 flash on first paint', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await checkSet(page, 1);
  await page.clock.runFor(40_000);
  await expect(restButton(page, /^Rest timer, 1:[12]\d left$/)).toBeVisible();

  // Record every label the timer button shows from the very first paint of the reloaded page.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __restLabels: string[] }).__restLabels = seen;
    const scan = () => {
      const label = document.querySelector('button[aria-label^="Rest timer"]')?.getAttribute('aria-label');
      if (label && seen[seen.length - 1] !== label) seen.push(label);
    };
    new MutationObserver(scan).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await page.reload();

  const button = restButton(page, /^Rest timer, /);
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleName(/^Rest timer, 1:(1\d|20) left$/);
  const labels = await page.evaluate(
    () => (window as unknown as { __restLabels: string[] }).__restLabels,
  );
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => !label.includes('not running'))).toBe(true);
  expect(labels[0]).toMatch(/^Rest timer, 1:(1\d|20) left$/);
});

test('idle: the sheet opens at 0:00, Skip is disabled, and a preset starts a rest', async ({ page }) => {
  test.setTimeout(90_000);
  await startWorkout(page);
  const sheet = await openSheet(page);
  await expect(sheet.getByRole('button', { name: 'Skip rest' })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Rest 0:30' }).click();
  await expect(sheet.getByRole('button', { name: 'Skip rest' })).toBeEnabled();
  await expect(sheet).toContainText(/0:(30|29)/);
  // The sheet hides the page behind it from the accessibility tree: close it to read the top bar.
  await page.keyboard.press('Escape');
  await expect(restButton(page, /^Rest timer, 0:(30|29|2\d) left$/)).toBeVisible();
});

test('Skip ends the rest and closes the sheet', async ({ page }) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await checkSet(page, 1);
  const sheet = await openSheet(page);
  await sheet.getByRole('button', { name: 'Skip rest' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(restButton(page, 'not running')).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test('End: past endsAt the timer returns to muted 0:00 and the stored timer is gone', async ({ page }) => {
  test.setTimeout(90_000);
  await startWorkout(page);
  const sheet = await openSheet(page);
  await sheet.getByRole('button', { name: 'Rest 0:15' }).click();
  await expect(sheet).toContainText('0:1');
  await page.clock.runFor(16_000);
  await expect(sheet.getByRole('button', { name: 'Skip rest' })).toBeDisabled();
  await expect(sheet).toContainText('0:00');
  await page.keyboard.press('Escape');
  await expect(restButton(page, 'not running')).toContainText('0:00');
  expect(await stored(page)).toBeNull();
});

test('lifecycle: discarding from the bar clears a running rest', async ({ page }) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await checkSet(page, 1);
  expect(await stored(page)).not.toBeNull();
  await minimize(page);

  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page
    .getByRole('dialog', { name: 'Discard this workout?' })
    .getByRole('button', { name: 'Discard workout' })
    .click();
  // The open confirm sheet hides the bar from the accessibility tree, so the count above can pass
  // before discard() has run: poll the storage instead of reading it once.
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => stored(page)).toBeNull();

  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(restButton(page, 'not running')).toContainText('0:00');
});

test('lifecycle: finishing from the menu clears a running rest', async ({ page }) => {
  test.setTimeout(90_000);
  await startWorkout(page, { benchRest: 120 });
  await checkSet(page, 1);
  expect(await stored(page)).not.toBeNull();

  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => stored(page)).toBeNull();

  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(restButton(page, 'not running')).toContainText('0:00');
});
