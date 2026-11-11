import { expect, test } from '@playwright/test';

// El headless shell no implementa permisos de notificación; usamos Chromium completo en headless.
test.use({ channel: 'chromium' });

test('the installed worker confirms delivery and recovers lost receipts without duplicate cards', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:4173' });
  let acceptReceipt = false;
  const receipts: string[] = [];
  await context.route('**/api/push/receipts', async (route) => {
    const body = route.request().postDataJSON() as { token: string };
    receipts.push(body.token);
    await route.fulfill({ status: acceptReceipt ? 204 : 503, body: '' });
  });
  const cdp = await context.newCDPSession(page);
  let registrationId = '';
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
    const active = registrations.find((item) => !item.isDeleted);
    if (active) registrationId = active.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => registrationId).not.toBe('');
  const token = '12345678-1234-4123-8123-123456789abc';
  const deliver = () =>
    cdp.send('ServiceWorker.deliverPushMessage', {
      origin: new URL(page.url()).origin,
      registrationId,
      data: JSON.stringify({
        title: 'Aviso de prueba',
        body: 'Contenido',
        url: '/',
        receiptToken: token,
        receiptExpiresAt: Date.now() + 3600000,
      }),
    });
  await deliver();
  await expect.poll(() => receipts.length).toBeGreaterThan(0);
  const pendingCount = () =>
    page.evaluate(
      async () => (await (await caches.open('porrapp-push-receipts-v1')).keys()).length,
    );
  await expect.poll(pendingCount).toBe(1);
  acceptReceipt = true;
  await page.evaluate(async () =>
    (await navigator.serviceWorker.ready).active?.postMessage({
      type: 'porrapp:flush-push-receipts',
    }),
  );
  await expect.poll(pendingCount).toBe(0);
  expect(receipts.every((receipt) => receipt === token)).toBe(true);
  const beforeRepeat = receipts.length;
  await deliver();
  await expect.poll(() => receipts.length).toBeGreaterThan(beforeRepeat);
  const cards = await page.evaluate(async () => {
    const notifications = await (await navigator.serviceWorker.ready).getNotifications();
    return notifications.map((item) => ({ tag: item.tag, title: item.title }));
  });
  expect(cards).toEqual([{ tag: 'delivery-' + token, title: 'Aviso de prueba' }]);
});
