// La interfaz local real, con una API interceptada y datos ficticios reproducibles.
// Uso: node docs/screenshots/capture-local.mjs [http://127.0.0.1:5173]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('Las capturas con fixtures solo se ejecutan contra localhost.');
}
const out = fileURLToPath(new URL('./', import.meta.url));
const now = '2026-11-11T18:00:00Z';
const date = (hours) => new Date(new Date(now).getTime() + hours * 3_600_000).toISOString();
const members = ['Ana', 'Berto', 'Carla', 'Diego', 'Elena', 'Félix'].map((name, index) => ({
  userId: index + 7,
  participantName: name,
  avatarUrl: null,
  paid: true,
}));
const league = {
  id: 3,
  name: 'Liga de los colegas',
  adminUserId: 7,
  competitionId: 40,
  competitionName: 'LaLiga',
  sport: 'FOOTBALL',
  formatType: 'LEAGUE',
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
};
const boardLeague = {
  id: 9,
  name: 'Noche de juegos',
  kind: 'SCOREBOARD',
  joinCode: 'DEMO123',
  adminUserId: 7,
  adminParticipantName: 'Ana',
  competitionId: null,
  competitionName: null,
  formatType: null,
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
};
const fixtures = [
  ['Real Madrid', 'Barcelona'],
  ['Atlético de Madrid', 'Sevilla'],
  ['Valencia', 'Betis'],
  ['Athletic Club', 'Real Sociedad'],
  ['Villarreal', 'Celta'],
].map(([homeTeam, awayTeam], index) => ({
  matchId: index + 1,
  homeTeam,
  awayTeam,
  homeTeamId: index * 2 + 10,
  awayTeamId: index * 2 + 11,
  homeTeamLogo: null,
  awayTeamLogo: null,
  matchDate: date(24 + index * 2),
  round: 'Jornada 12',
  groupName: null,
  finished: false,
  status: 'SCHEDULED',
  actualHomeScore: null,
  actualAwayScore: null,
  displayClock: null,
  predHomeScore: null,
  predAwayScore: null,
  predSign: ['1', 'X', '2'][index] ?? null,
  locked: false,
  lockReason: null,
  pointsAwarded: null,
  isExactScore: null,
  isCorrectSign: null,
  scoringDetails: null,
}));
const matches = fixtures.map((match) => ({
  id: match.matchId,
  home: match.homeTeam,
  away: match.awayTeam,
  home_team_id: match.homeTeamId,
  away_team_id: match.awayTeamId,
  date: match.matchDate,
  finished: false,
  round: match.round,
  status: 'TIMED',
  home_score: null,
  away_score: null,
  homeScore: null,
  awayScore: null,
}));
const players = ['Ana', 'Berto', 'Carla'].map((name, index) => ({ id: index + 11, name }));
const rounds = [
  [8, 6, 10],
  [10, 7, 9],
  [9, 10, 7],
].map((scores, index) => ({
  id: index + 40,
  sessionId: 20,
  number: index + 1,
  note: null,
  createdAt: now,
  scores: Object.fromEntries(players.map((player, i) => [player.id, scores[i]])),
  recordedBy: 'Ana',
  revision: 0,
}));
const standings = players
  .map((player) => ({
    playerId: player.id,
    name: player.name,
    total: rounds.reduce((sum, round) => sum + round.scores[player.id], 0),
    roundsWon: 1,
    sessionsWon: 0,
    rank: 0,
  }))
  .sort((a, b) => b.total - a.total)
  .map((row, index) => ({ ...row, rank: index + 1 }));
const tracker = {
  id: 9,
  name: 'Noche de juegos',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'DEMO123',
  myPlayerId: 11,
  claimedPlayerIds: [11],
  currentSessionId: 20,
  currentDayId: 1,
  currentGameId: 3,
  players,
  games: [
    {
      id: 3,
      name: 'Catán',
      unit: 'puntos',
      lowerWins: false,
      mode: 'POINTS',
      sessions: 1,
      rounds: 3,
    },
  ],
  days: [{ id: 1, startedAt: now, closedAt: null, playerIds: [11, 12, 13], sessionIds: [20] }],
  sessions: [
    {
      id: 20,
      number: 1,
      gameId: 3,
      dayId: 1,
      playerIds: [11, 12, 13],
      startedAt: now,
      endedAt: null,
      plannedRounds: null,
      rounds: 3,
      standings,
      winners: [],
    },
  ],
  rounds,
  overall: standings,
};

const browser = await chromium.launch();
try {
  for (const groupId of [3, 9]) {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date(now));
    await page.addInitScript((activeGroupId) => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Ana');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', String(activeGroupId));
      localStorage.setItem('activeCompetitionId', '40');
      localStorage.setItem('passkey_prompt_answered:7', '1');
    }, groupId);
    const responses = {
      '/api/auth/session/refresh': { token: 'local-fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Ana',
        profileSetupCompleted: true,
        lastSelectedGroupId: groupId,
        avatarUrl: null,
      },
      '/api/groups/mine': [league, boardLeague],
      '/api/groups/3': league,
      '/api/groups/9': boardLeague,
      '/api/groups/3/members': members,
      '/api/predictions/mine': [],
      '/api/matches': matches,
      '/api/predictions/matchday': fixtures,
      '/api/leaderboard': members.map((member, index) => ({
        id: index + 1,
        userId: member.userId,
        name: member.participantName,
        total: 128 - index * 11,
        matchPoints: 128 - index * 11,
        pending: false,
        log: [],
      })),
      '/api/leaderboard/matchdays': [
        {
          label: 'Jornada 12',
          current: true,
          finished: false,
          matchCount: 5,
          pointsByPrediction: { 1: 8, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 },
        },
      ],
      '/api/matches/radar': { live: [], last: [], next: [] },
      '/api/trackers': [{ id: 9, name: 'Noche de juegos', owner: true, players: 3, rounds: 3 }],
      '/api/trackers/9': tracker,
    };
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (['fonts.googleapis.com', 'fonts.gstatic.com', 'flagcdn.com'].includes(url.hostname)) {
        return route.continue();
      }
      if (url.origin !== base.origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });
    const shot = async (name) => {
      const rejectCookies = page.getByRole('button', { name: 'Rechazar', exact: true });
      if (await rejectCookies.isVisible()) await rejectCookies.click();
      await page.evaluate(async () => {
        await Promise.all(
          ['Inter', 'Anton', 'Permanent Marker', 'Outfit'].map((font) =>
            document.fonts.load(`16px "${font}"`),
          ),
        );
        await document.fonts.ready;
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      for (const font of ['Inter', 'Anton', 'Permanent Marker', 'Outfit']) {
        expect(
          await page.evaluate((family) => document.fonts.check(`16px "${family}"`), font),
        ).toBe(true);
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
      console.log(`✓ ${name}.png`);
    };
    if (groupId === 3) {
      await page.goto(new URL('/?group=3', base).href);
      await page.getByRole('heading', { name: 'Liga de los colegas', exact: true }).waitFor();
      await page.getByText('Real Madrid', { exact: true }).first().waitFor();
      await shot('league-home');
      await page.goto(new URL('/jornadas?group=3', base).href);
      await page.getByText('Real Madrid', { exact: true }).first().waitFor();
      await shot('matchday');
    } else {
      await page.goto(new URL('/partida?group=9', base).href);
      await page.getByRole('heading', { name: 'Catán · partida 1' }).waitFor();
      await shot('scoreboard');
    }
    await context.close();
  }
} finally {
  await browser.close();
}
