import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useGroupStageInsights } from '../../hooks/useGroupStageInsights';
import { fetchPredictions, fetchWorldCupOfficialBracket } from '../../services/api';
import type { PredictionData, PredictionSummary } from '../../types/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock(import('../../context/leagueData'), async (original) => ({
  ...(await original()),
  useWorldCupData: () => ({ groupStandings: {} }) as never,
}));
vi.mock(import('../../services/api'), async (original) => ({
  ...(await original()),
  fetchPredictions: vi.fn(),
  fetchWorldCupOfficialBracket: vi.fn(),
}));

const bracket: PredictionData = {
  groups: { A: ['España', 'Italia', 'Chile'] },
  thirds: [],
  r16: [['España', 'Italia']],
  qf: [['España', 'Italia']],
  sf: [['España', 'Italia']],
  final: ['España', 'Italia'],
  champion: 'España',
};
const prediction = (key: string, data: PredictionData | null): PredictionSummary => ({
  key,
  hash: key,
  paid: true,
  participantName: `Jugador ${key}`,
  userId: Number(key),
  predictionName: null,
  groupId: 7,
  data,
});

const league = (over: object = {}) =>
  vi.mocked(useAppContext).mockReturnValue({
    activeGroupId: '7',
    activeGroupName: 'Mundial de la oficina',
    activeGroupPoolFormat: 'FULL_BRACKET',
    activeGroupPichichi: true,
    activeGroupLockDate: '2026-06-11T18:00:00Z',
    leaderboardData: [
      { userId: 1, avatarUrl: 'ana.png' },
      { userId: 2, avatarUrl: null },
    ],
    setViewerPredictionId: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useAppContext>);

const insights = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useGroupStageInsights(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  vi.clearAllMocks();
  league();
  vi.mocked(fetchWorldCupOfficialBracket).mockResolvedValue({
    final: ['España', 'Italia'],
    champion: 'España',
  });
});

describe('useGroupStageInsights', () => {
  it('lee las predicciones de la liga como un cuadro con la fase de grupos de primera ronda', async () => {
    vi.mocked(fetchPredictions).mockResolvedValue([
      prediction('1', bracket),
      prediction('2', bracket),
    ]);
    const result = await insights();

    expect(result.entries.map((entry) => entry.id)).toEqual(['1', '2']);
    expect(result.field.rounds.map((round) => round.title)).toEqual([
      'Grupos',
      'Dieciseisavos',
      'Octavos',
      'Cuartos',
      'Semifinales',
      'Final',
    ]);
    expect(result.tournament.finished).toBe(true);
    expect(result).toMatchObject({
      sentCount: 2,
      nextLockAt: null,
      hasLeague: true,
      groupId: '7',
      knockoutsOnly: false,
      pichichi: true,
    });
    expect(result.avatarByUserId).toEqual(new Map([[1, 'ana.png']]));
  });

  it('antes del cierre no cuenta nada: de los demás no se ve la predicción', async () => {
    vi.mocked(fetchPredictions).mockResolvedValue([
      prediction('1', bracket),
      prediction('2', null),
    ]);
    const result = await insights();

    expect(result.entries).toEqual([]);
    expect(result.sentCount).toBe(2);
    expect(result.nextLockAt).toBe('2026-06-11T18:00:00Z');
  });

  it('en una liga de solo eliminatorias el cuadro empieza en dieciseisavos', async () => {
    league({ activeGroupPoolFormat: 'KNOCKOUTS_ONLY' });
    vi.mocked(fetchPredictions).mockResolvedValue([prediction('1', bracket)]);
    const result = await insights();

    expect(result.knockoutsOnly).toBe(true);
    expect(result.field.rounds).toHaveLength(5);
    expect(result.entries[0].picks).toHaveLength(5);
  });

  it('sin liga no carga nada', () => {
    league({ activeGroupId: null });
    const client = new QueryClient();
    const { result } = renderHook(() => useGroupStageInsights(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.hasLeague).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
