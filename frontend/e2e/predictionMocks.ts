import type { Page } from '@playwright/test';
import { WORLD_CUP_2026_FORMAT } from '../src/utils/firstKnockoutRound';
import { withLeagueKind } from './leagueKind';

const ORIGIN = 'http://127.0.0.1:4173';

const TEAMS = [
  'Alemania',
  'España',
  'Francia',
  'Argentina',
  'Brasil',
  'Inglaterra',
  'Portugal',
  'Países Bajos',
  'Bélgica',
  'Croacia',
  'Uruguay',
  'Colombia',
  'México',
  'Estados Unidos',
  'Canadá',
  'Japón',
  'Corea del Sur',
  'Australia',
  'Marruecos',
  'Senegal',
  'Suiza',
  'Escocia',
  'Ecuador',
  'Irán',
  'Arabia Saudí',
  'Catar',
  'Ghana',
  'Túnez',
  'Egipto',
  'Paraguay',
  'Noruega',
  'Austria',
];

const pairs = (names: string[]) =>
  names.reduce<string[][]>((all, name, index) => {
    if (index % 2 === 0) all.push([name, names[index + 1]]);
    return all;
  }, []);
const every = (step: number) => TEAMS.filter((_, index) => index % step === 0);

const worldPrediction = {
  topologyVersion: 2,
  user: 'Auditor',
  prediction: 'Mi porra',
  r32: pairs(TEAMS),
  r16: pairs(every(2)),
  qf: pairs(every(4)),
  sf: pairs(every(8)),
  final: every(16),
  champion: TEAMS[0],
  thirdPlaceMatch: [TEAMS[8], TEAMS[24]],
  thirdPlaceWinner: TEAMS[8],
};

const worldLeague = withLeagueKind('groupStage', {
  id: 1,
  name: 'Porra Global',
  joinCode: null,
  adminParticipantName: null,
  adminUserId: 7,
  createdAt: null,
  competitionId: 20,
  competitionName: 'Mundial 2026',
  competitionExternalId: 'fifa.world',
  groupTournament: true,
  formatType: 'TOURNAMENT',
  poolFormat: 'FULL_BRACKET',
  pichichi: false,
  lockDate: null,
  isLocked: true,
  rules: null,
  imageUrl: null,
});

const customLeague = withLeagueKind('customBracket', {
  id: 2,
  name: 'Torneo del barrio',
  adminUserId: 7,
  competitionId: 30,
  competitionName: 'Torneo del barrio',
  customCompetition: true,
  formatType: 'TOURNAMENT',
  poolFormat: 'KNOCKOUTS_ONLY',
  pichichi: false,
  isLocked: false,
});

const matchdayLeague = withLeagueKind('matchday', {
  id: 3,
  name: 'Champions de los colegas',
  adminUserId: 7,
  competitionId: 40,
  competitionName: 'LaLiga',
  formatType: 'LEAGUE',
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
});

const customMatch = (id: number, home: string, away: string | null) => ({
  id,
  home,
  away: away ?? '',
  home_team_id: id * 10,
  away_team_id: away ? id * 10 + 1 : null,
  homeLogo: null,
  awayLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
  home_score: null,
  away_score: null,
  date: '2026-12-20T18:00:00+01:00',
  finished: false,
  round: 'bracket-1',
  groupName: null,
  winner: null,
  displayClock: null,
  isStartingSoon: false,
  status: '',
});

const fixture = (matchId: number, homeTeam: string, awayTeam: string) => ({
  matchId,
  homeTeam,
  awayTeam,
  homeTeamId: matchId * 10,
  awayTeamId: matchId * 10 + 1,
  homeTeamLogo: null,
  awayTeamLogo: null,
  matchDate: '2026-12-20T18:00:00+01:00',
  round: 'Jornada 15',
  groupName: null,
  finished: false,
  status: 'SCHEDULED',
  actualHomeScore: null,
  actualAwayScore: null,
  displayClock: null,
});

