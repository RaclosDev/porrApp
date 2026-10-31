import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

const fixture = (matchId, round, homeTeam) => ({
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

describe('matchday editing and navigation', () => {
  let context;
  let client;
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
    context = {
      activeGroupId: '10',
      activeGroupName: 'Liga A',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeCompetitionFormatType: 'LEAGUE',
      isAuthenticated: true,
      userId: '7',
    };
    useAppContext.mockImplementation(() => context);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    api.fetchMatchdayFixtures.mockImplementation((id) =>
      Promise.resolve(
        id === '10'
          ? [fixture(101, 'Jornada 10', 'Equipo A')]
          : [fixture(201, 'Jornada 2', 'Equipo B')],
      ),
    );
    api.submitMatchdayPredictions.mockResolvedValue({ message: 'Guardado' });
    // Sin resumen de jornadas se pide la temporada entera y las jornadas salen de los partidos.
    api.fetchLeaderboardMatchdays.mockResolvedValue([]);
  });

  it('resets the selected round and preserves an immediate draft when switching leagues', async () => {
    const view = render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo A'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Goles de Visitante 101'), { target: { value: '0' } });
    context = { ...context, activeGroupId: '20', activeGroupName: 'Liga B' };
    view.rerender(tree());
    expect(await screen.findByLabelText('Goles de Equipo B')).toHaveValue(null);
    expect(screen.queryByLabelText('Goles de Equipo A')).not.toBeInTheDocument();
    expect(localStorage.getItem('draft_matchday_u7_g20')).toBeNull();
    context = { ...context, activeGroupId: '10' };
    view.rerender(tree());
    await waitFor(() => expect(screen.getByLabelText('Goles de Equipo A')).toHaveValue(2));
    expect(screen.getByLabelText('Goles de Visitante 101')).toHaveValue(0);
  });

  it('keeps unsaved edits across a live refresh and only submits edited matches', async () => {
    render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo A'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Goles de Visitante 101'), { target: { value: '1' } });
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
    await waitFor(() => expect(screen.getByLabelText('Goles de Equipo A')).toHaveValue(3));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.submitMatchdayPredictions).toHaveBeenCalledWith('10', [
        { matchId: 101, homeScore: 3, awayScore: 1, sign: '1' },
      ]),
    );
  });

  it('rejects a partial score instead of sending a stale sign', async () => {
    render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo A'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Completa los dos marcadores');
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
  });

  it('includes the final and provides calendar dates when the provider has no round', async () => {
    api.fetchMatchdayFixtures.mockResolvedValue([
      fixture(101, 'final', 'Finalista'),
      fixture(102, 'group', 'Sin ronda'),
    ]);
    render(tree());
    const roundSelect = await screen.findByLabelText('Seleccionar jornada');
    expect(await screen.findByRole('option', { name: 'final' })).toBeInTheDocument();
    fireEvent.change(roundSelect, { target: { value: 'Fecha 2099-01-01' } });
    expect(screen.getByLabelText('Goles de Sin ronda')).toBeInTheDocument();
    expect(screen.queryByLabelText('Goles de Finalista')).not.toBeInTheDocument();
  });

  it('does not clear another league draft when a save finishes after switching', async () => {
    let finishSave;
    api.submitMatchdayPredictions.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Pronosticar signo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalled());
    context = { ...context, activeGroupId: '20' };
    view.rerender(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo B'), { target: { value: '4' } });
    await act(async () => finishSave({ message: 'Guardado A' }));
    expect(screen.getByLabelText('Goles de Equipo B')).toHaveValue(4);
    expect(JSON.parse(localStorage.getItem('draft_matchday_u7_g20'))['201'].homeScore).toBe('4');
    expect(screen.queryByText('Guardado A')).not.toBeInTheDocument();
  });

  it('hides the save confirmation after 4 s and clears the timer on unmount', async () => {
    const view = render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Pronosticar signo 1' }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('Guardado')).toBeInTheDocument();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      act(() => vi.advanceTimersByTime(4000));
      expect(screen.queryByText('Guardado')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Pronosticar signo 2' }));
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
    api.fetchMatchdayFixtures.mockResolvedValue([
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
  });
});

describe('matchday screen with the league round summary', () => {
  let client;
  const matchday = (label, current = false) => ({
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
    useAppContext.mockImplementation(() => ({
      activeGroupId: '10',
      activeGroupName: 'Liga A',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeCompetitionFormatType: 'LEAGUE',
      isAuthenticated: true,
      userId: '7',
    }));
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    api.fetchLeaderboardMatchdays.mockResolvedValue([
      matchday('Jornada 1'),
      matchday('Jornada 2', true),
      matchday('Jornada 3'),
    ]);
    api.fetchMatchdayFixtures.mockImplementation((_groupId, round) =>
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
    expect(await screen.findByLabelText('Goles de Local Jornada 2')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledTimes(1);
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', 'Jornada 2');

    fireEvent.click(screen.getByRole('button', { name: 'Jornada siguiente' }));
    expect(await screen.findByLabelText('Goles de Local Jornada 3')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenLastCalledWith('10', 'Jornada 3');
    expect(api.fetchMatchdayFixtures).not.toHaveBeenCalledWith('10', '');
  });

  it('falls back to the whole season when the summary cannot be loaded', async () => {
    api.fetchLeaderboardMatchdays.mockRejectedValue(new Error('caído'));
    api.fetchMatchdayFixtures.mockResolvedValue([fixture(1, 'Jornada 1', 'Equipo 1')]);
    render(tree());
    expect(await screen.findByLabelText('Goles de Equipo 1')).toBeInTheDocument();
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith('10', '');
  });

  it('keeps the draft of another round while browsing rounds', async () => {
    render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Local Jornada 2'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Jornada siguiente' }));
    await screen.findByLabelText('Goles de Local Jornada 3');
    expect(JSON.parse(localStorage.getItem('draft_matchday_u7_g10'))['2'].homeScore).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Jornada anterior' }));
    await waitFor(() => expect(screen.getByLabelText('Goles de Local Jornada 2')).toHaveValue(2));
  });
});
