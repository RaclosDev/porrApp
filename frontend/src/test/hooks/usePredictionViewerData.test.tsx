import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePredictionViewerData } from '../../hooks/usePredictionViewerData';
import * as api from '../../services/api';
import type {
  GroupOdds,
  GroupStandings,
  Match,
  ParticipantScore,
  PredictionData,
} from '../../types/api';
import { game, standing } from '../fixtures';

vi.mock('../../services/api', () => ({
  fetchPrediction: vi.fn(),
  fetchTournamentOfficialBracket: vi.fn(),
  fetchPredictionScore: vi.fn(),
}));

/** Porra con semifinales y campeón: la final y el tercer puesto se deducen al prepararla. */
const stored: PredictionData = {
  user: 'Ana',
  qf: [
    ['España', 'Portugal'],
    ['Italia', 'Chile'],
    ['Brasil', 'Francia'],
    ['Japón', 'México'],
  ],
  sf: [
    ['España', 'Italia'],
    ['Brasil', 'Japón'],
  ],
  champion: 'España',
};

const score = (fields: Partial<ParticipantScore>): ParticipantScore =>
  ({ id: 5, name: 'Ana', total: 0, finals: 0, ...fields }) as ParticipantScore;

interface Props {
  id: string | number | null;
  standings?: GroupStandings;
  leaderboard?: ParticipantScore[];
  odds?: GroupOdds;
  games?: Match[];
  initial?: PredictionData | null;
  tournamentId?: number | null;
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

// Las listas vacías se comparten: una nueva en cada render relanzaría los cálculos del visor.
const NO_STANDINGS: GroupStandings = {};
const NO_ROWS: ParticipantScore[] = [];
const NO_ODDS: GroupOdds = {};
const NO_GAMES: Match[] = [];

const viewer = (initialProps: Props) =>
  renderHook(
    (props: Props) =>
      usePredictionViewerData(
        props.id,
        props.standings ?? NO_STANDINGS,
        props.leaderboard ?? NO_ROWS,
        props.odds ?? NO_ODDS,
        props.games ?? NO_GAMES,
        props.initial ?? null,
        props.tournamentId ?? null,
      ),
    { wrapper, initialProps },
  );

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.fetchPrediction).mockResolvedValue(stored);
  vi.mocked(api.fetchTournamentOfficialBracket).mockResolvedValue({});
  vi.mocked(api.fetchPredictionScore).mockResolvedValue(score({ log: [] }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePredictionViewerData: cargar la porra', () => {
  it('pide la porra por su id y la entrega ya completada para el visor', async () => {
    const { result } = viewer({ id: 5 });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.fetchPrediction).toHaveBeenCalledWith(5);
    expect(result.current.part?.final).toEqual(['España', 'Brasil']);
    expect(result.current.part?.thirdPlaceMatch).toEqual(['Italia', 'Japón']);
    expect(result.current.leftRounds[3]).toEqual([{ home: 'España', away: 'Italia' }]);
    expect(result.current.rightRounds[3]).toEqual([{ home: 'Brasil', away: 'Japón' }]);
    expect(result.current.error).toBeNull();
  });

  it('pinta al instante la porra que ya trae la lista de participantes, sin pedirla', async () => {
    const { result } = viewer({ id: 5, initial: stored });

    expect(result.current.loading).toBe(false);
    expect(result.current.part?.user).toBe('Ana');
    await waitFor(() => expect(api.fetchPredictionScore).toHaveBeenCalledWith(5));
    expect(api.fetchPrediction).not.toHaveBeenCalled();
  });

  it('sin porra abierta no pide nada', () => {
    const { result } = viewer({ id: null, tournamentId: 2 });

    expect(result.current).toMatchObject({ part: null, loading: false, error: null });
    expect(api.fetchPrediction).not.toHaveBeenCalled();
    expect(api.fetchTournamentOfficialBracket).not.toHaveBeenCalled();
    expect(api.fetchPredictionScore).not.toHaveBeenCalled();
  });

  it('enseña el motivo si la porra no se puede cargar, y uno genérico si no lo hay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.fetchPrediction).mockRejectedValueOnce(new Error('Esta porra es privada'));
    const { result, rerender } = viewer({ id: 5 });
    await waitFor(() => expect(result.current.error).toBe('Esta porra es privada'));
    expect(result.current.loading).toBe(false);
    expect(result.current.part).toBeNull();

    vi.mocked(api.fetchPrediction).mockRejectedValueOnce('fallo');
    rerender({ id: 6 });
    await waitFor(() => expect(result.current.error).toBe('No se pudo cargar la porra'));
  });

  it('al cerrar el visor olvida la porra y el error', async () => {
    const { result, rerender } = viewer({ id: 5 });
    await waitFor(() => expect(result.current.part).not.toBeNull());

    rerender({ id: null });

    expect(result.current).toMatchObject({ part: null, loading: false, error: null });
  });

  it('descarta la respuesta de una porra que ya no es la que se está viendo', async () => {
    let deliverFirst: (data: PredictionData) => void = () => {};
    vi.mocked(api.fetchPrediction).mockImplementation((id) =>
      id === 5
        ? new Promise<PredictionData>((resolve) => {
            deliverFirst = resolve;
          })
        : Promise.resolve({ ...stored, user: 'Luis' }),
    );
    const { result, rerender } = viewer({ id: 5 });

    rerender({ id: 6 });
    await waitFor(() => expect(result.current.part?.user).toBe('Luis'));
    await act(async () => deliverFirst({ ...stored, user: 'Ana' }));

    expect(result.current.part?.user).toBe('Luis');
  });
});

