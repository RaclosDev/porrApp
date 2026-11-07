import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KnockoutDrawPredictor from '../../pages/KnockoutDrawPredictor';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import * as leaguePredictions from '../../hooks/useLeaguePredictions';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');
vi.mock('../../hooks/useLeaguePredictions', () => ({ useMyLeaguePrediction: vi.fn() }));

const leg = (id: number, home: string, away: string, date: string, fields: Partial<Match> = {}) =>
  ({
    id,
    home,
    away,
    date,
    round: 'playoff',
    finished: false,
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    ...fields,
  }) as unknown as Match;

const lockState = (lockedPicks: boolean[][] = [[false, false], []]) => ({
  mode: 'PER_ROUND' as const,
  offsetMinutes: 0,
  lockDate: null,
  lockedGroups: [],
  lockedPicks,
  anyLocked: lockedPicks.flat().some(Boolean),
  fullyLocked: false,
  nextLockAt: '2027-02-16T21:00:00+01:00',
  knockoutRounds: [
    {
      round: 'playoff',
      drawn: true,
      expectedTies: 2,
      ties: [
        { home: 'Galatasaray', away: 'Juventus', winner: null, matchIds: [1, 2] },
        { home: 'Benfica', away: 'Real Madrid', winner: null, matchIds: [3, 4] },
      ],
    },
    { round: 'r16', drawn: false, expectedTies: 8, ties: [] },
  ],
});

const renderPredictor = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <KnockoutDrawPredictor />
    </QueryClientProvider>,
  );

describe('KnockoutDrawPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leaguePredictions.useMyLeaguePrediction).mockReturnValue(undefined);
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeGroupName: 'Champions 2027',
        activeGroupKnockoutDraw: true,
        activeGroupIsLocked: false,
        userName: 'Tester',
        allGames: [
          leg(1, 'Galatasaray', 'Juventus', '2027-02-16T21:00:00+01:00'),
          leg(2, 'Juventus', 'Galatasaray', '2027-02-24T21:00:00+01:00'),
          leg(3, 'Benfica', 'Real Madrid', '2027-02-17T21:00:00+01:00'),
          leg(4, 'Real Madrid', 'Benfica', '2027-02-25T21:00:00+01:00'),
        ],
      }),
    );
    vi.mocked(api.createPrediction).mockResolvedValue(undefined as never);
  });

  it('guarda sola quién pasa en cada cruce de la ronda sorteada', async () => {
    vi.mocked(api.fetchCustomLockState).mockResolvedValue(lockState());
    renderPredictor();

    expect(await screen.findByRole('tab', { name: 'Playoff' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/Ida .*16 feb/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pasar a Real Madrid' }));

    await waitFor(() =>
      expect(api.createPrediction).toHaveBeenCalledWith(
        expect.objectContaining({ customRounds: [[null, 'Real Madrid']], champion: null }),
        '10',
      ),
    );
    expect(await screen.findByText('✓ Guardado')).toBeInTheDocument();
  });

  it('no deja cambiar un cruce cerrado ni elegir en una ronda sin sortear', async () => {
    vi.mocked(api.fetchCustomLockState).mockResolvedValue(lockState([[true, true], []]));
    renderPredictor();

    expect(await screen.findByText('Cerrada: ya ha empezado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pasar a/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Octavos' }));
    expect(
      screen.getByText('Por sortear: los cruces se conocerán tras el sorteo.'),
    ).toBeInTheDocument();
  });

  it('avisa si aún no hay cruces', async () => {
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({ ...lockState(), knockoutRounds: [] });
    renderPredictor();

    expect(await screen.findByText(/Aún no se han sorteado los cruces/)).toBeInTheDocument();
  });
});
