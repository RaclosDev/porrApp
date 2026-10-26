import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchdayPredictor from '../../pages/MatchdayPredictor';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchMatchdayFixtures: vi.fn(),
  submitMatchdayPredictions: vi.fn(),
  fetchMissingRoundUsers: vi.fn(),
}));
vi.mock('../../components/Flag', () => ({ default: () => null }));
vi.mock('../../components/MatchFriendsBetsModal', () => ({ default: () => null }));

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
      activeGroupBetMode: 'MATCH_DAY',
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
  });

  it('resets the selected round and preserves an immediate draft when switching leagues', async () => {
    const view = render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo A'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Goles de Visitante 101'), { target: { value: '0' } });
    context = { ...context, activeGroupId: '20', activeGroupName: 'Liga B' };
    view.rerender(tree());
    expect(await screen.findByLabelText('Goles de Equipo B')).toHaveValue(null);
    expect(screen.queryByLabelText('Goles de Equipo A')).not.toBeInTheDocument();
    expect(localStorage.getItem('draft_matchday_20')).toBeNull();
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
        ['matchdayFixtures', '10', '7'],
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
    fireEvent.click(screen.getByRole('button', { name: /💾 Guardar \(/ }));
    await waitFor(() =>
      expect(api.submitMatchdayPredictions).toHaveBeenCalledWith('10', [
        { matchId: 101, homeScore: 3, awayScore: 1, sign: '1' },
      ]),
    );
  });

  it('rejects a partial score instead of sending a stale sign', async () => {
    render(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo A'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /💾 Guardar \(/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Completa los dos marcadores');
    expect(api.submitMatchdayPredictions).not.toHaveBeenCalled();
  });

  it('includes the final and provides calendar dates when the provider has no round', async () => {
    api.fetchMatchdayFixtures.mockResolvedValue([
      fixture(101, 'final', 'Finalista'),
      fixture(102, 'group', 'Sin ronda'),
    ]);
    render(tree());
    expect(await screen.findByRole('button', { name: 'final' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fecha 2099-01-01' }));
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
    fireEvent.click(screen.getByRole('button', { name: /💾 Guardar \(/ }));
    await waitFor(() => expect(api.submitMatchdayPredictions).toHaveBeenCalled());
    context = { ...context, activeGroupId: '20' };
    view.rerender(tree());
    fireEvent.change(await screen.findByLabelText('Goles de Equipo B'), { target: { value: '4' } });
    await act(async () => finishSave({ message: 'Guardado A' }));
    expect(screen.getByLabelText('Goles de Equipo B')).toHaveValue(4);
    expect(JSON.parse(localStorage.getItem('draft_matchday_20'))['201'].homeScore).toBe('4');
    expect(screen.queryByText('Guardado A')).not.toBeInTheDocument();
  });

  it('does not render "Todas las Jornadas" and formats rounds with independent buttons and past dropdown', async () => {
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

    // With J1, J2, J3 finished and J4 active:
    // - earlierPastRounds = [J1, J2] (in select)
    // - lastRound = J3 (button)
    // - currentRound = J4 (button)
    // - nextRound = J5 (button)
    // - futureRounds = [J6] (in select)
    expect(await screen.findByRole('button', { name: 'Jornada 3' })).toHaveTextContent(
      'Última: Jornada 3',
    );
    expect(screen.getByRole('button', { name: 'Jornada 4' })).toHaveTextContent(
      'Actual: Jornada 4',
    );
    expect(screen.getByRole('button', { name: 'Jornada 5' })).toHaveTextContent(
      'Próxima: Jornada 5',
    );

    const pastSelect = screen.getByLabelText('Jornadas anteriores');
    expect(pastSelect).toBeInTheDocument();
    expect(pastSelect).toHaveTextContent('Jornada 1');
    expect(pastSelect).toHaveTextContent('Jornada 2');
    expect(pastSelect).not.toHaveTextContent('Jornada 3'); // J3 is independent button!

    // Counter scopes to selected round (J4 has 1 match, 0 predicted -> (0/1), not (0/6))
    expect(screen.getByRole('button', { name: /💾 Guardar \(/ })).toHaveTextContent('(0/1)');
  });
});
