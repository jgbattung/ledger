import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * LG-007 visual gate. An artifact generator, not an assertion suite: writes
 * 384px PNGs of every contract screen in both themes to
 * test-results/lg-007-screens/, plus the approved mockup phones beside them
 * for side-by-side review. Tagged @visual; run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-007-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'custom-exercises-alignment.html').replace(/\\/g, '/')}`;
mkdirSync(OUT, { recursive: true });

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

type Seeded = { programId: string; legsId: string; ssbId: string; goneId: string; badProgramId: string };

/** Raw rows: two custom exercises (one deleted), a program using both, history for both, and a program with a target gap. */
async function seedAll(page: Page): Promise<Seeded> {
  await page.goto('/workout');
  await page.getByRole('heading', { name: 'Workout', exact: true }).waitFor();
  const seeded = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ledger');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const DAY = 86_400_000;
    const t = Date.now();
    const base = { createdAt: t, updatedAt: t, deletedAt: null };
    const id = () => crypto.randomUUID();
    const ssbId = id();
    const goneId = id();
    const programId = id();
    const legsId = id();
    const badProgramId = id();
    const badDayId = id();
    const rows: [string, Record<string, unknown>][] = [
      [
        'customExercises',
        {
          id: ssbId,
          ...base,
          name: 'SSB Squat',
          primaryMuscles: ['quads'],
          secondaryMuscles: ['glutes', 'lower back'],
          equipmentTag: 'barbell',
          mechanic: 'compound',
          notes: 'Safety squat bar. Brace hard.',
        },
      ],
      [
        'customExercises',
        {
          id: goneId,
          ...base,
          deletedAt: t - 5 * DAY,
          name: 'Zercher Squat',
          primaryMuscles: ['quads'],
          secondaryMuscles: ['glutes', 'abs'],
          equipmentTag: 'barbell',
          mechanic: 'compound',
        },
      ],
      [
        'programs',
        {
          id: programId,
          ...base,
          name: 'PPL-R-UL',
          isActive: true,
          isArchived: false,
          currentDayIndex: 0,
          completedDayIds: [],
          currentCycleIndex: 0,
        },
      ],
      ['programDays', { id: legsId, ...base, programId, orderIndex: 0, name: 'Legs' }],
    ];
    const targets = { workingSets: 3, repMin: 5, repMax: 8, rirTarget: 2, restSeconds: 180 };
    const legs: { source: string; exerciseId: string }[] = [
      { source: 'db', exerciseId: 'barbell-squat' },
      { source: 'custom', exerciseId: ssbId },
      { source: 'custom', exerciseId: goneId },
      { source: 'db', exerciseId: 'leg-press' },
    ];
    legs.forEach((exerciseRef, j) => {
      rows.push([
        'programExercises',
        { id: id(), ...base, programDayId: legsId, orderIndex: j, exerciseRef, ...targets },
      ]);
    });
    rows.push([
      'programs',
      {
        id: badProgramId,
        ...base,
        name: 'Arm Day (draft)',
        isActive: false,
        isArchived: false,
        currentDayIndex: 0,
        completedDayIds: [],
        currentCycleIndex: 0,
      },
    ]);
    rows.push(['programDays', { id: badDayId, ...base, programId: badProgramId, orderIndex: 0, name: 'Arms' }]);
    rows.push([
      'programExercises',
      {
        id: id(),
        ...base,
        programDayId: badDayId,
        orderIndex: 0,
        exerciseRef: { source: 'db', exerciseId: 'barbell-curl' },
      },
    ]);

    for (const [exerciseId, ago, weight] of [
      [ssbId, 3, 100],
      [ssbId, 9, 97.5],
      [goneId, 20, 60],
    ] as [string, number, number][]) {
      const startedAt = t - ago * DAY;
      const workoutId = id();
      const wexId = id();
      rows.push([
        'workouts',
        {
          id: workoutId,
          ...base,
          programId,
          programDayId: legsId,
          programName: 'PPL-R-UL',
          name: 'Legs',
          startedAt,
          finishedAt: startedAt + 3_600_000,
          status: 'finished',
        },
      ]);
      rows.push([
        'workoutExercises',
        { id: wexId, ...base, workoutId, orderIndex: 0, exerciseRef: { source: 'custom', exerciseId } },
      ]);
      [8, 7, 6].forEach((reps, index) => {
        rows.push([
          'sets',
          {
            id: id(),
            ...base,
            workoutExerciseId: wexId,
            orderIndex: index,
            type: 'working',
            weight,
            reps,
            rir: index === 2 ? 0 : 1,
            rirIsPlus: false,
            completedAt: startedAt + 600_000 + index * 300_000,
          },
        ]);
      });
    }

    await new Promise<void>((resolve, reject) => {
      const stores = [...new Set(rows.map(([store]) => store))];
      const tx = db.transaction(stores, 'readwrite');
      for (const [store, row] of rows) tx.objectStore(store).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { programId, legsId, ssbId, goneId, badProgramId };
  });
  await page.reload();
  return seeded;
}

async function pickMuscles(page: Page, primary: string[], secondary: string[]) {
  const lower = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors'];
  const pick = async (names: string[]) => {
    for (const name of names) {
      await page.getByRole('radio', { name: lower.includes(name) ? /^Lower body/ : /^Upper body/ }).click();
      await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    }
  };
  await page.getByRole('button', { name: /^Primary/ }).click();
  await pick(primary);
  await page.getByRole('button', { name: 'Next' }).click();
  await pick(secondary);
  await page.getByRole('button', { name: 'Done' }).click();
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual form: M1 empty, M4 gaps, M2/2a filled, equipment sheet (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/new');
      await expect(page.getByRole('heading', { name: 'New exercise' })).toBeVisible();
      await shot(page, 'm1-new-empty', scheme);

      await page.getByLabel('Name').fill('Barbell Squat');
      await page.getByRole('button', { name: 'Save exercise' }).click();
      await expect(page.getByText('An exercise with this name already exists.')).toBeVisible();
      await page.evaluate(() => document.getElementById('field-name')?.scrollIntoView({ block: 'start' }));
      await shot(page, 'm4-save-with-gaps', scheme);

      await page.getByLabel('Name').fill('SSB Squat');
      await pickMuscles(page, ['Quads'], ['Glutes', 'Lower Back']);
      await page.getByRole('button', { name: /^Equipment:/ }).click();
      await page.getByRole('dialog', { name: 'Equipment' }).getByRole('button', { name: 'Barbell' }).click();
      await page.getByRole('radio', { name: 'Compound' }).click();
      await page.getByLabel('Notes').fill('Safety squat bar. Brace hard.');
      await shot(page, 'm2-2a-form-filled', scheme);

      await page.getByRole('button', { name: /^Equipment:/ }).click();
      await expect(page.getByRole('dialog', { name: 'Equipment' })).toBeVisible();
      await shot(page, 'm-equipment-sheet', scheme);
    });

    test(`@visual muscle page: 2b both halves, 2c step 2 (${scheme})`, async ({ page }) => {
      await page.goto('/exercises/new');
      await page.getByRole('button', { name: /^Primary/ }).click();
      await expect(page.getByRole('heading', { name: 'Primary muscles' })).toBeVisible();
      await shot(page, '2b-step1-upper', scheme);

      await page.getByRole('radio', { name: /^Lower body/ }).click();
      await page.getByRole('button', { name: /^Quads/ }).click();
      await shot(page, '2b-step1-lower', scheme);

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Secondary muscles' })).toBeVisible();
      await page.getByRole('radio', { name: /^Upper body/ }).click();
      await page.getByRole('button', { name: /^Lower Back/ }).click();
      await page.getByRole('radio', { name: /^Lower body/ }).click();
      await shot(page, '2c-step2', scheme);
    });

    test(`@visual P1 picker empty, P2 picker after save, swap picker (${scheme})`, async ({ page }) => {
      const { programId, legsId } = await seedAll(page);
      await page.goto(`/programs/${programId}`);
      await expect(page.getByRole('tablist', { name: 'Days' })).toBeVisible();
      await page.getByRole('link', { name: 'Add exercises' }).click();
      await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible();
      await page.getByLabel('Search exercises').fill('ssb sqat');
      await expect(page.getByRole('link', { name: /^Create/ })).toBeVisible();
      await shot(page, 'p1-picker-empty', scheme);

      await page.getByLabel('Search exercises').fill('squat');
      await page.getByRole('button', { name: /^Front Barbell Squat/ }).first().click();
      await page.getByLabel('Search exercises').fill('lunge');
      await page.getByRole('button', { name: /^Dumbbell Lunges/ }).first().click();
      await expect(page.getByRole('button', { name: /^Add 2 exercises/ })).toBeVisible();
      await shot(page, 'p2-picker-selected', scheme);
      void legsId;
    });

    test(`@visual D1 drawers, E1 library, E2 FAB (${scheme})`, async ({ page }) => {
      const { ssbId } = await seedAll(page);

      await page.goto('/exercises/db/barbell-squat');
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'd1-drawer-bundled', scheme);

      await page.goto(`/exercises/custom/${ssbId}`);
      await expect(page.getByText('Custom', { exact: true })).toBeVisible();
      await shot(page, 'd1-custom-page', scheme);
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'd1-drawer-custom', scheme);

      await page.goto('/more/library');
      await page.getByLabel('Search exercises').fill('squat');
      await expect(page.getByRole('link', { name: /^SSB Squat/ })).toBeVisible();
      await shot(page, 'e1-library', scheme);
      await page.getByLabel('Search exercises').fill('zzqqxx');
      await expect(page.getByRole('link', { name: /^Create/ })).toBeVisible();
      await shot(page, 'e1-library-empty', scheme);

      await page.goto('/');
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('button', { name: 'Quick actions' })
        .click();
      await expect(page.getByRole('link', { name: 'Create exercise' })).toBeVisible();
      await shot(page, 'e2-fab', scheme);
    });

    test(`@visual X1 confirm, X2 after delete, program day with Deleted row (${scheme})`, async ({ page }) => {
      const { programId, legsId, ssbId, goneId } = await seedAll(page);

      await page.goto(`/exercises/custom/${ssbId}`);
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await page.getByRole('button', { name: 'Delete exercise' }).click();
      await expect(page.getByRole('dialog', { name: 'Delete SSB Squat?' })).toBeVisible();
      await shot(page, 'x1-delete-confirm', scheme);

      await page.goto(`/exercises/custom/${goneId}?tab=history`);
      await expect(page.getByText('Deleted', { exact: true })).toBeVisible();
      await shot(page, 'x2-after-delete-history', scheme);
      await page.getByRole('button', { name: 'Exercise actions' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'x2-after-delete-drawer', scheme);

      await page.goto(`/programs/${programId}/days/${legsId}`);
      await expect(page.getByRole('link', { name: /Zercher Squat/ })).toContainText('Deleted');
      await shot(page, 'x-program-day-deleted-row', scheme);

      await page.goto(`/programs/${programId}`);
      await expect(page.getByRole('button', { name: 'Configure Zercher Squat' })).toContainText('Deleted');
      await shot(page, 'x-program-editor-deleted-row', scheme);
    });

    test(`@visual program editor validation in ink (${scheme})`, async ({ page }) => {
      const { badProgramId } = await seedAll(page);
      await page.goto(`/programs/${badProgramId}`);
      await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
      await page.getByRole('button', { name: 'Activate' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, 'v-program-editor-ink-notice', scheme);

      await page.getByRole('dialog').getByRole('textbox', { name: 'Sets', exact: true }).fill('0');
      await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      await shot(page, 'v-program-editor-ink-field-error', scheme);
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
    const cols = page.locator('.phone-col');
    const count = await cols.count();
    for (let i = 0; i < count; i++) {
      const caption = (await cols.nth(i).locator('.cap b').first().innerText()).trim();
      const id = caption.split(/\s|·/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const phone = cols.nth(i).locator('.phone');
      await phone.scrollIntoViewIfNeeded();
      await phone.screenshot({ path: path.join(OUT, `mockup-${String(i + 1).padStart(2, '0')}-${id}-${scheme}.png`) });
    }
  }
});
