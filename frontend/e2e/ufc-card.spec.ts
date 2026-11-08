import { expect, test, type Page } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const EVENT = 'UFC Fight Night: Rojo vs. Azul';
const hours = (offset: number) => new Date(Date.now() + offset * 3_600_000).toISOString();

const fight = (
  matchId: number,
  [homeTeam, awayTeam]: [string, string],
  segment: 'MAIN' | 'PRELIMS',
  order: number,
  fields: Record<string, unknown> = {},
  result: Record<string, unknown> = {},
) => ({
  matchId,
  homeTeam,
  awayTeam,
  homeTeamId: null,
  awayTeamId: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  matchDate: hours(segment === 'MAIN' ? 2 : -2),
  round: EVENT,
  groupName: null,
  sport: 'MMA',
  finished: false,
  status: 'TIMED',
  actualHomeScore: null,
  actualAwayScore: null,
  displayClock: null,
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
  fight: {
    eventId: '1',
    eventName: EVENT,
    segment,
    order,
    weightClass: 'Middleweight',
    scheduledRounds: order === 1 ? 5 : 3,
    homeRecord: '15-2-0',
    awayRecord: '11-4-1',
    resultMethod: null,
    resultDetail: null,
    resultRound: null,
    resultClock: null,
    winner: null,
    ...result,
  },
});

async function mockUfcLeague(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('activeGroupId', '1');
    localStorage.setItem('activeCompetitionId', '2');
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  const league = withLeagueKind('fightCard', {
    id: 1,
    name: 'Veladas del sábado',
    adminUserId: 7,
    competitionId: 2,
    competitionName: 'UFC',
    competitionExternalId: 'mma.ufc',
    // Así llega la UFC del servidor: su formato es por veladas.
    formatType: 'EVENTS',
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    isLocked: false,
  });
  const fixtures = [
    fight(1, ['Ramón Rojo', 'Ángel Azul'], 'MAIN', 1, { predSign: '2' }),
    fight(
      2,
      ['Iker Ibarra', 'Pol Puig'],
      'PRELIMS',
      7,
      { finished: true, status: 'FINISHED', locked: true, predSign: '1', pointsAwarded: 3 },
      {
        winner: '1',
        resultMethod: 'KO_TKO',
        resultDetail: 'KO/TKO - Punches',
        resultRound: 2,
        resultClock: '4:39',
      },
    ),
  ];
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
      '/api/leaderboard/matchdays': [
        {
          label: EVENT,
          date: hours(-2),
          finished: false,
          current: true,
          matchCount: 2,
          pointsByPrediction: {},
        },
      ],
      '/api/predictions/matchday': fixtures,
      '/api/predictions/matchday/stats': {
        members: 6,
        matches: [
          {
            matchId: 2,
            round: EVENT,
            matchDate: hours(-2),
            homeTeam: 'Iker Ibarra',
            awayTeam: 'Pol Puig',
            homeTeamLogo: null,
            awayTeamLogo: null,
            finished: true,
            live: false,
            homeScore: 1,
            awayScore: 0,
            predictions: 5,
            homeWins: 4,
            draws: 0,
            awayWins: 1,
            topScores: [],
            exactHits: 4,
            signHits: 4,
            methods: [
              { method: 'KO_TKO', count: 3 },
              { method: 'DECISION', count: 1 },
            ],
          },
        ],
      },
      '/api/matches/radar': { live: [], last: [], next: [] },
      // Los partidos de la competición, como los da MatchResponseDTO: con su pelea.
      '/api/matches': fixtures.map((f) => ({
        id: f.matchId,
        home: f.homeTeam,
        away: f.awayTeam,
        home_team_id: null,
        away_team_id: null,
        homeLogo: null,
        awayLogo: null,
        homeTeamLogo: null,
        awayTeamLogo: null,
        homeScore: f.finished ? (f.fight.winner === '1' ? 1 : 0) : null,
        awayScore: f.finished ? (f.fight.winner === '2' ? 1 : 0) : null,
        home_score: f.finished ? (f.fight.winner === '1' ? 1 : 0) : null,
        away_score: f.finished ? (f.fight.winner === '2' ? 1 : 0) : null,
        date: f.matchDate,
        finished: f.finished,
        round: f.round,
        groupName: null,
        winner: null,
        displayClock: null,
        isStartingSoon: false,
        status: f.finished ? 'FINISHED' : 'TIMED',
        fight: f.fight,
      })),
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
}

test('the Tabla tab of a UFC league is the fight card, with the league split and your pick', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockUfcLeague(page);

  await page.goto('/tabla');

  await expect(page.getByRole('heading', { level: 1, name: EVENT })).toBeVisible();
  // La pestaña se llama como lo que enseña.
  await expect(page.getByRole('link', { name: 'Cartelera' }).first()).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  const finished = page.getByRole('article', { name: 'Iker Ibarra contra Pol Puig' });
  await expect(finished).toContainText('KO/TKO (puñetazos) · Asalto 2 · Tiempo: 4:39');
  await expect(finished.getByTitle('Victoria')).toHaveText(/W/);
  await expect(finished.getByTitle('Derrota')).toHaveText(/L/);
  await expect(finished).toContainText('80 %');
  await expect(finished).toContainText('Método favorito: KO/TKO (75 %)');
  await expect(finished).toContainText('+3 puntos');

  const main = page.getByRole('article', { name: 'Ramón Rojo contra Ángel Azul' });
  await expect(main).toContainText('Pelea estelar');
  await expect(main).toContainText('se verá cuando se cierre la predicción');
  await expect(main).toContainText('Tu predicción: Ángel Azul');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('the home page shows a finished UFC fight with W and L badges and how it ended, not a score', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockUfcLeague(page);

  await page.goto('/');

  const card = page.locator('.home-match-card').filter({ hasText: 'Iker Ibarra' });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText('1 - 0');
  await expect(card.getByTitle('Victoria')).toHaveText(/W/);
  await expect(card.getByTitle('Derrota')).toHaveText(/L/);
  await expect(card).toContainText('KO/TKO (puñetazos) · Asalto 2 · Tiempo: 4:39');
  // W en azul y L en rojo, con texto blanco.
  const colors = await card
    .locator('.fight-badge')
    .evaluateAll((badges) =>
      badges.map((badge) => [
        getComputedStyle(badge).backgroundColor,
        getComputedStyle(badge).color,
      ]),
    );
  expect(colors).toEqual([
    ['rgb(29, 78, 216)', 'rgb(255, 255, 255)'],
    ['rgb(185, 28, 28)', 'rgb(255, 255, 255)'],
  ]);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
