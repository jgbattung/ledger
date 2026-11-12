import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedActiveProgram } from './workout-loop-helpers';

/**
 * LG-006 visual gate. An artifact generator, not an assertion suite: writes
 * 384px PNGs of the exercise detail page and its entry points in both themes
 * to test-results/lg-006-screens/, plus the approved mockup phones for
 * side-by-side review. Tagged @visual; run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-006-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'exercise-detail-page-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

type Exercise = {
  id: string;
  name: string;
  aliases: string[];
  secondaryMuscles: string[];
  images: string[];
};
const catalog: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
);
const LONG = catalog
  .filter((e) => e.aliases.length >= 2 && e.secondaryMuscles.length >= 3 && e.images.length > 0)
  .sort((a, b) => b.name.length - a.name.length)[0];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

const DAY = 86_400_000;

/** Writes finished workouts with logged sets for one exercise straight into IndexedDB, then reloads. */
async function seedHistory(page: Page, exerciseId: string) {
  await page.evaluate(
    async ({ exerciseId, DAY }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ledger');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const now = Date.now();
      const base = { createdAt: now, updatedAt: now, deletedAt: null };
      type SetSeed = { weight: number; reps: number; rir: number; rirIsPlus?: boolean; partialReps?: number };
      const sessions: { ago: number; name: string; sets: SetSeed[] }[] = [
        {
          ago: 2,
          name: 'Push',
          sets: [
            { weight: 32.5, reps: 10, rir: 1 },
            { weight: 32.5, reps: 9, rir: 0 },
            { weight: 32.5, reps: 8, rir: 0, partialReps: 2 },
          ],
        },
        {
          ago: 8,
          name: 'Upper',
          sets: [
            { weight: 32.5, reps: 9, rir: 1 },
            { weight: 32.5, reps: 8, rir: 0 },
            { weight: 30, reps: 10, rir: 0 },
          ],
        },
        {
          ago: 14,
          name: 'Push',
          sets: [
            { weight: 30, reps: 10, rir: 1 },
            { weight: 30, reps: 10, rir: 0 },
            { weight: 30, reps: 9, rir: 0 },
            { weight: 20, reps: 12, rir: 6, rirIsPlus: true },
          ],
        },
        {
          ago: 20,
          name: 'Upper',
          sets: [
            { weight: 30, reps: 9, rir: 1 },
            { weight: 27.5, reps: 10, rir: 0 },
          ],
        },
        { ago: 400, name: 'Push', sets: [{ weight: 25, reps: 10, rir: 2 }] },
      ];
      const stores = ['workouts', 'workoutExercises', 'sets'];
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        for (const session of sessions) {
          const startedAt = now - session.ago * DAY;
          const workoutId = crypto.randomUUID();
          const exerciseRowId = crypto.randomUUID();
          tx.objectStore('workouts').put({
            id: workoutId,
            ...base,
            name: session.name,
            programName: 'PPL-R-UL',
            startedAt,
            finishedAt: startedAt + 3_600_000,
            status: 'finished',
          });
          tx.objectStore('workoutExercises').put({
            id: exerciseRowId,
            ...base,
            workoutId,
            orderIndex: 0,
            exerciseRef: { source: 'db', exerciseId },
          });
          session.sets.forEach((set, index) => {
            tx.objectStore('sets').put({
              id: crypto.randomUUID(),
              ...base,
              workoutExerciseId: exerciseRowId,
              orderIndex: index,
              type: 'working',
              rirIsPlus: false,
              ...set,
              completedAt: startedAt + 600_000,
            });
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { exerciseId, DAY },
  );
  await page.reload();
}

/** Inserts a custom exercise (nothing can create one until LG-007) and returns its id. */
async function seedCustom(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = Date.now();
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('customExercises', 'readwrite');
      tx.objectStore('customExercises').put({
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: 'Machine Hamstring Curl',
        primaryMuscles: ['hamstrings'],
        secondaryMuscles: ['calves'],
        equipmentTag: 'machine',
        notes: 'Seat pad one notch up. Pause for a count at the bottom of every rep.',
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
  });
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual S1 info tab with photos (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/db/incline-dumbbell-press');
      await expect(page.getByRole('img', { name: 'Start position' })).toBeVisible();
      await page.getByRole('img', { name: 'Start position' }).evaluate((img: HTMLImageElement) => img.decode());
      await shot(page, 's1-info-photos', scheme);

      await page.getByRole('tabpanel').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await shot(page, 's1b-info-scrolled', scheme);
    });

    test(`@visual S2 history tab (${scheme})`, async ({ page }) => {
      await page.goto('/workout');
      await seedHistory(page, 'incline-dumbbell-press');
      await page.goto('/exercises/db/incline-dumbbell-press?tab=history');
      await expect(page.getByText('RIR 6+')).toBeVisible();
      await shot(page, 's2-history', scheme);
    });

    test(`@visual S3 actions drawer (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/db/incline-dumbbell-press');
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 's3-actions-drawer', scheme);
    });

    test(`@visual S4 custom exercise and its drawer (${scheme})`, async ({ page }) => {
      await page.goto('/workout');
      const id = await seedCustom(page);
      await page.goto(`/exercises/custom/${id}`);
      await expect(page.getByText('Custom', { exact: true })).toBeVisible();
      await shot(page, 's4-custom', scheme);
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 's4b-custom-drawer', scheme);
    });

    test(`@visual S5 empty history (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/db/cable-lateral-raise?tab=history');
      await expect(page.getByText('No sets logged yet')).toBeVisible();
      await shot(page, 's5-empty-history', scheme);
    });

    test(`@visual no-photo exercise (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/db/cable-lateral-raise');
      await expect(page.getByRole('heading', { level: 1, name: 'Cable Lateral Raise' })).toBeVisible();
      await shot(page, 'e-no-photo', scheme);
    });

    test(`@visual not found (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/db/no-such-exercise');
      await expect(page.getByText('Exercise not found')).toBeVisible();
      await shot(page, 'e-not-found', scheme);
    });

    test(`@visual long name with aliases (${scheme})`, async ({ page }) => {
      await page.goto(`/exercises/db/${LONG.id}`);
      await expect(page.getByRole('heading', { level: 1, name: LONG.name })).toBeVisible();
      await page.getByRole('img').first().evaluate((img: HTMLImageElement) => img.decode());
      await shot(page, 'e-long-name', scheme);
    });

    test(`@visual E1 library rows (${scheme})`, async ({ page }) => {
      await page.goto('/more/library');
      await expect(page.getByRole('link', { name: /Barbell Bench Press/ }).first()).toBeVisible();
      await shot(page, 'e1-library', scheme);
    });

    test(`@visual E2 session info chip (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Start workout' }).click();
      await expect(page.getByRole('button', { name: 'Info' })).toBeEnabled();
      await shot(page, 'e2-session-chips', scheme);
    });

    test(`@visual E3 day page rows (${scheme})`, async ({ page }) => {
      await seedActiveProgram(page);
      await page.getByRole('link', { name: /Push A/ }).click();
      await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
      await shot(page, 'e3-day-page', scheme);
    });
  });
}

test('@visual approved mockup phones, both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  for (const scheme of SCHEMES) {
    await page.getByRole('button', { name: scheme === 'dark' ? 'Dark' : 'Light', exact: true }).click();
    const phones = page.locator('.phone');
    const count = await phones.count();
    for (let i = 0; i < count; i++) {
      await phones.nth(i).scrollIntoViewIfNeeded();
      await phones.nth(i).screenshot({ path: path.join(OUT, `mockup-${String(i + 1).padStart(2, '0')}-${scheme}.png`) });
    }
  }
});
