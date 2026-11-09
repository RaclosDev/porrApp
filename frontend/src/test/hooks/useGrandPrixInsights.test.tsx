import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useGrandPrixInsights } from '../../hooks/useGrandPrixInsights';
import { fetchGrandPrixBoard, fetchGrandPrixSeasonPicks } from '../../services/api';
import type { GrandPrix, GrandPrixBoard, GrandPrixMemberPick, RaceDriver } from '../../types/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock(import('../../services/api'), async (original) => ({
  ...(await original()),
  fetchGrandPrixBoard: vi.fn(),
  fetchGrandPrixSeasonPicks: vi.fn(),
}));

const grandPrix = (id: number, fields: Partial<GrandPrix> = {}): GrandPrix => ({
  id,
  name: `Gran Premio ${id}`,
  circuit: null,
  city: null,
  country: null,
  sprint: false,
  lockAt: null,
  raceAt: null,
  status: 'FINISHED',
  locked: true,
  gridIds: [1, 2],
  result: null,
  pick: null,
  points: null,
  details: null,
  ...fields,
});

const driver = (id: number, name: string): RaceDriver => ({
  id,
  name,
  shortName: null,
  country: null,
  flagUrl: null,
  team: null,
  teamColor: null,
  number: null,
});

const memberPick = (name: string, first: number): GrandPrixMemberPick => ({
  userId: null,
  name,
  avatarUrl: null,
  mine: false,
  pick: { first, second: null, third: null, pole: null, fastestLap: null },
  points: null,
  details: null,
});

const board: GrandPrixBoard = {
  grandsPrix: [
    grandPrix(10),
    grandPrix(11, { status: 'CANCELLED' }),
    grandPrix(12, { status: 'SCHEDULED', locked: false }),
    grandPrix(13),
  ],
  drivers: [driver(1, 'Fernando Alonso'), driver(2, 'Carlos Sainz')],
  rules: { exactPosition: 10, podium: 4, pole: 5, fastestLap: 3 },
};

const league = (over: object = {}) =>
  vi.mocked(useAppContext).mockReturnValue({
    activeGroupId: '7',
    activeGroupName: 'Fórmula 1 de la oficina',
    userId: 3,
    ...over,
  } as unknown as ReturnType<typeof useAppContext>);

const render = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGrandPrixInsights(), { wrapper }).result;
};

beforeEach(() => {
  vi.clearAllMocks();
  league();
  vi.mocked(fetchGrandPrixBoard).mockResolvedValue(board);
  vi.mocked(fetchGrandPrixSeasonPicks).mockResolvedValue([
    { matchId: 10, picks: [memberPick('Ana', 1), memberPick('Luis', 2)] },
    { matchId: 11, picks: [memberPick('Ana', 1)] },
  ]);
});

describe('useGrandPrixInsights', () => {
  it('junta cada Gran Premio cerrado con las predicciones de la liga', async () => {
    const result = render();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Fuera el cancelado, el que sigue abierto y el cerrado del que aún no llegan predicciones.
    expect(result.current.races.map((race) => race.gp.id)).toEqual([10]);
    expect(result.current.races[0].picks.map((pick) => pick.name)).toEqual(['Ana', 'Luis']);
    expect(result.current.drivers.get(2)?.name).toBe('Carlos Sainz');
    expect(result.current).toMatchObject({
      hasLeague: true,
      groupId: '7',
      leagueName: 'Fórmula 1 de la oficina',
      error: false,
    });
    expect(fetchGrandPrixBoard).toHaveBeenCalledWith('7');
    expect(fetchGrandPrixSeasonPicks).toHaveBeenCalledWith('7');
  });

  it('sigue cargando hasta tener el calendario y las predicciones de la temporada', async () => {
    let deliverSeason: (value: never[]) => void = () => {};
    vi.mocked(fetchGrandPrixSeasonPicks).mockReturnValue(
      new Promise((resolve) => {
        deliverSeason = resolve;
      }),
    );

    const result = render();
    await waitFor(() => expect(result.current.drivers.size).toBe(2));

    expect(result.current.loading).toBe(true);
    expect(result.current.races).toEqual([]);

    deliverSeason([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('avisa del error si falla cualquiera de las dos peticiones', async () => {
    vi.mocked(fetchGrandPrixSeasonPicks).mockRejectedValue(new Error('sin red'));

    const result = render();

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.races).toEqual([]);
  });

  it('sin liga activa no pide nada ni se queda cargando', () => {
    league({ activeGroupId: null, activeGroupName: null });

    const data = render().current;

    expect(data).toMatchObject({ hasLeague: false, loading: false, error: false, races: [] });
    expect(data.drivers.size).toBe(0);
    expect(fetchGrandPrixBoard).not.toHaveBeenCalled();
    expect(fetchGrandPrixSeasonPicks).not.toHaveBeenCalled();
  });
});
