import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useKnockoutInsights } from '../../hooks/useKnockoutInsights';
import {
  fetchCustomLockState,
  fetchCustomMatches,
  fetchCustomTeams,
  fetchPredictions,
} from '../../services/api';
import type { PredictionSummary } from '../../types/api';
import { game } from '../fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock(import('../../services/api'), async (original) => ({
  ...(await original()),
  fetchPredictions: vi.fn(),
  fetchCustomLockState: vi.fn(),
  fetchCustomTeams: vi.fn(),
  fetchCustomMatches: vi.fn(),
}));

type LockState = Awaited<ReturnType<typeof fetchCustomLockState>>;

const lockState = (over: Partial<LockState> = {}): LockState => ({
  mode: 'PER_ROUND',
  offsetMinutes: 0,
  lockDate: null,
  lockedGroups: [],
  lockedPicks: [[true, false], [false]],
  anyLocked: true,
  fullyLocked: false,
  nextLockAt: '2026-05-05T19:00:00Z',
  knockoutRounds: [
    {
      round: 'sf',
      drawn: true,
      expectedTies: 2,
      ties: [
        { home: 'Real Madrid', away: 'Arsenal', winner: 'Real Madrid', matchIds: [1, 2] },
        { home: 'Inter', away: 'Barcelona', winner: null, matchIds: [3, 4] },
      ],
    },
    { round: 'final', drawn: false, expectedTies: 1, ties: [] },
  ],
  ...over,
});

const prediction = (key: string, customRounds: (string | null)[][]): PredictionSummary => ({
  key,
  hash: key,
  paid: true,
  participantName: `Jugador ${key}`,
  userId: Number(key),
  predictionName: null,
  groupId: 7,
  data: { customRounds },
});

const openPrediction = vi.fn();
const league = (over: object = {}) =>
  vi.mocked(useAppContext).mockReturnValue({
    leagueKind: 'knockoutDraw',
    activeGroupId: '7',
    activeGroupName: 'Champions de la oficina',
    activeGroupCustomCompetition: false,
    activeCompetitionExternalId: 'uefa.champions',
    allGames: [
      game({ home: 'Real Madrid', away: 'Arsenal', homeLogo: 'rm.png', awayTeamLogo: 'ars.png' }),
    ],
    leaderboardData: [
      { userId: 1, avatarUrl: 'ana.png' },
      { userId: 2, avatarUrl: null },
      { userId: null, avatarUrl: 'invitado.png' },
    ],
    setViewerPredictionId: openPrediction,
    ...over,
  } as unknown as ReturnType<typeof useAppContext>);

const render = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useKnockoutInsights(), { wrapper }).result;
};

const insights = async () => {
  const result = render();
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  vi.clearAllMocks();
  league();
  vi.mocked(fetchCustomLockState).mockResolvedValue(lockState());
  vi.mocked(fetchPredictions).mockResolvedValue([
    prediction('1', [['Real Madrid', 'Barcelona'], ['Real Madrid']]),
    // Su único cruce elegido sigue abierto: está enviada, pero aún no se ve nada de ella.
    prediction('2', [[null, 'Inter'], [null]]),
  ]);
});

describe('useKnockoutInsights', () => {
  it('en unas eliminatorias sorteadas compara las elecciones cerradas con el sorteo real', async () => {
    const data = await insights();

    expect(data.entries).toEqual([
      { id: '1', name: 'Jugador 1', userId: 1, picks: [['Real Madrid', null], [null]] },
    ]);
    expect(data.sentCount).toBe(2);
    expect(data.field.rounds).toHaveLength(2);
    expect([...data.field.rounds[0].winners]).toEqual(['Real Madrid']);
    expect(data.field.rounds[0].decided).toBe(false);
    expect(data.field.rounds[1].final).toBe(true);
    expect(data.field.eliminatedAt.get('Arsenal')).toBe(0);
    expect(data.nextLockAt).toBe('2026-05-05T19:00:00Z');
    expect(data.error).toBe(false);
  });

  it('saca los escudos de los partidos oficiales y no pide equipos de competición propia', async () => {
    const data = await insights();

    expect(data.logos).toEqual({ 'Real Madrid': 'rm.png', Arsenal: 'ars.png' });
    expect(fetchCustomTeams).not.toHaveBeenCalled();
    expect(fetchCustomMatches).not.toHaveBeenCalled();
  });

  it('da la foto de cada usuario con la clasificación de la liga', async () => {
    const data = await insights();

    expect([...data.avatarByUserId]).toEqual([[1, 'ana.png']]);
    expect(data.openPrediction).toBe(openPrediction);
    expect(data).toMatchObject({
      hasLeague: true,
      groupId: '7',
      leagueName: 'Champions de la oficina',
    });
  });

  it('enseña todas las elecciones cuando la competición ya está cerrada entera', async () => {
    vi.mocked(fetchCustomLockState).mockResolvedValue(
      lockState({ fullyLocked: true, lockedPicks: [], nextLockAt: null }),
    );

    const data = await insights();

    expect(data.entries.map((entry) => entry.picks)).toEqual([
      [['Real Madrid', 'Barcelona'], ['Real Madrid']],
      [[null, 'Inter'], [null]],
    ]);
    expect(data.nextLockAt).toBeNull();
  });

  it('en un cuadro propio arma el cuadro real con los partidos y equipos de la liga', async () => {
    league({ leagueKind: 'customBracket', activeGroupCustomCompetition: true, allGames: [] });
    vi.mocked(fetchCustomLockState).mockResolvedValue(lockState({ knockoutRounds: null }));
    vi.mocked(fetchCustomTeams).mockResolvedValue([
      { name: 'Ana', groupName: null, logoUrl: 'ana-escudo.png' },
      { name: 'Luis', groupName: null, logoUrl: null },
    ] as Awaited<ReturnType<typeof fetchCustomTeams>>);
    vi.mocked(fetchCustomMatches).mockResolvedValue([
      game({ id: 1, round: 'bracket-1', home: 'Ana', away: 'Luis', away_team_id: 2 }),
      game({ id: 2, round: 'bracket-1', home: 'Marta', away: 'Pau', away_team_id: 4 }),
    ]);

    const data = await insights();

    expect(fetchCustomTeams).toHaveBeenCalledWith(7);
    expect(fetchCustomMatches).toHaveBeenCalledWith(7);
    expect(data.field.rounds).toHaveLength(2);
    expect([...data.field.rounds[0].teams].sort()).toEqual(['Ana', 'Luis', 'Marta', 'Pau']);
    expect(data.logos).toEqual({ Ana: 'ana-escudo.png', Luis: null });
  });

  it('avisa del error si no llegan los partidos del cuadro propio', async () => {
    league({ leagueKind: 'customBracket', activeGroupCustomCompetition: true, allGames: [] });
    vi.mocked(fetchCustomTeams).mockResolvedValue([]);
    vi.mocked(fetchCustomMatches).mockRejectedValue(new Error('sin red'));

    const result = render();

    await waitFor(() => expect(result.current.error).toBe(true));
  });

  it('sin liga activa no pide nada ni se queda cargando', () => {
    league({ activeGroupId: null, activeGroupName: null });

    const data = render().current;

    expect(data).toMatchObject({ hasLeague: false, loading: false, sentCount: 0, entries: [] });
    expect(fetchPredictions).not.toHaveBeenCalled();
    expect(fetchCustomLockState).not.toHaveBeenCalled();
  });
});
