import { expect, test } from '@playwright/test';
import type { Group } from '../src/types/api';

const league: Group = {
  id: 1,
  name: 'Liga de prueba',
  joinCode: null,
  adminParticipantName: null,
  adminUserId: null,
  createdAt: null,
  competitionId: 2,
  competitionName: 'Competición de prueba',
  formatType: 'TOURNAMENT',
  poolFormat: 'FULL_BRACKET',
  pichichi: false,
  lockDate: null,
  isLocked: false,
  rules: null,
  imageUrl: null,
};

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`league loading ${viewport.name}`, () => {
    test.use({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });

    for (const path of ['/demo', '/bracket', '/grupos', '/tabla']) {
      test(`${path}: delayed group, recoverable error and retry`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          localStorage.setItem('isDemoMode', 'true');
          localStorage.setItem('activeGroupId', '1');
        });

        let releaseGroup!: () => void;
        const groupGate = new Promise<void>((resolve) => {
          releaseGroup = resolve;
        });
        let releaseRetry!: () => void;
        const retryGate = new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        let recover = false;
        let groupRequests = 0;
        await page.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
          if (!url.pathname.startsWith('/api/')) return route.continue();
          if (url.pathname === '/api/groups/1') {
            groupRequests++;
            await groupGate;
            if (!recover)
              return route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } });
            await retryGate;
            return route.fulfill({
              json:
                path === '/tabla'
                  ? { ...league, formatType: 'LEAGUE', poolFormat: 'MATCH_DAY' }
                  : league,
            });
          }
          const responses: Record<string, unknown> = {
            '/api/standings': {},
            '/api/standings/official-bracket': {},
            '/api/teams/odds': {},
            '/api/matches/radar': { live: [], last: [], next: [] },
          };
          return route.fulfill({ json: responses[url.pathname] ?? [] });
        });

        await page.goto(path);
        const loading = page.getByRole('status', { name: 'Cargando liga', exact: true });
        await expect(loading).toBeVisible();
        await expect(loading).toHaveAttribute('aria-busy', 'true');
        await expect(loading.locator('.skeleton').first()).toBeVisible();
        expect(
          await loading.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= 0 && bounds.right <= window.innerWidth;
          }),
        ).toBe(true);
        expect(
          await loading
            .locator('.skeleton')
            .evaluateAll((elements) =>
              elements.every((element) =>
                [getComputedStyle(element), getComputedStyle(element, '::after')].every(
                  (style) => style.animationName === 'none',
                ),
              ),
            ),
        ).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('league-loading.png'), fullPage: true });

        releaseGroup();
        const alert = page.getByRole('alert').filter({ hasText: 'No hemos podido abrir la liga' });
        await expect(alert).toBeVisible({ timeout: 10_000 });
        await expect(loading).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('league-error.png'), fullPage: true });
        const failedRequests = groupRequests;
        expect(failedRequests).toBeGreaterThanOrEqual(1);
        recover = true;
        await alert.getByRole('button', { name: 'Reintentar', exact: true }).click();
        await expect(loading).toBeVisible();
        await expect(alert).toHaveCount(0);
        await expect.poll(() => groupRequests).toBe(failedRequests + 1);
        await page.screenshot({ path: testInfo.outputPath('league-retrying.png'), fullPage: true });
        releaseRetry();

        await expect(alert).toHaveCount(0);
        await expect(loading).toHaveCount(0);
        await expect(page).toHaveURL(path);
        await expect(
          page.locator(path === '/tabla' ? '.standings-page' : '.view-section').first(),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(errors).toEqual([]);
      });
    }
  });
}
