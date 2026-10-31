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
  test.describe(`paper loading ${viewport.name}`, () => {
    test.use({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });

    for (const { path, label, content } of [
      { path: '/grupos', label: 'Cargando grupos', content: '#view-home' },
      { path: '/radar', label: 'Cargando partidos', content: '#view-radar' },
    ]) {
      test(`${path}: paper remains after league metadata loads`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          localStorage.setItem('isDemoMode', 'true');
          localStorage.setItem('activeGroupId', '1');
        });

        let releaseData!: () => void;
        const dataGate = new Promise<void>((resolve) => {
          releaseData = resolve;
        });
        let groupLoaded = false;
        await page.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
          if (!url.pathname.startsWith('/api/')) return route.continue();
          if (url.pathname === '/api/groups/1') {
            await route.fulfill({ json: league });
            groupLoaded = true;
            return;
          }
          if (['/api/standings', '/api/matches', '/api/teams/odds'].includes(url.pathname)) {
            await dataGate;
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
        await expect.poll(() => groupLoaded).toBe(true);
        const loading = page.getByRole('status', { name: label, exact: true });
        await expect(loading).toBeVisible();
        await expect(loading).toHaveClass(/paper-panel album-sheet/);
        await expect(loading).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('status', { name: 'Cargando liga', exact: true })).toHaveCount(
          0,
        );
        await expect(page.locator('.skeleton-card')).toHaveCount(0);
        await expect(loading.locator('.league-loading__card')).toHaveCount(2);
        expect(
          await loading
            .locator('.skeleton')
            .evaluateAll(
              (elements) =>
                elements.length > 0 &&
                elements.every((element) =>
                  [getComputedStyle(element), getComputedStyle(element, '::after')].every(
                    (style) => style.animationName === 'none',
                  ),
                ),
            ),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: testInfo.outputPath('paper-loading.png'), fullPage: true });

        releaseData();
        await expect(loading).toHaveCount(0);
        await expect(page.locator(content)).toBeVisible();
        await expect(page).toHaveURL(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(errors).toEqual([]);
      });
    }
  });
}
