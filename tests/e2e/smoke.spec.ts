import { expect, test } from '@playwright/test';

test('boots and navigates every bottom tab', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await nav.getByRole('link', { name: 'Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout' })).toBeVisible();

  await nav.getByRole('link', { name: 'Levels' }).click();
  await expect(page.getByRole('heading', { name: 'Levels' })).toBeVisible();

  await nav.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();

  // Settings and the exercise catalog live one level below More now.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await nav.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Exercise Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await nav.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('the FAB opens the quick-action sheet', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('button', { name: 'Quick actions' }).click();

  const sheet = page.getByRole('dialog', { name: 'Quick actions' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Start next workout' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // Closing must hand focus back to the FAB, not drop it on <body>. Radix only
  // restores to a <Dialog.Trigger>, and this sheet is controlled by the nav's
  // FAB, so ui/sheet.tsx restores focus itself (WCAG 2.4.3).
  await expect(nav.getByRole('button', { name: 'Quick actions' })).toBeFocused();
});

test('setting persists through reload via real IndexedDB', async ({ page }) => {
  await page.goto('/more/settings');

  const increment = page.getByRole('button', { name: 'Increase default RIR' });
  await expect(increment).toBeVisible();

  const rirValue = page.getByText('Default RIR').locator('..').locator('..').getByText('0', {
    exact: true,
  });
  await expect(rirValue).toBeVisible();

  await increment.click();
  await expect(
    page.getByText('Default RIR').locator('..').locator('..').getByText('1', { exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Increase default RIR' })).toBeVisible();
  await expect(
    page.getByText('Default RIR').locator('..').locator('..').getByText('1', { exact: true }),
  ).toBeVisible();
});

test('theme toggle applies .dark and both themes paint distinct tokens', async ({ page }) => {
  await page.goto('/more/settings');
  await expect(page.getByRole('button', { name: 'Increase default RIR' })).toBeVisible();

  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' });

  await themeGroup.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const darkBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  await themeGroup.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const lightBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  expect(lightBackground).not.toBe(darkBackground);
});
