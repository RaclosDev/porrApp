import { appContext, group, matchdayFixture, type AppContextValue } from '../context/fixtures';
import type { MatchdaySubmissionResult } from '../../types/api';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchdayPredictor from '../../pages/MatchdayPredictor';
import { hasLiveMatch } from '../../utils/matchday';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchMatchdayFixtures: vi.fn(),
  fetchLeaderboardMatchdays: vi.fn(),
  submitMatchdayPredictions: vi.fn(),
}));
vi.mock('../../components/Flag', () => ({ default: () => null }));
vi.mock('../../components/MatchFriendsPredictionsModal', () => ({ default: () => null }));

const fixture = (matchId: number, round: string, homeTeam: string) =>
  matchdayFixture({
    matchId,
    round,
    homeTeam,
    awayTeam: `Visitante ${matchId}`,
    matchDate: '2099-01-01T20:00:00',
    locked: false,
    finished: false,
    predHomeScore: null,
    predAwayScore: null,
    predSign: null,
  });

const signA = (sign: string) => `Pronosticar ${sign} en Equipo A - Visitante 101`;
const signB = (sign: string) => `Pronosticar ${sign} en Equipo B - Visitante 201`;

describe('matchday editing and navigation', () => {
  let context: AppContextValue;
  let client: QueryClient;
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatchdayPredictor />
      </MemoryRouter>
    </QueryClientProvider>
  );
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    context = appContext({
      activeGroupId: '10',
      activeGroupName: 'Liga A',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeCompetitionFormatType: 'LEAGUE',
      isAuthenticated: true,
      userId: '7',
    });
    vi.mocked(useAppContext).mockImplementation(() => context);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    vi.mocked(api.fetchMatchdayFixtures).mockImplementation((id) =>
      Promise.resolve(
        id === '10'
          ? [fixture(101, 'Jornada 10', 'Equipo A')]
          : [fixture(201, 'Jornada 2', 'Equipo B')],
      ),
    );
    vi.mocked(api.submitMatchdayPredictions).mockResolvedValue({
      success: true,
      saved: 1,
      message: 'Guardado',
    });
    // Sin resumen de jornadas se pide la temporada entera y las jornadas salen de los partidos.
    vi.mocked(api.fetchLeaderboardMatchdays).mockResolvedValue([]);
  });

  it('resets the selected round and preserves an immediate draft when switching leagues', async () => {
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: signA('1') }));
    context = { ...context, activeGroupId: '20', activeGroupName: 'Liga B' };
    view.rerender(tree());
    expect(await screen.findByRole('button', { name: signB('1') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('button', { name: signA('1') })).not.toBeInTheDocument();
    expect(localStorage.getItem('draft_matchday_u7_g20')).toBeNull();
    context = { ...context, activeGroupId: '10' };
    view.rerender(tree());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: signA('1') })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('only offers 1X2 picks, without score inputs', async () => {
    render(tree());
    expect(
      await screen.findByRole('group', { name: 'Pronóstico de Equipo A - Visitante 101' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('keeps unsaved edits across a live refresh and only submits edited matches', async () => {
    render(tree());
    fireEvent.click(await screen.findByRole('button', { name: signA('2') }));
    act(() =>
      client.setQueryData(
        ['matchdayFixtures', '10', '7', ''],
        [
          { ...fixture(101, 'Jornada 10', 'Equipo A'), displayClock: '0' },
          {
            ...fixture(102, 'Jornada 10', 'Otro'),
            predHomeScore: 0,
            predAwayScore: 0,
            predSign: 'X',
          },
        ],
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: signA('2') })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.submitMatchdayPredictions).toHaveBeenCalledWith('10', [
        { matchId: 101, homeScore: null, awayScore: null, sign: '2' },
      ]),
    );
  });

  it('includes the final and provides calendar dates when the provider has no round', async () => {
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      fixture(101, 'final', 'Finalista'),
      fixture(102, 'group', 'Sin ronda'),
    ]);
    render(tree());
    const roundSelect = await screen.findByLabelText('Seleccionar jornada');
    expect(await screen.findByRole('option', { name: 'final' })).toBeInTheDocument();
    fireEvent.change(roundSelect, { target: { value: 'Fecha 2099-01-01' } });
    expect(screen.getByText('Sin ronda')).toBeInTheDocument();
    expect(screen.queryByText('Finalista')).not.toBeInTheDocument();
  });

  it('does not clear another league draft when a save finishes after switching', async () => {
    let finishSave!: (result: MatchdaySubmissionResult) => void;
    vi.mocked(api.submitMatchdayPredictions).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: signA('1') }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalled());
    context = { ...context, activeGroupId: '20' };
    view.rerender(tree());
    fireEvent.click(await screen.findByRole('button', { name: signB('X') }));
    await act(async () => finishSave({ success: true, saved: 1, message: 'Guardado A' }));
    expect(screen.getByRole('button', { name: signB('X') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(JSON.parse(localStorage.getItem('draft_matchday_u7_g20') ?? '{}')['201'].sign).toBe('X');
    expect(screen.queryByText('Guardado A')).not.toBeInTheDocument();
  });

  it('hides the save confirmation after 4 s and clears the timer on unmount', async () => {
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: signA('1') }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('Guardado')).toBeInTheDocument();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      act(() => vi.advanceTimersByTime(4000));
      expect(screen.queryByText('Guardado')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: signA('2') }));
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('Guardado')).toBeInTheDocument();
      clearSpy.mockClear();
      view.unmount();
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('only polls fixtures while a match is in play', () => {
    const now = Date.parse('2030-05-01T20:30:00Z');
    const base = fixture(1, 'Jornada 1', 'A');
    expect(hasLiveMatch([{ ...base, matchDate: '2030-05-02T20:00:00Z' }], now)).toBe(false);
    expect(hasLiveMatch([{ ...base, matchDate: '2030-05-01T20:00:00Z' }], now)).toBe(true);
    expect(
      hasLiveMatch([{ ...base, matchDate: '2030-05-01T20:00:00Z', finished: true }], now),
    ).toBe(false);
    expect(hasLiveMatch(undefined, now)).toBe(false);
  });

  it('lists every round in one selector and navigates with previous/next controls', async () => {
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      { ...fixture(1, 'Jornada 1', 'Equipo 1'), finished: true },
      { ...fixture(2, 'Jornada 2', 'Equipo 2'), finished: true },
      { ...fixture(3, 'Jornada 3', 'Equipo 3'), finished: true },
      { ...fixture(4, 'Jornada 4', 'Equipo 4'), finished: false },
      { ...fixture(5, 'Jornada 5', 'Equipo 5'), finished: false },
      { ...fixture(6, 'Jornada 6', 'Equipo 6'), finished: false },
    ]);
    render(tree());

    // "Todas las Jornadas" button must not exist
    expect(screen.queryByRole('button', { name: 'Todas las Jornadas' })).not.toBeInTheDocument();

    const roundSelect = await screen.findByLabelText('Seleccionar jornada');
    // The current round (first with pending matches) is selected by default
    expect(roundSelect).toHaveValue('Jornada 4');
    expect(Array.from(roundSelect.querySelectorAll('option')).map((o) => o.value)).toEqual([
      'Jornada 1',
      'Jornada 2',
      'Jornada 3',
      'Jornada 4',
      'Jornada 5',
      'Jornada 6',
    ]);
    expect(screen.queryByLabelText('Jornadas anteriores')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jornada siguiente' }));
    expect(roundSelect).toHaveValue('Jornada 5');

    fireEvent.change(roundSelect, { target: { value: 'Jornada 1' } });
    expect(roundSelect).toHaveValue('Jornada 1');
    expect(screen.getByRole('button', { name: 'Jornada anterior' })).toBeDisabled();

    // Counter scopes to the selected round (J1 has 1 match, 0 predicted -> 0/1, not 0/6)
    expect(screen.getByText('0/1 pronosticados')).toBeInTheDocument();
    // A fully played round shows its finished matches instead of an empty "Todos" tab
    expect(screen.getByRole('tab', { name: /Finalizados/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Equipo 1')).toBeInTheDocument();
  });

  it('hides finished matches from "Todos" and lists unpredicted ones in "Pendientes"', async () => {
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      { ...fixture(1, 'Jornada 1', 'Jugado'), finished: true, locked: true },
      { ...fixture(2, 'Jornada 1', 'Pronosticado'), predSign: '1' },
      fixture(3, 'Jornada 1', 'Sin pronóstico'),
    ]);
    render(tree());
    expect(await screen.findByRole('tab', { name: 'Todos 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText('Jugado')).not.toBeInTheDocument();
    expect(screen.getByText('Pronosticado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Pendientes 1' }));
    expect(screen.getByText('Sin pronóstico')).toBeInTheDocument();
    expect(screen.queryByText('Pronosticado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Finalizados 1' }));
    expect(screen.getByText('Jugado')).toBeInTheDocument();
  });
});

