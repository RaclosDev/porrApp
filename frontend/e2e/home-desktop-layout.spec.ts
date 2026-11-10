import { expect, test } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

test('home previews add compact rows only when the match column has room', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  const league = withLeagueKind('matchday', {
    id: 1,
    name: 'Liga de amigos',
    adminUserId: 7,
    competitionId: 2,
    competitionName: 'LaLiga',
    formatType: 'LEAGUE',
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    isLocked: false,
  });
  const players = Array.from({ length: 8 }, (_, index) => ({
    id: index + 7,
    userId: index + 7,
    name: `Amigo ${index + 1}`,
    total: 33 - index,
  }));
  let matchCount = 10;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'local-fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Amigo 1',
        profileSetupCompleted: true,
        lastSelectedGroupId: 1,
      },
      '/api/groups/1': league,
      '/api/groups/mine': [league],
      '/api/leaderboard': players,
      '/api/matches': Array.from({ length: matchCount }, (_, index) => ({
        id: index + 1,
        home: `Local ${index + 1}`,
        away: `Visitante ${index + 1}`,
        date: new Date(Date.now() + (index + 1) * 3_600_000).toISOString(),
        finished: false,
        round: 'Jornada 13',
        status: 'TIMED',
        home_score: null,
        away_score: null,
      })),
      '/api/competitions/2/standings': Array.from({ length: 20 }, (_, index) => ({
        rank: index + 1,
        teamName: `Equipo ${index + 1}`,
        gamesPlayed: 12,
        points: 33 - index,
      })),
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
  await page.goto('/');
  await expect(page.locator('#app-splash')).toBeHidden();
  await expect(page.locator('.home-match-card')).toHaveCount(10);
  await expect(page.locator('.home-summary-panel')).toHaveCount(2);
  const bounds = () =>
    page.locator('.home-dashboard-grid').evaluate((grid) => {
      const matches = grid.children[0].getBoundingClientRect();
      const sidebar = grid.children[1].getBoundingClientRect();
      const panels = [...grid.querySelectorAll('.home-summary-panel')].map((panel) =>
        panel.getBoundingClientRect(),
      );
      return {
        matches: { top: matches.top, bottom: matches.bottom },
        sidebar: { top: sidebar.top, bottom: sidebar.bottom },
        panels: panels.map(({ top, bottom, height }) => ({ top, bottom, height })),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
  const rankingRows = page.getByRole('list', { name: 'Top del ranking' }).getByRole('listitem');
  const tableRows = page.getByRole('list', { name: 'Tabla' }).getByRole('listitem');
  await expect(rankingRows).toHaveCount(8);
  await expect(tableRows.nth(8)).toBeVisible();

  const rowHeight = async () => (await rankingRows.first().boundingBox())?.height ?? 0;
  const desktopRowHeight = await rowHeight();
  const desktop = await bounds();
  expect(Math.abs(desktop.matches.top - desktop.panels[0].top)).toBeLessThan(2);
  const unusedSpace = desktop.matches.bottom - desktop.panels[1].bottom;
  expect(unusedSpace).toBeGreaterThanOrEqual(-1);
  expect(unusedSpace).toBeLessThan(desktopRowHeight + 6);
  expect(desktop.overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rankingRows).toHaveCount(5);
  await expect(tableRows).toHaveCount(5);
  expect(await rowHeight()).toBeCloseTo(desktopRowHeight);
  const mobile = await bounds();
  expect(mobile.sidebar.top).toBeGreaterThan(mobile.matches.bottom);
  expect(mobile.panels[0].height).toBeLessThan(desktop.panels[0].height);
  expect(mobile.overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });

  matchCount = 3;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.locator('#app-splash')).toBeHidden();
  await expect(page.locator('.home-match-card')).toHaveCount(3);
  await expect(rankingRows).toHaveCount(5);
  await expect(tableRows).toHaveCount(5);
  expect(await rowHeight()).toBeCloseTo(desktopRowHeight);
});
