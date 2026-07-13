import { expect, test } from '@playwright/test';

test('boots and navigates every bottom tab', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  await nav.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await nav.getByRole('link', { name: 'Programs' }).click();
  await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible();

  await nav.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();

  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await nav.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
