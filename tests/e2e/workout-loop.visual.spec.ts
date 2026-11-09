import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillAllSets, seedActiveProgram } from './workout-loop-helpers';

/**
 * LG-010 + LG-022 visual gate. An artifact generator, not an assertion suite:
 * writes full-viewport PNGs of every state of the workout loop, both themes,
 * to test-results/lg-010-022-screens/, plus the approved mockup phones for
 * side-by-side review. Tagged @visual; run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-010-022-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'program-workout-core-loop-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

/** Removes the targets of one program exercise so its Day page row shows the no-targets chip. */
async function clearTargets(page: Page, exerciseId: string) {
  await page.evaluate(async (id) => {
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
        if (row.exerciseRef.exerciseId === id) {
          delete row.workingSets;
          delete row.repMin;
          delete row.repMax;
          cursor.update(row);
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, exerciseId);
  await page.reload();
}

async function startFromDashboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole('table', { name: 'Sets' })).toBeVisible();
}

/** Logs a set through the pad: weight, reps, optional partials and a RIR circle. */
async function logSet(
  page: Page,
  n: number,
  v: { weight: string[]; reps: string[]; partial?: string[]; rir: string },
) {
  const pad = page.getByRole('group', { name: 'Number pad' });
  const press = async (keys: string[]) => {
    for (const k of keys) {
      await pad.getByRole('button', { name: k === '.' ? 'Decimal point' : k, exact: true }).click();
    }
  };
  await page.getByRole('button', { name: `Set ${n} weight in kilograms` }).click();
  await press(v.weight);
  await pad.getByRole('button', { name: 'Next', exact: true }).click();
  await press(v.reps);
  if (v.partial) {
    await pad.getByRole('button', { name: 'Partial reps' }).click();
    await press(v.partial);
  }
  await pad.getByRole('button', { name: v.rir, exact: true }).click();
  await page.getByRole('button', { name: 'Hide keypad' }).click();
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual workout tab rows (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A'] });
      await expect(page.getByText('5 workouts · 2 of 6 done')).toBeVisible();
      await shot(page, '01-workout-tab-rows', scheme);
    });

    test(`@visual day page (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page);
      await page.getByRole('link', { name: /Pull A/ }).click();
      await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
      await shot(page, '02-day-page', scheme);

      await page.goto('/workout');
      await clearTargets(page, 'face-pull');
      await page.getByRole('link', { name: /Pull A/ }).click();
      await expect(page.getByText('No targets · starts with 1 set')).toBeVisible();
      await shot(page, '03-day-page-no-targets', scheme);
    });

    test(`@visual ongoing workout fresh (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page);
      await startFromDashboard(page);
      await shot(page, '04-session-fresh', scheme);
    });

    test(`@visual ongoing workout mid-workout, pad and swipe (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await seedActiveProgram(page);
      await startFromDashboard(page);

      await page.getByRole('button', { name: 'Set 1 weight in kilograms' }).click();
      const pad = page.getByRole('group', { name: 'Number pad' });
      await expect(pad).toBeVisible();
      await shot(page, '06-pad-on-weight', scheme);
      await page.getByRole('button', { name: 'Hide keypad' }).click();

      await logSet(page, 1, { weight: ['6', '2', '.', '5'], reps: ['9'], rir: 'RIR 1' });
      await page.getByRole('checkbox', { name: 'Mark set 1 done' }).click();
      await logSet(page, 2, { weight: ['6', '2', '.', '5'], reps: ['8'], partial: ['2'], rir: 'RIR 0' });
      await page.getByRole('checkbox', { name: 'Mark set 2 done' }).click();
      await page.getByRole('button', { name: 'Set 3 weight in kilograms' }).click();
      await page.getByRole('group', { name: 'Number pad' }).getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('group', { name: 'Number pad' }).getByRole('button', { name: '7', exact: true }).click();
      await page.getByRole('group', { name: 'Number pad' }).getByRole('button', { name: 'Partial reps' }).click();
      await page.getByRole('group', { name: 'Number pad' }).getByRole('button', { name: 'RIR 4' }).click();
      await shot(page, '07-pad-on-reps-partial-mode', scheme);
      await page.getByRole('button', { name: 'Hide keypad' }).click();
      await shot(page, '05-session-mid-workout', scheme);

      // A row swiped open.
      const surface = page.getByRole('row', { name: 'Set 3' }).locator('[style*="translateX"]');
      const box = (await surface.boundingBox())!;
      const y = box.y + box.height / 2;
      const x = box.x + box.width - 90;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 70, y, { steps: 6 });
      await page.mouse.up();
      await expect(surface).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -52, 0)');
      await shot(page, '08-row-swiped-open', scheme);
    });

    test(`@visual all done with the finish bar and the menu (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await seedActiveProgram(page);
      await startFromDashboard(page);
      await fillAllSets(page, { reps: 10, weight: 60 });
      for (const exercise of ['Barbell Bench Press', 'Cable Lateral Raise']) {
        await page.getByRole('button', { name: exercise }).first().click();
        for (const n of [1, 2, 3]) {
          await page.getByRole('checkbox', { name: `Mark set ${n} done` }).click();
        }
      }
      await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
      await shot(page, '09-all-done-finish-bar', scheme);

      await page.getByRole('button', { name: 'Workout menu' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, '10-menu-sheet', scheme);
    });

    test(`@visual swap picker and keep/reset (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page);
      await startFromDashboard(page);
      await page.getByRole('button', { name: 'Swap' }).click();
      await page.getByRole('searchbox').fill('bench press');
      await expect(page.getByRole('button', { name: /^Barbell Bench Press/ }).first()).toBeDisabled();
      await shot(page, '11-swap-picker', scheme);
      await page.getByRole('button', { name: /^Dumbbell Bench Press(?! with)/ }).click();
      await expect(page.getByRole('dialog', { name: /Swap to/ })).toBeVisible();
      await shot(page, '12-swap-keep-reset', scheme);
    });

    test(`@visual dashboard start and resume (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A'] });
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
      await shot(page, '13-dashboard-start', scheme);
      await page.getByRole('button', { name: 'Start workout' }).click();
      await expect(page).toHaveURL(/\/session$/);
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByRole('link', { name: /^Open workout/ })).toBeVisible();
      await shot(page, '14-dashboard-ongoing', scheme);
    });

    // LG-011: the floating in-progress bar, pause, stop confirm and the session menu.
    test(`@visual in-progress bar and pause (${scheme})`, async ({ page }) => {
      test.setTimeout(90_000);
      await seedActiveProgram(page, { doneDays: ['Push A', 'Pull A'] });
      await startFromDashboard(page);
      await page.getByRole('button', { name: 'Back' }).click();
      const bar = page.getByRole('link', { name: /^Open workout/ });
      await expect(bar).toBeVisible();

      await shot(page, '15-bar-running-dashboard', scheme);
      await page.getByRole('link', { name: 'Workout', exact: true }).click();
      await shot(page, '16-bar-running-workout-tab', scheme);

      await page.getByRole('button', { name: 'Pause workout timer' }).click();
      await expect(page.getByRole('button', { name: 'Resume workout timer' })).toBeVisible();
      await shot(page, '17-bar-paused', scheme);

      await page.getByRole('button', { name: 'Discard workout' }).click();
      await expect(page.getByRole('dialog', { name: 'Discard this workout?' })).toBeVisible();
      await shot(page, '18-stop-confirm', scheme);
      await page.getByRole('button', { name: 'Keep workout' }).click();

      await bar.click();
      await expect(page).toHaveURL(/\/session$/);
      await shot(page, '19-session-topbar-paused', scheme);
      await page.getByRole('button', { name: 'Workout menu' }).click();
      await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
      await shot(page, '20-session-menu-resume', scheme);
    });

    test(`@visual in-progress bar with a long name (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page, {
        days: [
          {
            name: 'Upper body hypertrophy with a very long name that cannot fit one line',
            exercises: ['barbell-bench-press', 'cable-lateral-raise'],
          },
        ],
      });
      await page.goto('/');
      await page.getByRole('button', { name: 'Start workout' }).click();
      await expect(page).toHaveURL(/\/session$/);
      await page.getByRole('button', { name: 'Back' }).click();
      await page.getByRole('link', { name: 'More', exact: true }).click();
      await expect(page.getByRole('link', { name: /^Open workout/ })).toBeVisible();
      await shot(page, '21-bar-long-name', scheme);
    });
  });
}

test('@visual approved mockup screens, both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  for (const scheme of SCHEMES) {
    await page.locator(`button[data-theme="${scheme}"]`).click();
    const phones = page.locator('#mocks .phone');
    const count = await phones.count();
    for (let i = 0; i < count; i++) {
      await phones.nth(i).screenshot({ path: path.join(OUT, `mockup-${String(i + 1).padStart(2, '0')}-${scheme}.png`) });
    }
  }
});
