import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Exercise = { images: string[] };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exercises: Exercise[] = JSON.parse(
  readFileSync(path.join(root, 'src/exercises/exercises.json'), 'utf-8'),
);
// LG-047: not every curated entry ships with images (net-new additions
// render a placeholder instead) - probe the first one that does.
const probeImage = exercises.find((e) => e.images.length > 0)!.images[0];

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

  const imageOk = await page.evaluate(
    (imagePath) => fetch(`/exercises/${imagePath}`).then((r) => r.ok),
    probeImage,
  );
  expect(imageOk).toBe(true);
});
