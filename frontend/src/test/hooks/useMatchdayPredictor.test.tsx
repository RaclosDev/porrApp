import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { useAppContext } from '../../context/AppContext';
import { useMatchdayPredictor } from '../../hooks/useMatchdayPredictor';
import * as api from '../../services/api';
import type {
  FightInfo,
  MatchdayFixture,
  MatchdayPoints,
  MatchdaySubmissionResult,
  SurvivorStatus,
} from '../../types/api';
import { withFightPick } from '../../utils/matchday';

const navigate = vi.fn();

vi.mock('../../services/api', () => ({
  fetchMatchdayFixtures: vi.fn(),
  fetchSurvivorStatus: vi.fn(),
  submitMatchdayPredictions: vi.fn(),
  fetchLeaderboardMatchdays: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock(import('react-router-dom'), async (original) => ({
  ...(await original()),
  useNavigate: () => navigate,
}));

const DRAFT_KEY = 'draft_matchday_u7_g10';

const fixture = (matchId: number, fields: Partial<MatchdayFixture> = {}) =>
  ({
    matchId,
    homeTeam: `Local ${matchId}`,
    awayTeam: `Visitante ${matchId}`,
    homeTeamId: matchId * 10,
    awayTeamId: matchId * 10 + 1,
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: '2026-11-14T20:00:00Z',
    round: 'Jornada 13',
    groupName: null,
    finished: false,
    status: 'SCHEDULED',
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
    ...fields,
  }) as MatchdayFixture;

const matchday = (label: string, fields: Partial<MatchdayPoints> = {}): MatchdayPoints => ({
  label,
  date: null,
  finished: false,
  current: false,
  matchCount: 2,
  pointsByPrediction: {},
  ...fields,
});

const saved: MatchdaySubmissionResult = { success: true, saved: 1, message: 'ok' };
const signItem = (matchId: number, sign: string) => ({
  matchId,
  homeScore: null,
  awayScore: null,
  sign,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let context: Record<string, unknown>;

const predictor = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return renderHook(
    () => useMatchdayPredictor(context as unknown as ReturnType<typeof useAppContext>),
    { wrapper },
  );
};

/** Pantalla de jornada con sus partidos ya cargados. */
const loaded = async () => {
  const hook = predictor();
  await waitFor(() => expect(hook.result.current.roundFixtures.length).toBeGreaterThan(0));
  return hook;
};

const submissions = () => vi.mocked(api.submitMatchdayPredictions).mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  context = {
    activeGroupId: '10',
    activeGroupIsLocked: false,
    activeGroupPoolFormat: 'MATCHDAY',
    leagueKind: 'matchday',
    userId: '7',
    userName: 'Ana',
    isAuthenticated: true,
  };
  vi.mocked(api.fetchLeaderboardMatchdays).mockResolvedValue([
    matchday('Jornada 12', { finished: true }),
    matchday('Jornada 13', { current: true }),
    matchday('Jornada 14'),
  ]);
  vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([fixture(1), fixture(2)]);
  vi.mocked(api.submitMatchdayPredictions).mockResolvedValue(saved);
});

describe('useMatchdayPredictor: jornadas y partidos', () => {
  it('abre la jornada actual de la liga y pide solo sus partidos', async () => {
    const { result } = await loaded();

    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', 'Jornada 13');
    expect(result.current).toMatchObject({
      isMatchDay: true,
      activeRound: 'Jornada 13',
      selectedRound: 'Jornada 13',
      availableRounds: ['Jornada 12', 'Jornada 13', 'Jornada 14'],
      roundIndex: 1,
      isError: false,
    });
    expect(result.current.counts).toEqual({
      predicted: 0,
      pending: 2,
      finished: 0,
      upcoming: 2,
      total: 2,
    });
  });

  it('al cambiar de jornada pide los partidos de la nueva', async () => {
    const { result } = await loaded();

    act(() => result.current.setSelectedRound('Jornada 12'));

    await waitFor(() => expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', 'Jornada 12'));
    expect(result.current.roundIndex).toBe(0);
  });

  it('si falla el resumen de jornadas pide la temporada y saca las jornadas de los partidos', async () => {
    vi.mocked(api.fetchLeaderboardMatchdays).mockRejectedValue(new Error('caído'));
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { round: 'Jornada 1', finished: true }),
      fixture(2, { round: 'Jornada 2' }),
      fixture(3, { round: 'Jornada 2' }),
    ]);

    const { result } = await loaded();

    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', '');
    expect(result.current.availableRounds).toEqual(['Jornada 1', 'Jornada 2']);
    await waitFor(() => expect(result.current.activeRound).toBe('Jornada 2'));
    expect(result.current.roundFixtures.map((f) => f.matchId)).toEqual([2, 3]);
    expect(result.current.fixtures).toHaveLength(3);
  });

  it('una jornada ya jugada se abre en los finalizados, salvo que se pida «Por jugar» a mano', async () => {
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { finished: true, locked: true }),
      fixture(2, { finished: true, locked: true }),
    ]);
    const { result } = await loaded();

    expect(result.current.statusFilter).toBe('FINISHED');
    expect(result.current.displayedFixtures).toHaveLength(2);

    act(() => result.current.setStatusFilter('UPCOMING'));

    expect(result.current.statusFilter).toBe('UPCOMING');
    expect(result.current.displayedFixtures).toEqual([]);
  });

  it('«Pendientes» lista solo los partidos abiertos sin predicción', async () => {
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { predSign: '1' }),
      fixture(2),
      fixture(3, { locked: true }),
    ]);
    const { result } = await loaded();

    act(() => result.current.setStatusFilter('PENDING'));

    expect(result.current.displayedFixtures.map((f) => f.matchId)).toEqual([2]);
    expect(result.current.counts).toMatchObject({ predicted: 1, pending: 1, total: 3 });
  });

  it('sin liga elegida manda a Mis ligas y no pide nada', () => {
    context.activeGroupId = '';

    predictor();

    expect(navigate).toHaveBeenCalledWith('/mis-ligas');
    expect(api.fetchLeaderboardMatchdays).not.toHaveBeenCalled();
    expect(api.fetchMatchdayFixtures).not.toHaveBeenCalled();
  });

  it('no pide jornadas en una liga que no es de partidos', () => {
    context.leagueKind = 'groupStage';

    const { result } = predictor();

    expect(result.current.isMatchDay).toBe(false);
    expect(api.fetchLeaderboardMatchdays).not.toHaveBeenCalled();
  });
});