const log = [
  ...every(2).map((name) => ({ stage: 'r32', amount: 2, msg: `${name} pasa a octavos` })),
  ...every(4).map((name) => ({ stage: 'r16', amount: 4, msg: `${name} pasa a cuartos` })),
  ...every(8).map((name) => ({ stage: 'qf', amount: 0, msg: `${name} pasa a semifinales` })),
];

/** Las tres ligas de las pruebas: el Mundial ya puntuado, un cuadro propio y una de jornadas. */
export const LEAGUES = { world: 1, custom: 2, matchday: 3 } as const;

/**
 * Sesión iniciada con la liga indicada como activa y toda la API simulada. Devuelve las peticiones
 * de escritura que hace la app.
 */
export async function mockPredictionApp(page: Page, activeGroupId: 1 | 2 | 3) {
  const posts: string[] = [];
  await page.addInitScript((groupId) => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('activeGroupId', String(groupId));
    localStorage.setItem('passkey_prompt_answered:7', '1');
  }, activeGroupId);
  const leagues = [worldLeague, customLeague, matchdayLeague];
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (['fonts.googleapis.com', 'fonts.gstatic.com', 'flagcdn.com'].includes(url.hostname))
      return route.continue();
    if (url.origin !== ORIGIN) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (request.method() !== 'GET' && !url.pathname.startsWith('/api/auth/')) {
      posts.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({
        json: { id: 99, status: 'creada_con_exito', success: true, saved: 1, message: '' },
      });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'local-fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Auditor',
        profileSetupCompleted: true,
        lastSelectedGroupId: activeGroupId,
        avatarUrl: null,
      },
      '/api/groups/1': worldLeague,
      '/api/groups/2': customLeague,
      '/api/groups/3': matchdayLeague,
      '/api/groups/mine': leagues,
      '/api/predictions/mine':
        activeGroupId === 1
          ? [
              {
                key: '21',
                hash: null,
                paid: true,
                participantName: 'Auditor',
                userId: 7,
                predictionName: 'Mi porra',
                groupId: 1,
                data: worldPrediction,
              },
            ]
          : [],
      '/api/predictions/21': worldPrediction,
      '/api/predictions/21/score': {
        id: 21,
        userId: 7,
        name: 'Auditor',
        predictionName: 'Mi porra',
        total: 48,
        r32: 32,
        r16: 16,
        pending: false,
        log,
      },
      '/api/leaderboard': [
        { id: 21, userId: 7, name: 'Auditor', total: 48, pending: false, log: [] },
      ],
      '/api/competitions/20/tournament/format': WORLD_CUP_2026_FORMAT,
      '/api/competitions/20/tournament/standings': {},
      '/api/competitions/20/tournament/official-bracket': { r32: pairs(TEAMS) },
      '/api/competitions/20/tournament/group-odds': {},
      '/api/groups/2/competition/teams': ['Rojos', 'Azules', 'Verdes', 'Negros', 'Blancos'].map(
        (name, index) => ({ id: index + 1, name, groupName: null, logoUrl: null }),
      ),
      '/api/groups/2/competition/matches': [
        customMatch(1, 'Rojos', 'Azules'),
        customMatch(2, 'Verdes', 'Negros'),
        customMatch(3, 'Blancos', null),
      ],
      '/api/groups/2/competition/lock-state': {
        mode: 'FIXED_DATE',
        offsetMinutes: 0,
        lockDate: '2026-12-20T18:00:00+01:00',
        lockedGroups: [],
        lockedPicks: [],
        anyLocked: false,
        fullyLocked: false,
        nextLockAt: '2026-12-20T18:00:00+01:00',
      },
      '/api/predictions/matchday': [
        fixture(1, 'Real Madrid', 'Barcelona'),
        fixture(2, 'Atlético de Madrid', 'Sevilla'),
        fixture(3, 'Valencia', 'Betis'),
        fixture(4, 'Athletic Club', 'Real Sociedad'),
        fixture(5, 'Villarreal', 'Celta'),
      ],
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
  return posts;
}
