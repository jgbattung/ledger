import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Exercise = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
);

test('LIB-2: typing "curl" filters the visible list live', async ({ page }) => {
  await page.goto('/library');

  const fullCount = exercises.length;
  await expect(page.getByText(`${fullCount} exercises`)).toBeVisible();

  await page.getByLabel('Search exercises').fill('curl');

  const expectedCount = exercises.filter((e) => e.name.toLowerCase().includes('curl')).length;
  await expect(page.getByText(`${expectedCount} exercises`)).toBeVisible();
  await expect(page.getByText('Barbell Curl', { exact: true })).toBeVisible();
});

test('LIB-3: Muscle=Chest + Equipment=Barbell combine with AND', async ({ page }) => {
  await page.goto('/library');

  await page.getByRole('button', { name: 'Muscle' }).click();
  await page.getByRole('button', { name: 'Chest' }).click();

  const chestExpected = exercises.filter((e) => e.primaryMuscles.includes('chest')).length;
  await expect(page.getByText(`${chestExpected} exercises`)).toBeVisible();

  await page.getByRole('button', { name: 'Equipment' }).click();
  await page.getByRole('button', { name: 'Barbell' }).click();

  const combinedExpected = exercises.filter(
    (e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell',
  );
  await expect(page.getByText(`${combinedExpected.length} exercises`)).toBeVisible();
  await expect(page.getByText(combinedExpected[0].name, { exact: true })).toBeVisible();
});

test('mobile scroll: the full list scrolls to its last exercise', async ({ page }) => {
  await page.goto('/library');

  const lastExercise = exercises[exercises.length - 1];
  await page.getByText(lastExercise.name, { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText(lastExercise.name, { exact: true })).toBeVisible();
});

test('both themes: Library renders after switching theme in Settings', async ({ page }) => {
  await page.goto('/settings');
  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });

  await themeGroup.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Settings' }).click();
  await themeGroup.getByRole('radio', { name: 'Light' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText(exercises[0].name, { exact: true })).toBeVisible();
});