describe('useMatchdayPredictor: guardado automático', () => {
  it('elegir un signo lo guarda al momento y vacía el borrador', async () => {
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, 'X'));

    expect(result.current.predictionFor(1).sign).toBe('X');
    expect(result.current.saveStatus).toBe('saving');
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(submissions()).toEqual([['10', [signItem(1, 'X')]]]);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(result.current.counts).toMatchObject({ predicted: 1, pending: 1 });
  });

  it('sin sesión no guarda ni cambia nada: pide iniciar sesión', async () => {
    context.isAuthenticated = false;
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, '1'));
    act(() => result.current.handleTennisPick(1, { homeScore: '2', awayScore: '0', sign: '1' }));
    act(() => result.current.handleFightPick(1, withFightPick('1', 'KO_TKO', '2')));
    act(() => result.current.handleSurvivorPick(1, '1'));

    expect(vi.mocked(toast.error).mock.calls.map(([message]) => message)).toEqual([
      'Inicia sesión para guardar tus predicciones.',
      'Inicia sesión para guardar tus predicciones.',
      'Inicia sesión para guardar tus predicciones.',
      'Inicia sesión para guardar tu elección.',
    ]);
    expect(result.current.predictionFor(1).sign).toBe('');
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('con la liga cerrada no envía nada al servidor', async () => {
    context.activeGroupIsLocked = true;
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, '1'));
    await act(async () => {});

    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.counts.pending).toBe(0);
  });

  it('si el guardado falla enseña el motivo, conserva el borrador y deja reintentar', async () => {
    vi.mocked(api.submitMatchdayPredictions).mockRejectedValueOnce(
      new Error('El partido ya ha empezado'),
    );
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, '2'));
    await waitFor(() => expect(result.current.saveStatus).toBe('error'));
    expect(result.current.saveErrorMsg).toBe('El partido ya ha empezado');
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')).toEqual({
      1: { homeScore: '', awayScore: '', sign: '2' },
    });

    act(() => result.current.retrySave());

    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(result.current.saveErrorMsg).toBe('');
    expect(submissions()[1]).toEqual(['10', [signItem(1, '2')]]);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('lo elegido mientras se guarda sale en un segundo envío, sin repetir lo ya guardado', async () => {
    const first = deferred<MatchdaySubmissionResult>();
    vi.mocked(api.submitMatchdayPredictions).mockReturnValueOnce(first.promise);
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, '1'));
    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalledTimes(1));
    act(() => result.current.handleQuickSign(2, 'X'));
    expect(api.submitMatchdayPredictions).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(saved));

    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalledTimes(2));
    expect(submissions()[0][1]).toEqual([signItem(1, '1')]);
    expect(submissions()[1][1]).toEqual([signItem(2, 'X')]);
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it('un partido cambiado otra vez mientras se guardaba conserva el cambio nuevo', async () => {
    const first = deferred<MatchdaySubmissionResult>();
    vi.mocked(api.submitMatchdayPredictions).mockReturnValueOnce(first.promise);
    const { result } = await loaded();

    act(() => result.current.handleQuickSign(1, '1'));
    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalledTimes(1));
    act(() => result.current.handleQuickSign(1, '2'));
    await act(async () => first.resolve(saved));

    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalledTimes(2));
    expect(submissions()[1][1]).toEqual([signItem(1, '2')]);
    expect(result.current.predictionFor(1).sign).toBe('2');
  });

  it('un marcador a medias no se envía hasta completarlo', async () => {
    const { result } = await loaded();

    act(() => result.current.handleTennisPick(1, { homeScore: '2', awayScore: '', sign: '' }));
    await act(async () => {});
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();

    act(() => result.current.handleTennisPick(1, { homeScore: '2', awayScore: '1', sign: '1' }));

    await waitFor(() =>
      expect(submissions()).toEqual([
        ['10', [{ matchId: 1, homeScore: 2, awayScore: 1, sign: '1' }]],
      ]),
    );
  });

  it('una pelea se envía con su método y su asalto', async () => {
    context.leagueKind = 'fightCard';
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { fight: { eventId: 'ufc-1', order: 1, segment: 'MAIN' } as FightInfo }),
    ]);
    const { result } = await loaded();

    act(() => result.current.handleFightPick(1, withFightPick('2', 'SUBMISSION', '3')));

    await waitFor(() =>
      expect(submissions()).toEqual([
        ['10', [{ ...signItem(1, '2'), method: 'SUBMISSION', round: 3 }]],
      ]),
    );
  });
});

