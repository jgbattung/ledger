import { expect, test } from '@playwright/test';

// Asset-level proof of the LIB-1 offline promise: a prod build's service
// worker precaches the app shell plus every vendored exercise image, so a
// fresh airplane-mode launch still boots and can serve a cached image.
// Runs against `vite preview` (offline-chrome project) - the dev server has
// no service worker.
test('boots offline and serves a precached exercise image after SW install', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);

  await page.goto('/');

  // First load is uncontrolled until clientsClaim kicks in; wait for the SW
  // to activate, then reload so this page is actually controlled.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 120_000,
  });

  await context.setOffline(true);
  await page.reload();

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();

  const imageOk = await page.evaluate(() =>
    fetch('/exercises/Barbell_Squat/0.jpg').then((r) => r.ok),
  );
  expect(imageOk).toBe(true);
});
