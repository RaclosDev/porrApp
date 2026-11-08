import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const hours = (offset: number) => new Date(Date.now() + offset * 3_600_000).toISOString();

let nextId = 1;
const match = (
  round: string,
  [homeTeam, awayTeam]: [string, string],
  fields: Record<string, unknown> = {},
) => ({
  matchId: nextId++,
  homeTeam,
  awayTeam,
  homeTeamId: null,
  awayTeamId: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  matchDate: hours(nextId),
  round,
  groupName: null,
  sport: 'TENNIS',
  finished: false,
  status: 'TIMED',
  actualHomeScore: null,
  actualAwayScore: null,
  displayClock: null,
  setsToWin: 2,
  winnerSign: null,
  predHomeScore: null,
  predAwayScore: null,
  predSign: null,
  locked: false,
  lockReason: null,
  pointsAwarded: null,
  isExactScore: null,
  isCorrectSign: null,
  scoringDetails: null,
  ...fields,
});

const won = (home: number, away: number) => ({
  finished: true,
  status: 'FINISHED',
  locked: true,
  actualHomeScore: home,
  actualAwayScore: away,
  winnerSign: home > away ? '1' : '2',
});

async function mockTennisLeague(page: Page, fixtures: unknown[]) {
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('activeGroupId', '1');
    localStorage.setItem('activeCompetitionId', '2');
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  const league = {
    id: 1,
    name: 'Porra de Turín',
    adminUserId: 7,
    competitionId: 2,
    competitionName: 'ATP Finals',
    competitionExternalId: 'tennis.atp.339',
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
      '/api/leaderboard/matchdays': [],
      '/api/predictions/matchday': fixtures,
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
}

test('the ATP Finals before ESPN publishes the draw show a clear empty state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockTennisLeague(page, []);

  await page.goto('/tabla');

  await expect(page.getByRole('link', { name: 'Cuadro' }).first()).toBeVisible();
  await expect(page.getByText('El cuadro aún no está publicado.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.goto('/jornadas');
  await expect(page.getByText(/El cuadro aún no está publicado/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('the Cuadro tab of the ATP Finals shows both groups, the semifinals and your picks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const group = 'Fase de grupos';
  await mockTennisLeague(page, [
    match(group, ['Alcaraz', 'De Minaur'], won(2, 0)),
    match(group, ['Zverev', 'Shelton'], won(2, 0)),
    match(group, ['Fritz', 'Musetti'], won(2, 0)),
    match(group, ['Sinner', 'Auger-Aliassime'], won(2, 0)),
    match(group, ['Alcaraz', 'Fritz'], won(2, 1)),
    match(group, ['Musetti', 'De Minaur'], won(2, 1)),
    match(group, ['Auger-Aliassime', 'Shelton'], won(2, 1)),
    match(group, ['Sinner', 'Zverev'], won(2, 0)),
    match('Semifinales', ['Alcaraz', 'Auger-Aliassime'], { predHomeScore: 2, predAwayScore: 0 }),
    match('Semifinales', ['Sinner', 'Fritz'], { predHomeScore: 1, predAwayScore: 2 }),
  ]);

  await page.goto('/tabla');

  await expect(page.getByRole('heading', { level: 1, name: 'ATP Finals' })).toBeVisible();
  const groupA = page.getByRole('region', { name: 'Grupo A' });
  await expect(groupA.getByRole('row').nth(1)).toContainText('Alcaraz');
  await expect(groupA.getByRole('row').nth(1)).toContainText('Pasa');
  await expect(page.getByRole('region', { name: 'Grupo B' })).toContainText('Sinner');
  const bracket = page.getByRole('region', { name: 'Cuadro' });
  await expect(bracket.getByRole('heading', { name: 'Semifinales' })).toBeVisible();
  await expect(bracket.getByRole('heading', { name: 'Final', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mis predicciones' }).click();
  await expect(bracket.getByText('Según tu predicción')).toBeVisible();
  await expect(bracket).toContainText('tu predicción');

  // Las rondas se desplazan dentro de su caja: la página no se sale de la pantalla.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
