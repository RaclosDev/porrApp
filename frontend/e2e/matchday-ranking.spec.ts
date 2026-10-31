import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const width of [360, 390, 1440]) {
  test(`matchday podium and contextual actions fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('activeCompetitionId', '2');
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
    const league = {
      id: 1,
      name: 'Liga de prueba',
      adminUserId: 7,
      competitionId: 2,
      competitionName: 'Mundial 2026',
      formatType: 'LEAGUE',
      poolFormat: 'MATCH_DAY',
      pichichi: false,
      isLocked: false,
    };
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))
        return route.continue();
      if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 7,
          participantName: 'Auditor',
          profileSetupCompleted: true,
          lastSelectedGroupId: 1,
          avatarUrl: null,
        },
        '/api/groups/1': league,
        '/api/groups/mine': [league],
        '/api/groups/1/members': [
          { userId: 7, participantName: 'Auditor', paid: true },
          { userId: 8, participantName: 'Ana', paid: true },
        ],
        '/api/leaderboard': ['Giorgi - Winamax', 'ASB', 'Jokin', 'Neglaso', 'Raclos'].map(
          (name, index) => ({
            id: index + 1,
            userId: index + 7,
            name,
            total: [5, 4, 3, 3, 3][index],
            matchPoints: [5, 4, 3, 3, 3][index],
            pending: false,
            log: [],
          }),
        ),
        '/api/leaderboard/matchdays': [
          {
            label: 'Jornada 12',
            current: true,
            finished: false,
            matchCount: 10,
            pointsByPrediction: { 1: 5, 2: 4, 3: 3, 4: 3, 5: 3 },
          },
        ],
        '/api/standings': {},
        '/api/standings/official-bracket': {},
        '/api/teams/odds': {},
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/ranking');
    const podium = page.getByRole('region', { name: 'Podio de la clasificación general' });
    await expect(podium).toBeVisible();
    await expect(podium.getByText('Giorgi - Winamax')).toBeVisible();
    await expect(podium.getByText('3 empatados')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver desglose por fase' })).toHaveCount(0);
    await expect(page.locator('.ranking-toolbar')).toHaveCount(0);
    const share = page.getByRole('button', { name: 'Compartir clasificación' });
    await expect(share).toBeVisible();
    await expect(page.getByRole('link', { name: 'Estadísticas por partido' })).toHaveAttribute(
      'href',
      '/stats',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`matchday-${width}.png`), fullPage: true });
    await expect(podium.locator('.sticker')).toHaveCount(3);
    await expect(podium.locator('.sticker-featured')).toHaveCount(1);
    await podium.getByText('3 empatados').click();
    for (const name of ['Jokin', 'Neglaso', 'Raclos'])
      await expect(podium.getByText(name, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ordenar por Jornada 12' }).click();
    await expect(podium.getByText('Giorgi - Winamax')).toBeVisible();
    const download = page.waitForEvent('download');
    await share.click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
    expect(errors).toEqual([]);
  });
}
