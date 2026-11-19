import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { fillAllSets, readStore, seedActiveProgram, doneFromSummary } from './workout-loop-helpers';

/** Waits until the service worker controls the page, then cuts the network. */
async function goOffline(page: Page, context: BrowserContext) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 120_000,
  });
  await context.setOffline(true);
}

// Offline is the normal state in the gym: the whole program workout loop must
// run with the network off. Runs against `vite preview` of the prod build
// (offline-chrome project), so a service worker serves the app shell.
test('the program workout loop runs end to end while offline', async ({ page, context }) => {
  test.setTimeout(120_000);

  await goOffline(page, context);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);

  // Log set 1 with the pad and check it.
  const pad = page.getByRole('group', { name: 'Number pad' });
  await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
  await pad.getByRole('button', { name: '6', exact: true }).click();
  await pad.getByRole('button', { name: '0', exact: true }).click();
  await pad.getByRole('button', { name: 'Next', exact: true }).click();
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
  await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Writes go through to IndexedDB in the background; wait for the stamp.
  await expect
    .poll(async () =>
      (await readStore<{ completedAt?: number }>(page, 'sets')).some((s) => s.completedAt != null),
    )
    .toBe(true);

  // An offline reload keeps the workout.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Set 1 weight in kilograms' })).toHaveText('60');
  await expect(page.getByRole('checkbox', { name: 'Mark set 1 not done' })).toBeVisible();

  // Finish (unchecked sets are dropped), then Done from the summary to the Dashboard, still offline.
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page
    .getByRole('dialog', { name: /Finish with \d+ sets not done\?/ })
    .getByRole('button', { name: 'Finish workout' })
    .click();
  await doneFromSummary(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Pull A' })).toBeVisible();

  const workouts = await readStore<{ status: string }>(page, 'workouts');
  expect(workouts.map((w) => w.status)).toEqual(['finished']);
});

test('Save image downloads the 1080x1920 share PNG while offline', async ({ page, context }) => {
  test.setTimeout(120_000);

  await goOffline(page, context);
  await seedActiveProgram(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await fillAllSets(page, { reps: 8, weight: 60 });
  for (const n of [1, 2, 3]) {
    await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
  }
  await page.getByRole('button', { name: 'Workout menu' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page
    .getByRole('dialog', { name: /Finish with \d+ sets not done\?/ })
    .getByRole('button', { name: 'Finish workout' })
    .click();

  await page.getByRole('button', { name: 'Share image' }).click();
  await expect(page).toHaveURL(/\/workouts\/[^/]+\/share$/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^ledger-push-a-\d{4}-\d{2}-\d{2}\.png$/);
  const png = await readFile(await file.path());
  // PNG signature, then the IHDR chunk's width and height (big-endian, bytes 16-23).
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1920]);
});
