import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueStandings from '../../pages/LeagueStandings';
import { useAppContext } from '../../context/AppContext';
import {
  fetchCompetitionStandings,
  fetchLeaderboardMatchdays,
  fetchMatchdayFixtures,
  fetchMatchdayStats,
} from '../../services/api';
import { appContext, matchdayFixture } from '../context/fixtures';
import type { FightInfo, MatchStats, MatchdayPoints } from '../../types/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchCompetitionStandings: vi.fn(),
  fetchLeaderboardMatchdays: vi.fn(),
  fetchMatchdayFixtures: vi.fn(),
  fetchMatchdayStats: vi.fn(),
}));

const fight = (overrides: Partial<FightInfo> = {}): FightInfo => ({
  eventId: '1',
  eventName: 'UFC 330',
  segment: 'MAIN',
  order: 1,
  weightClass: 'Lightweight',
  scheduledRounds: 5,
  homeRecord: '27-1-0',
  awayRecord: '12-1-0',
  resultMethod: null,
  resultDetail: null,
  resultRound: null,
  resultClock: null,
  winner: null,
  ...overrides,
});

const matchday = (label: string, current: boolean): MatchdayPoints => ({
  label,
  date: null,
  finished: !current,
  current,
  matchCount: 2,
  pointsByPrediction: {},
});

const stats = (overrides: Partial<MatchStats>): MatchStats => ({
  matchId: 1,
  round: 'UFC 330',
  matchDate: null,
  homeTeam: 'Islam Makhachev',
  awayTeam: 'Arman Tsarukyan',
  homeTeamLogo: null,
  awayTeamLogo: null,
  finished: true,
  live: false,
  homeScore: 1,
  awayScore: 0,
  predictions: 4,
  homeWins: 3,
  draws: 0,
  awayWins: 1,
  topScores: [],
  exactHits: 3,
  signHits: 3,
  methods: [
    { method: 'SUBMISSION', count: 2 },
    { method: 'DECISION', count: 1 },
  ],
  ...overrides,
});

const setup = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LeagueStandings />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeGroupId: '7',
      activeCompetitionId: 9,
      activeCompetitionName: 'UFC',
      activeCompetitionExternalId: 'mma.ufc',
      activeGroupPoolFormat: 'MATCH_DAY',
    }),
  );
  vi.mocked(fetchLeaderboardMatchdays).mockResolvedValue([
    matchday('UFC 329', false),
    matchday('UFC 330', true),
  ]);
  vi.mocked(fetchMatchdayFixtures).mockResolvedValue([
    matchdayFixture({
      matchId: 2,
      homeTeam: 'Joe Pyfer',
      awayTeam: 'Abus Magomedov',
      locked: false,
      fight: fight({ segment: 'PRELIMS', order: 6, scheduledRounds: 3 }),
    }),
    matchdayFixture({
      matchId: 1,
      homeTeam: 'Islam Makhachev',
      awayTeam: 'Arman Tsarukyan',
      finished: true,
      locked: true,
      predSign: '1',
      predMethod: 'SUBMISSION',
      predRound: 3,
      pointsAwarded: 6,
      fight: fight({
        winner: '1',
        resultMethod: 'SUBMISSION',
        resultDetail: 'Submission - Rear Naked Choke',
        resultRound: 3,
        resultClock: '2:10',
      }),
    }),
  ]);
  vi.mocked(fetchMatchdayStats).mockResolvedValue({
    members: 5,
    matches: [stats({ matchId: 1 })],
  });
});

it('en una liga de la UFC enseña la cartelera de la velada actual, no una tabla de equipos', async () => {
  setup();

  const main = await screen.findByRole('article', {
    name: 'Islam Makhachev contra Arman Tsarukyan',
  });
  expect(screen.getByRole('heading', { level: 1, name: 'UFC 330' })).toBeVisible();
  expect(fetchMatchdayFixtures).toHaveBeenCalledWith('7', 'UFC 330');
  expect(fetchCompetitionStandings).not.toHaveBeenCalled();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();

  // Bloques en el orden en que se anuncian.
  const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual(['Cartelera estelar', 'Preliminares']);

  expect(within(main).getByText('Pelea estelar')).toBeVisible();
  expect(within(main).getByText('27-1-0')).toBeVisible();
  expect(within(main).getByText('Récord: 27 victorias, 1 derrota y 0 empates')).toBeInTheDocument();
  expect(within(main).getByText('Sumisión (mataleón)')).toBeVisible();
  expect(within(main).getByText('Asalto 3')).toBeVisible();
  expect(within(main).getByText('2:10')).toBeVisible();
  expect(within(main).getByTitle('Victoria')).toHaveTextContent('W');
  expect(within(main).getByTitle('Derrota')).toHaveTextContent('L');
  // Reparto de la liga, método favorito y aciertos.
  expect(within(main).getByText('75 %')).toBeVisible();
  expect(within(main).getByText('25 %')).toBeVisible();
  expect(within(main).getByText(/Método favorito/)).toHaveTextContent('Sumisión (67 %)');
  expect(within(main).getByText(/Acertaron el ganador/)).toHaveTextContent('3 de 4');
  expect(within(main).getByText(/Tu predicción/)).toHaveTextContent(
    'Tu predicción: Islam Makhachev · Sumisión · asalto 3+6 puntos',
  );

  // Una pelea abierta no enseña lo que ha elegido la liga y lleva a hacer la predicción.
  const open = screen.getByRole('article', { name: 'Joe Pyfer contra Abus Magomedov' });
  expect(within(open).getByText(/se verá cuando se cierre la predicción/)).toBeVisible();
  expect(within(open).getByRole('link', { name: 'Hacerla →' })).toHaveAttribute(
    'href',
    '/jornadas',
  );

  // Balance de la velada.
  expect(screen.getByText('Tus aciertos').nextSibling).toHaveTextContent('1 de 1');
  expect(screen.getByText('Tus puntos').nextSibling).toHaveTextContent('6');
});

it('permite pasar a otra velada', async () => {
  setup();
  await screen.findByRole('article', { name: 'Joe Pyfer contra Abus Magomedov' });

  fireEvent.click(screen.getByRole('button', { name: 'Velada anterior' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'UFC 329' })).toBeVisible();
  expect(fetchMatchdayFixtures).toHaveBeenLastCalledWith('7', 'UFC 329');
  expect(screen.getByRole('button', { name: 'Velada anterior' })).toBeDisabled();
});

it('sin peleas explica que la cartelera llegará con la próxima velada', async () => {
  vi.mocked(fetchMatchdayFixtures).mockResolvedValue([]);
  setup();

  expect(await screen.findByText('Esta liga aún no tiene peleas.')).toBeVisible();
});
