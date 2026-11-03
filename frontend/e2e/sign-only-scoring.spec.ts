import { expect, test } from '@playwright/test';
import { leagueScoring } from '../src/test/fixtures';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const width of [390, 1440]) {
  test(`paused scoring rules remain clear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('isDemoMode', 'true');
      localStorage.setItem('activeGroupId', '1');
    });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const responses: Record<string, unknown> = {
        '/api/groups/1': {
          id: 1,
          name: 'Liga de prueba',
          competitionId: 2,
          competitionName: 'LaLiga',
          formatType: 'LEAGUE',
          poolFormat: 'MATCH_DAY',
          pichichi: false,
          isLocked: false,
        },
        '/api/groups/1/scoring': leagueScoring({ poolFormat: 'MATCH_DAY', matchSignOnly: true }),
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });
    await page.goto('/grupos');
    await page.getByRole('button', { name: 'Reglas', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Provisionalmente solo puntúa el signo 1X2/)).toBeVisible();
    await expect(dialog.getByText('Pausado', { exact: true })).toHaveCount(2);
    await expect(dialog.getByText('Signo 1X2', { exact: true })).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
  });
}
