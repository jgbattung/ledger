import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addExercises, configureExercise, renameDay } from './program-builder-helpers';

/**
 * LG-020 visual gate. An artifact generator, not an assertion suite: it walks
 * every program-builder screen in both themes and writes full-viewport PNGs to
 * test-results/lg-020-screens/. Tagged @visual and excluded from the default
 * run (see playwright.config.ts); run with `npm run test:visual`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'test-results', 'lg-020-screens');
const MOCKUP = `file:///${path.join(root, '.lavish', 'program-builder-alignment.html').replace(/\\/g, '/')}`;

// LG-052 screens (per-exercise config drawer) go to their own folder.
const OUT_052 = path.join(root, 'test-results', 'lg-052-screens');
const MOCKUP_052 = `file:///${path.join(root, '.lavish', 'per-exercise-config-alignment.html').replace(/\\/g, '/')}`;

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

async function shot(page: Page, name: string, scheme: Scheme) {
  // Let sheets and tabs settle (reduced motion is on, this just covers paint).
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
}

async function createProgram(
  page: Page,
  name: string,
  days: { name: string; exercises: string[] }[],
  activate = false,
) {
  await page.goto('/workout');
  await page.getByRole('link', { name: 'New program' }).click();
  await page.getByLabel('Program name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const [index, day] of days.entries()) {
    if (index > 0) await page.getByRole('button', { name: 'Day', exact: true }).click();
    await renameDay(page, day.name);
    for (const exercise of day.exercises) {
      await addExercises(page, exercise, [new RegExp(`^${exercise}(?![a-z]| To| from)`)]);
    }
  }
  if (activate) {
    // Activation needs sets and reps on every exercise (LG-052).
    for (const day of days) {
      if (day.exercises.length === 0) continue;
      await page.getByRole('tab', { name: day.name, exact: true }).click();
      for (const exercise of day.exercises) {
        await configureExercise(page, exercise, { sets: '3', min: '8', max: '12' });
      }
    }
  }
  await page.getByRole('button', { name: activate ? 'Activate' : 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout', exact: true })).toBeVisible();
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`@visual empty state (${scheme})`, async ({ page }) => {
      await page.goto('/workout');
      await expect(page.getByRole('link', { name: 'Create your first program' })).toBeVisible();
      await shot(page, 'workout-empty', scheme);
    });

    test(`@visual program builder screens (${scheme})`, async ({ page }) => {
      test.setTimeout(180_000);

      await createProgram(page, 'Upper / Lower', [{ name: 'Upper', exercises: ['Pull-Up'] }]);
      await createProgram(page, 'Old Plan', [{ name: 'Full body', exercises: ['Pull-Up'] }]);
      await page.getByRole('link', { name: /Old Plan/ }).click();
      await page.getByRole('button', { name: 'Program settings' }).click();
      await page.getByRole('button', { name: 'Archive program' }).click();
      await expect(page.getByRole('button', { name: /Archived · 1/ })).toBeVisible();
      await createProgram(
        page,
        'Push Pull Legs',
        [
          {
            name: 'Push',
            exercises: [
              'Barbell Bench Press',
              'Incline Dumbbell Press',
              'Cable Lateral Raise',
              'Rope Triceps Pushdown',
            ],
          },
          { name: 'Pull', exercises: ['Pull-Up', 'Barbell Curl'] },
          { name: 'Legs', exercises: ['Barbell Deadlift'] },
          { name: 'Rest', exercises: [] },
        ],
        true,
      );

      // Workout tab: active + library, then with Archived expanded.
      await shot(page, 'workout-tab', scheme);
      await page.getByRole('button', { name: /Archived · 1/ }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: /Archived · 1/ }).click();
      await shot(page, 'workout-tab-archived', scheme);

      // Name prompt on a new program.
      await page.getByRole('link', { name: 'New program' }).click();
      await expect(page.getByLabel('Program name')).toBeVisible();
      await shot(page, 'name-prompt', scheme);
      await page.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Back' }).click();

      // Editor: workout day, rest day, settings, delete confirm, discard confirm.
      await page.getByRole('link', { name: /Push Pull Legs/ }).click();
      await expect(page.getByRole('tab', { name: 'Push' })).toBeVisible();
      await shot(page, 'editor-day', scheme);
      await page.getByRole('tab', { name: 'Rest' }).click();
      await shot(page, 'editor-rest', scheme);
      await page.getByRole('tab', { name: 'Push' }).click();
      await page.getByRole('button', { name: 'Program settings' }).click();
      await shot(page, 'settings-drawer', scheme);
      await page.getByRole('button', { name: 'Delete program' }).click();
      await shot(page, 'delete-confirm', scheme);
      await page.getByRole('button', { name: 'Keep it' }).click();
      await page.getByRole('button', { name: 'Day', exact: true }).click();
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
      await shot(page, 'discard-confirm', scheme);
      await page.getByRole('button', { name: 'Keep editing' }).click();

      // Picker: two selected, one row already in the day.
      await page.getByRole('tab', { name: 'Push' }).click();
      await page.getByRole('link', { name: 'Add exercises' }).click();
      await page.getByLabel('Search exercises').fill('bench press');
      await page.getByRole('button', { name: /^Incline Barbell Bench Press/ }).click();
      await page.getByRole('button', { name: /^Decline Barbell Bench Press/ }).click();
      await shot(page, 'picker', scheme);

      // BackLink regression screens.
      await page.goto('/more/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await shot(page, 'settings', scheme);
      await page.goto('/more/library');
      await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
      await shot(page, 'library', scheme);
    });
  });
}

test('@visual approved mockup screens, both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP);
  await page.waitForLoadState('load');
  const screens = await page
    .locator('figure[data-screen]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-screen') as string));
  for (const scheme of SCHEMES) {
    await page.evaluate((dark) => (window as unknown as { setTheme: (d: boolean) => void }).setTheme(dark), scheme === 'dark');
    for (const name of screens) {
      await page
        .locator(`figure[data-screen="${name}"] .phone`)
        .screenshot({ path: path.join(OUT, `mockup-${name}-${scheme}.png`) });
    }
  }
});

for (const scheme of SCHEMES) {
  test(`@visual exercise config screens (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const snap = async (name: string) => {
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT_052, `${name}-${scheme}.png`) });
    };

    await page.goto('/workout');
    await page.getByRole('link', { name: 'Create your first program' }).click();
    await page.getByLabel('Program name').fill('Upper / Lower');
    await page.getByRole('button', { name: 'Continue' }).click();
    await renameDay(page, 'Upper A');
    for (const exercise of ['Barbell Bench Press', 'Bent Over Barbell Row', 'Cable Lateral Raise']) {
      await addExercises(page, exercise, [new RegExp(`^${exercise}(?![a-z]| To| from)`)]);
    }
    await configureExercise(page, 'Barbell Bench Press', { sets: '3', min: '6', max: '8' });
    await configureExercise(page, 'Bent Over Barbell Row', { sets: '4', min: '8', max: '8', rest: '230' });

    // 1. Editor rows: configured and unconfigured.
    await snap('editor-rows');

    // 2. Drawer, blank.
    await page.getByRole('button', { name: 'Configure Cable Lateral Raise', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snap('drawer-blank');

    // 3. Drawer, filled.
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Sets', exact: true }).fill('3');
    await dialog.getByRole('textbox', { name: 'Rep min' }).fill('12');
    await dialog.getByRole('textbox', { name: 'Rep max' }).fill('15');
    await dialog.getByRole('textbox', { name: 'RIR' }).fill('1');
    await dialog.getByRole('textbox', { name: 'Rest', exact: true }).fill('130');
    await dialog.getByRole('textbox', { name: 'Warm-ups' }).fill('0');
    await dialog.getByRole('textbox', { name: 'Notes' }).fill('Slow on the way down');
    await snap('drawer-filled');

    // 4. Validation error.
    await dialog.getByRole('textbox', { name: 'Rep min' }).fill('16');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByText("Min can't be more than max.")).toBeVisible();
    await snap('drawer-error');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();

    // 5. Activation gate notice.
    await page.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByText('Set sets and reps to activate this program.')).toBeVisible();
    await snap('drawer-gate');
  });
}

test('@visual per-exercise config mockup screens, both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(MOCKUP_052);
  await page.waitForLoadState('load');
  const names = ['rows', 'drawer', 'gate'];
  for (const scheme of SCHEMES) {
    await page.evaluate(
      (dark) => (window as unknown as { setTheme: (d: boolean) => void }).setTheme(dark),
      scheme === 'dark',
    );
    for (const [index, name] of names.entries()) {
      await page
        .locator('#phones .phone')
        .nth(index)
        .screenshot({ path: path.join(OUT_052, `mockup-${name}-${scheme}.png`) });
    }
  }
});
