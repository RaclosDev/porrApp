import { expect, test } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const names = ['Giorgi', 'ASB', 'Jokin', 'Neglaso', 'Auditor'];

for (const width of [375, 1280]) {
  test(`a finished league opens with its closing and shares a summary at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('userId', '11');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('activeCompetitionId', '2');
      // La oferta de llave de acceso ya contestada: sale por encima de todo.
      localStorage.setItem('passkey_prompt_answered:11', '1');
      // El resumen compartido queda a la vista del test en vez de abrir la hoja del sistema.
      const shared: unknown[] = [];
      Object.assign(window, { sharedSummaries: shared });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: unknown) => {
          shared.push(data);
          return Promise.resolve();
        },
      });
    });
    const league = withLeagueKind('matchday', {
      id: 1,
      name: 'Tebas League',
      adminUserId: 7,
      competitionId: 2,
      competitionName: 'LaLiga',
      formatType: 'LEAGUE',
      poolFormat: 'MATCH_DAY',
      pichichi: false,
      isLocked: false,
    });
    const played = new Date(Date.now() - 5 * 3_600_000).toISOString();
    let finished = true;
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))
        return route.continue();
      if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 11,
          participantName: 'Auditor',
          profileSetupCompleted: true,
          lastSelectedGroupId: 1,
          avatarUrl: null,
        },
        '/api/groups/1': league,
        '/api/groups/mine': [league],
        '/api/groups/mine/summary': [
          { groupId: 1, rank: 4, points: 61, participants: 5, pendingPredictions: 0, finished },
        ],
        '/api/leaderboard': names.map((name, index) => ({
          id: index + 1,
          userId: index + 7,
          name,
          total: [98, 90, 74, 74, 61][index],
          matchPoints: [98, 90, 74, 74, 61][index],
          pending: false,
          log: [],
        })),
        '/api/matches': [
          {
            id: 1,
            home: 'Deportivo',
            away: 'Osasuna',
            date: played,
            finished: true,
            round: 'Jornada 38',
            status: 'FINISHED',
            home_score: 2,
            away_score: 1,
            homeScore: 2,
            awayScore: 1,
          },
        ],
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/');
    const closing = page.getByRole('region', { name: 'Giorgi gana Tebas League' });
    await expect(closing).toBeVisible();
    await expect(closing).toContainText('Liga terminada');
    const podium = closing.getByRole('region', { name: 'Podio final' });
    await expect(podium.locator('.ranking-podium-place')).toHaveCount(3);
    await expect(podium).toContainText('Empate');
    await expect(closing).toContainText('Has quedado 4.º de 5 con 61 pts');
    // El cierre va encima del inicio de siempre y no ensancha la página.
    await expect(page.getByRole('heading', { name: 'Tebas League', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await closing.getByRole('button', { name: 'Compartir resultado' }).click();
    const shared = await page.evaluate(
      () =>
        (window as unknown as { sharedSummaries: { title: string; text: string; url: string }[] })
          .sharedSummaries,
    );
    expect(shared).toEqual([
      {
        title: 'Final de Tebas League',
        text: [
          '🏆 Giorgi gana «Tebas League» (LaLiga)',
          '1.º Giorgi · 98 pts',
          '2.º ASB · 90 pts',
          '3.º Jokin y Neglaso · 74 pts',
          'Yo: 4.º de 5 · 61 pts',
        ].join('\n'),
        url: 'http://127.0.0.1:4173/?group=1',
      },
    ]);

    await closing.getByRole('link', { name: 'Ver clasificación' }).click();
    await expect(page).toHaveURL(/\/ranking/);

    // Con la liga aún en juego el inicio es el de siempre.
    finished = false;
    await page.goto('/');
    await expect(page.getByRole('list', { name: 'Top del ranking' })).toBeVisible();
    await expect(page.getByText('Liga terminada')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