describe('opening a league from a reminder link', () => {
  it('waits for the leagues to load and switches instead of leaving through the active league', () => {
    const champions = group({ id: 20, name: 'Champions', poolFormat: 'MATCH_DAY' });
    // Como el store real, cambiar de liga la activa al momento.
    const changeGroup = vi.fn(() => {
      current = { ...current, activeGroupId: '20', activeGroupPoolFormat: 'MATCH_DAY' };
    });
    // Liga activa sin jornadas (p. ej. un cuadro de LoL) y las ligas del usuario aún cargando.
    let current: AppContextValue = appContext({
      activeGroupId: '5',
      activeGroupPoolFormat: 'FULL_BRACKET',
      isAuthenticated: true,
      userId: '7',
      userGroups: [],
      userGroupsLoaded: false,
      changeGroup,
    });
    vi.mocked(useAppContext).mockImplementation(() => current);
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([]);
    vi.mocked(api.fetchLeaderboardMatchdays).mockResolvedValue([]);
    const client = new QueryClient();
    const tree = () => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/jornadas?group=20']}>
          <Routes>
            <Route path="/jornadas" element={<MatchdayPredictor />} />
            <Route path="/" element={<p>Inicio</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const view = render(tree());
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(changeGroup).not.toHaveBeenCalled();

    current = { ...current, userGroups: [champions], userGroupsLoaded: true };
    view.rerender(tree());
    expect(changeGroup).toHaveBeenCalledWith(20);
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Jornadas|Champions/ })).toBeInTheDocument();
  });
});

