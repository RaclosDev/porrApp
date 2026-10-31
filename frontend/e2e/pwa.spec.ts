import { expect, test } from '@playwright/test';

test('upgrading the worker removes private API data without deleting unrelated caches', async ({
  page,
  context,
}) => {
  // A static document avoids the application's automatic registration racing the upgrade fixture.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    const legacy = await caches.open('api-runtime-cache');
    await legacy.put(
      '/api/groups/mine',
      new Response(JSON.stringify([{ name: 'Private league A' }])),
    );
    const unrelated = await caches.open('unrelated-cache');
    await unrelated.put('/keep', new Response('keep'));
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  expect(await page.evaluate(() => caches.has('api-runtime-cache'))).toBe(false);
  expect(await page.evaluate(() => caches.has('unrelated-cache'))).toBe(true);

  await context.setOffline(true);
  const response = await page.evaluate(async () => {
    try {
      return await (
        await fetch('/api/groups/mine', { headers: { Authorization: 'Bearer user-B' } })
      ).text();
    } catch {
      return null;
    }
  });
  expect(response).toBeNull();
});

test('private API responses are never reused offline, even if an old cache reappears', async ({
  page,
  context,
}) => {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await page.evaluate(async () => {
    const legacy = await caches.open('api-runtime-cache');
    await legacy.put('/api/groups/mine', new Response('private-user-A'));
  });
  await context.setOffline(true);
  expect(
    await page.evaluate(async () => {
      try {
        return await (await fetch('/api/groups/mine')).text();
      } catch {
        return null;
      }
    }),
  ).toBeNull();
});