describe('useMatchdayPredictor: borrador local', () => {
  it('lo que quedó sin guardar manda sobre el servidor y se envía al cargar los partidos', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ 1: { homeScore: '', awayScore: '', sign: '2' } }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { predSign: '1' }),
      fixture(2, { predSign: 'X' }),
    ]);

    const { result } = await loaded();

    await waitFor(() => expect(submissions()).toEqual([['10', [signItem(1, '2')]]]));
    expect(result.current.predictionFor(1).sign).toBe('2');
    expect(result.current.predictionFor(2).sign).toBe('X');
  });

  it('en un partido ya cerrado se enseña lo del servidor y su borrador se descarta', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ 1: { homeScore: '', awayScore: '', sign: '2' } }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { predSign: '1', locked: true }),
      fixture(2),
    ]);

    const { result } = await loaded();

    await waitFor(() => expect(result.current.predictionFor(1).sign).toBe('1'));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
  });

  it('un borrador corrupto no impide ver los partidos', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(DRAFT_KEY, '{{{');
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([fixture(1, { predSign: 'X' })]);

    const { result } = await loaded();

    await waitFor(() => expect(result.current.predictionFor(1).sign).toBe('X'));
    expect(warned).toHaveBeenCalled();
    warned.mockRestore();
  });

  it('no enseña el borrador de otro usuario del mismo dispositivo', async () => {
    localStorage.setItem(
      'draft_matchday_u8_g10',
      JSON.stringify({ 1: { homeScore: '', awayScore: '', sign: '2' } }),
    );

    const { result } = await loaded();
    await act(async () => {});

    expect(result.current.predictionFor(1).sign).toBe('');
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
  });
});

describe('useMatchdayPredictor: liga superviviente', () => {
  const status: SurvivorStatus = {
    eliminated: false,
    survived: 1,
    eliminatedRound: null,
    missed: false,
    picks: [
      {
        matchId: 90,
        round: 'Jornada 12',
        teamId: 55,
        teamName: 'Betis',
        teamLogo: null,
        result: 'WON',
      },
      {
        matchId: 1,
        round: 'Jornada 13',
        teamId: 10,
        teamName: 'Local 1',
        teamLogo: null,
        result: 'PENDING',
      },
    ],
  };

  beforeEach(() => {
    context.activeGroupPoolFormat = 'SURVIVOR';
    vi.mocked(api.fetchSurvivorStatus).mockResolvedValue(status);
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(1, { predSign: '1' }),
      fixture(2),
      fixture(3, { predSign: '2', locked: true }),
    ]);
  });

  it('marca como gastados los equipos de otras jornadas, no el de la actual', async () => {
    const { result } = await loaded();

    await waitFor(() => expect(result.current.survivor).toEqual(status));
    expect([...result.current.usedTeams]).toEqual([[55, 'Jornada 12']]);
    expect(result.current.isSurvivor).toBe(true);
  });

  it('con un equipo ya elegido la jornada no tiene nada pendiente', async () => {
    const { result } = await loaded();

    await waitFor(() => expect(result.current.counts.predicted).toBe(2));
    expect(result.current.counts.pending).toBe(0);
    act(() => result.current.setStatusFilter('PENDING'));
    expect(result.current.displayedFixtures).toEqual([]);
  });

  it('elegir otro equipo quita la elección abierta de la jornada y guarda solo la nueva', async () => {
    const { result } = await loaded();
    await waitFor(() => expect(result.current.predictionFor(1).sign).toBe('1'));

    act(() => result.current.handleSurvivorPick(2, '2'));

    expect(result.current.predictionFor(1).sign).toBe('');
    expect(result.current.predictionFor(2).sign).toBe('2');
    // La de un partido ya cerrado no se toca.
    expect(result.current.predictionFor(3).sign).toBe('2');
    await waitFor(() => expect(submissions()).toEqual([['10', [signItem(2, '2')]]]));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it('no pide la situación de superviviente en una liga normal o sin sesión', async () => {
    context.isAuthenticated = false;
    await loaded();
    expect(api.fetchSurvivorStatus).not.toHaveBeenCalled();
  });
});