describe('opening a league without matchdays from a notification link', () => {
  it('switches to it and lands on its home', () => {
    const bracket = group({ id: 30, name: 'Cuadro', poolFormat: 'FULL_BRACKET' });
    let current: AppContextValue = appContext({
      activeGroupId: '5',
      activeGroupPoolFormat: 'MATCH_DAY',
      isAuthenticated: true,
      userId: '7',
      userGroups: [bracket],
      userGroupsLoaded: true,
    });
    const changeGroup = vi.fn(() => {
      current = { ...current, activeGroupId: '30', activeGroupPoolFormat: 'FULL_BRACKET' };
    });
    current = { ...current, changeGroup };
    vi.mocked(useAppContext).mockImplementation(() => current);
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([]);
    vi.mocked(api.fetchLeaderboardMatchdays).mockResolvedValue([]);
    const client = new QueryClient();
    const tree = () => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/jornadas?group=30']}>
          <Routes>
            <Route path="/jornadas" element={<MatchdayPredictor />} />
            <Route path="/" element={<p>Inicio</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const view = render(tree());
    expect(changeGroup).toHaveBeenCalledWith(30);
    view.rerender(tree());
    expect(screen.getByText('Inicio')).toBeInTheDocument();
  });
});

describe('matchday screen with the league round summary', () => {
  let client: QueryClient;
  const matchday = (label: string, current = false) => ({
    label,
    date: null,
    finished: !current,
    current,
    matchCount: 1,
    pointsByPrediction: {},
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatchdayPredictor />
      </MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAppContext).mockImplementation(() =>
      appContext({
        activeGroupId: '10',
        activeGroupName: 'Liga A',
        activeGroupPoolFormat: 'MATCH_DAY',
        activeCompetitionFormatType: 'LEAGUE',
        isAuthenticated: true,
        userId: '7',
      }),
    );
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    vi.mocked(api.fetchLeaderboardMatchdays).mockResolvedValue([
      matchday('Jornada 1'),
      matchday('Jornada 2', true),
      matchday('Jornada 3'),
    ]);
    vi.mocked(api.fetchMatchdayFixtures).mockImplementation((_groupId, round = '') =>
      Promise.resolve([fixture(Number(round.slice(-1)), round, `Local ${round}`)]),
    );
  });

  it('only requests the selected round and lists the rounds from the summary', async () => {
    render(tree());
    const roundSelect = await screen.findByLabelText('Seleccionar jornada');
    expect(roundSelect).toHaveValue('Jornada 2');
    expect(Array.from(roundSelect.querySelectorAll('option')).map((o) => o.value)).toEqual([
      'Jornada 1',
      'Jornada 2',
      'Jornada 3',
    ]);
    expect(await screen.findByText('Local Jornada 2')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledTimes(1);
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', 'Jornada 2');

    fireEvent.click(screen.getByRole('button', { name: 'Jornada siguiente' }));
    expect(await screen.findByText('Local Jornada 3')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenLastCalledWith('10', 'Jornada 3');
    expect(api.fetchMatchdayFixtures).not.toHaveBeenCalledWith('10', '');
  });

  it('falls back to the whole season when the summary cannot be loaded', async () => {
    vi.mocked(api.fetchLeaderboardMatchdays).mockRejectedValue(new Error('caído'));
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([fixture(1, 'Jornada 1', 'Equipo 1')]);
    render(tree());
    expect(await screen.findByText('Equipo 1')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', '');
  });

  it('keeps the draft of another round while browsing rounds', async () => {
    render(tree());
    const pickJ2 = 'Pronosticar X en Local Jornada 2 - Visitante 2';
    fireEvent.click(await screen.findByRole('button', { name: pickJ2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Jornada siguiente' }));
    await screen.findByText('Local Jornada 3');
    expect(JSON.parse(localStorage.getItem('draft_matchday_u7_g10') ?? '{}')['2'].sign).toBe('X');

    fireEvent.click(screen.getByRole('button', { name: 'Jornada anterior' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: pickJ2 })).toHaveAttribute('aria-pressed', 'true'),
    );
  });
});