describe('usePredictionViewerData: cuadro oficial y fase', () => {
  it('sin torneo con grupos no pide cuadro oficial y abre en la fase de grupos', async () => {
    const { result } = viewer({ id: 5 });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.fetchTournamentOfficialBracket).not.toHaveBeenCalled();
    expect(result.current.initialSection).toBe('groups');
  });

  it('espera al cuadro oficial del torneo de la liga antes de dar la porra por cargada', async () => {
    let deliverOfficial: (data: PredictionData) => void = () => {};
    vi.mocked(api.fetchTournamentOfficialBracket).mockReturnValue(
      new Promise((resolve) => {
        deliverOfficial = resolve;
      }),
    );
    const { result } = viewer({ id: 5, initial: stored, tournamentId: 2 });
    await waitFor(() => expect(api.fetchTournamentOfficialBracket).toHaveBeenCalledWith(2));
    expect(result.current.loading).toBe(true);

    await act(async () => deliverOfficial({ sf: [['España', 'Italia']] }));

    expect(result.current.loading).toBe(false);
    expect(result.current.initialSection).toBe('knockout');
  });

  it('abre en las eliminatorias cuando ya se juega una, aunque no haya cuadro oficial', async () => {
    const games = [game({ round: 'r16', home: 'España', away: 'Italia', finished: true })];

    const { result } = viewer({ id: 5, initial: stored, games });

    expect(result.current.initialSection).toBe('knockout');
  });

  it('da por perdido un hueco cuando el cuadro oficial ya tiene esa ronda completa', async () => {
    vi.mocked(api.fetchTournamentOfficialBracket).mockResolvedValue({
      sf: [
        ['España', 'Francia'],
        ['Brasil', 'Portugal'],
      ],
    });
    const { result } = viewer({ id: 5, initial: stored, tournamentId: 2 });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getSlotDetails('Italia', 2)).toEqual({ isWinner: true, slotPoints: '0' });
    expect(result.current.getSlotDetails('España', 2)).toEqual({
      isWinner: true,
      slotPoints: null,
    });
  });
});

describe('usePredictionViewerData: puntos', () => {
  const row = score({ id: 5, total: 40, finals: 0 });

  it('enseña los puntos del ranking mientras llega el desglose, y luego el desglose', async () => {
    let deliverScore: (data: ParticipantScore) => void = () => {};
    vi.mocked(api.fetchPredictionScore).mockReturnValue(
      new Promise((resolve) => {
        deliverScore = resolve;
      }),
    );
    const leaderboard = [score({ id: 4, total: 99 }), row];
    const { result } = viewer({ id: 5, initial: stored, leaderboard });
    await waitFor(() => expect(api.fetchPredictionScore).toHaveBeenCalled());
    expect(result.current.points.total).toBe(40);

    await act(async () =>
      deliverScore(
        score({
          id: 5,
          total: 280,
          log: [
            { stage: 'qf', amount: 40, msg: 'España pasa a semifinales' },
            { stage: 'qf', amount: 40, msg: 'Japón pasa a semifinales' },
            { stage: 'finals', amount: 200, msg: 'Campeón: España' },
          ],
        }),
      ),
    );

    await waitFor(() => expect(result.current.points.total).toBe(280));
    expect(result.current.getSlotDetails('España', 2).slotPoints).toBe('+40');
    expect(result.current.getRoundFooterTotal(2, 'left')).toBe(40);
    expect(result.current.getRoundFooterTotal(2, 'right')).toBe(40);
    expect(result.current.getCenterPointsTotal()).toBe(200);
  });

  it('no usa el desglose de otra porra', async () => {
    vi.mocked(api.fetchPredictionScore).mockResolvedValue(score({ id: 8, total: 500, log: [] }));
    const { result } = viewer({ id: 5, initial: stored, leaderboard: [row] });
    await waitFor(() => expect(api.fetchPredictionScore).toHaveBeenCalled());
    await act(async () => {});

    expect(result.current.points.total).toBe(40);
  });

  it('colorea cada equipo de grupo con la clasificación oficial y los aciertos', async () => {
    vi.mocked(api.fetchPredictionScore).mockResolvedValue(
      score({ id: 5, log: [], exactMatches: { A: { 1: true } }, passedTeams: { Italia: true } }),
    );
    const standings: GroupStandings = {
      A: {
        España: standing({ mp: 3, status: 1 }),
        Italia: standing({ mp: 3, status: 2 }),
        Chile: standing({ mp: 3, status: -1 }),
      },
    };
    const odds = { A: [] } as GroupOdds;
    const { result } = viewer({ id: 5, initial: stored, standings, odds });
    await waitFor(() => expect(result.current.points.exactMatches).toEqual({ A: { 1: true } }));

    expect(result.current.getGroupTeamData('A', 'España', 1)).toEqual({
      color: 'var(--hit)',
      mp: 3,
      status: 1,
    });
    expect(result.current.getGroupTeamData('A', 'Italia', 3).color).toBe('var(--pass)');
    expect(result.current.getGroupTeamData('A', 'Chile', 2).color).toBe('var(--miss)');
  });
});
