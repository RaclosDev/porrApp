import { expect, test } from '@playwright/test';
import { mockPredictionApp } from './predictionMocks';

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

test('offers notifications on the next session and reminds again after a week', async ({
  page,
}) => {
  await mockPredictionApp(page, 3);
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'default' });
    localStorage.setItem('push_prompt_dismissed_at', String(Date.now()));
  });
  await page.route('**/api/push/config', (route) =>
    route.fulfill({
      json: {
        publicKey: 'test-key',
        remindersEnabled: true,
        memberJoinedEnabled: true,
        matchdayFinishedEnabled: true,
      },
    }),
  );
  const observations: { permission: string; promptShown: boolean }[] = [];
  await page.route('**/api/push/device-state', (route) => {
    observations.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.goto('/');
  const prompt = page.getByRole('region', { name: 'Notificaciones de PorrApp' });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('button', { name: 'Activar avisos' })).toBeInViewport();
  await expect
    .poll(() => observations.some((state) => state.permission === 'default' && state.promptShown))
    .toBe(true);
  await prompt.getByRole('button', { name: 'Recordármelo en una semana' }).click();
  await page.reload();
  await expect(prompt).toBeHidden();
  await page.evaluate(() =>
    localStorage.setItem('push_prompt_v2:7', String(Date.now() - 8 * 24 * 60 * 60 * 1000)),
  );
  await page.reload();
  await expect(prompt).toBeVisible();
});
