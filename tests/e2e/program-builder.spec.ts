import { expect, test } from '@playwright/test';
import { addExercises, renameDay } from './program-builder-helpers';

test('program builder: create, save, reload, edit, activate, archive, restore, delete', async ({
  page,
}) => {
  // 1. Empty state -> create the program.
  await page.goto('/workout');
  await page.getByRole('link', { name: 'Create your first program' }).click();
  await page.getByLabel('Program name').fill('Push Pull Legs');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Push Pull Legs' })).toBeVisible();

  // 2. Push day with three exercises from the picker (search + multi-select).
  await renameDay(page, 'Push');
  await addExercises(page, 'bench press', [
    /^Barbell Bench Press/,
    /^Incline Barbell Bench Press/,
    /^Decline Barbell Bench Press/,
  ]);
  await expect(page.getByText('3 exercises')).toBeVisible();

  // 3. Pull day with two exercises, then an empty Rest day.
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await renameDay(page, 'Pull');
  await addExercises(page, 'pull', [/^Pull-Up/]);
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await page.getByLabel('Search exercises').fill('barbell curl');
  await page.getByRole('button', { name: /^Barbell Curl(?!s)/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  await expect(page.getByText('2 exercises')).toBeVisible();
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await renameDay(page, 'Rest');

  // 4. Save -> Workout Library card with 2 workouts.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout Library' })).toBeVisible();
  const card = page.getByRole('link', { name: /Push Pull Legs/ });
  await expect(card).toContainText('2 workouts');

  // 5. The program survives a reload (real IndexedDB).
  await page.reload();
  await expect(page.getByRole('link', { name: /Push Pull Legs/ })).toContainText('2 workouts');

  // 6. Edit (remove an exercise), then Activate.
  await page.getByRole('link', { name: /Push Pull Legs/ }).click();
  await page.getByRole('tab', { name: 'Pull' }).click();
  await page.getByRole('button', { name: 'Remove Barbell Curl' }).click();
  await expect(page.getByText('1 exercise')).toBeVisible();
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByRole('heading', { name: 'Active Program' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Collapse Push Pull Legs' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const rowsId = await toggle.getAttribute('aria-controls');
  await expect(page.locator(`[id="${rowsId}"] > li`)).toHaveCount(3);

  // 7. FAB -> Start new program opens the name prompt; back out clean.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: 'Quick actions' })
    .click();
  await page.getByRole('link', { name: 'Start new program' }).click();
  await expect(page.getByLabel('Program name')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Active Program' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 8. Archive (active -> confirm), find it under Archived, open and Restore.
  await page.getByRole('link', { name: /Push Pull Legs/ }).click();
  await page.getByRole('button', { name: 'Program settings' }).click();
  await page.getByRole('button', { name: 'Archive program' }).click();
  await page
    .getByRole('dialog', { name: 'Archive Push Pull Legs?' })
    .getByRole('button', { name: 'Archive program' })
    .click();
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await page.getByRole('link', { name: /Push Pull Legs/ }).click();
  await page.getByRole('button', { name: 'Program settings' }).click();
  await page.getByRole('button', { name: 'Restore program' }).click();
  await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();

  // 9. Delete (confirm) -> empty state.
  await page.getByRole('button', { name: 'Program settings' }).click();
  await page.getByRole('button', { name: 'Delete program' }).click();
  await page
    .getByRole('dialog', { name: 'Delete Push Pull Legs?' })
    .getByRole('button', { name: 'Delete program' })
    .click();
  await expect(page.getByRole('link', { name: 'Create your first program' })).toBeVisible();
});

test('a dirty editor guards system back with Discard changes', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('link', { name: 'New program' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Day 2' })).toBeVisible();

  await page.goBack();
  const sheet = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('tab', { name: 'Day 2' })).toBeVisible();

  await page.goBack();
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('heading', { name: 'Workout', exact: true })).toBeVisible();
});

test('returning from the picker scrolls the selected far-right day tab into view', async ({ page }) => {
  await page.goto('/programs/new');
  await page.getByRole('button', { name: 'Close' }).click();
  const addDay = page.getByRole('button', { name: 'Day', exact: true });
  for (let i = 2; i <= 30; i++) await addDay.click();
  const last = page.getByRole('tab', { name: 'Day 30' });
  await expect(last).toHaveAttribute('aria-selected', 'true');

  // The editor remounts on return, so a fresh tablist must scroll itself to the selection.
  await page.getByRole('link', { name: 'Add exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Add to Day 30' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect(last).toBeInViewport();
  // Proves the row overflows, so the check above is not vacuous.
  await expect(page.getByRole('tab', { name: 'Day 1', exact: true })).not.toBeInViewport();
});
