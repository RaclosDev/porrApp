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
        leagueKind: 'knockoutDraw',
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

  describe('playoffs de la NBA', () => {
    const nbaState = {
      ...lockState([[false, false]]),
      mode: 'PER_MATCH' as const,
      knockoutRounds: [
        {
          round: 'r16',
          drawn: true,
          expectedTies: 8,
          bestOf: 7,
          ties: [
            { home: 'Cavaliers', away: 'Heat', winner: null, matchIds: [11, 12], conference: 'E' },
            {
              home: 'Thunder',
              away: 'Grizzlies',
              winner: null,
              matchIds: [21, 22],
              conference: 'W',
            },
          ],
        },
        { round: 'qf', drawn: false, expectedTies: 4, bestOf: 7, ties: [] },
      ],
    };

    beforeEach(() => {
      vi.mocked(appContextModule.useAppContext).mockReturnValue(
        appContext({
          activeGroupId: '20',
          activeGroupName: 'Playoffs 2027',
          leagueKind: 'knockoutDraw',
          activeGroupIsLocked: false,
          activeCompetitionExternalId: 'nba',
          userName: 'Tester',
          allGames: [
            leg(11, 'Cavaliers', 'Heat', '2027-04-19T00:30:00+02:00', { round: 'r16' }),
            leg(12, 'Cavaliers', 'Heat', '2027-04-21T01:00:00+02:00', { round: 'r16' }),
            leg(21, 'Thunder', 'Grizzlies', '2027-04-20T21:30:00+02:00', { round: 'r16' }),
            leg(22, 'Thunder', 'Grizzlies', '2027-04-23T03:30:00+02:00', { round: 'r16' }),
          ],
        }),
      );
    });

    it('elige quién gana la serie y en cuántos partidos, agrupadas por conferencia', async () => {
      vi.mocked(api.fetchCustomLockState).mockResolvedValue(nbaState);
      renderPredictor();

      expect(await screen.findByRole('tab', { name: '1.ª ronda' })).toBeInTheDocument();
      expect(screen.getByText('Conferencia Este')).toBeInTheDocument();
      expect(screen.getByText('Conferencia Oeste')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Pasar a Thunder' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Thunder gana 4-1, en 5 partidos' }),
      );

      await waitFor(() =>
        expect(api.createPrediction).toHaveBeenCalledWith(
          expect.objectContaining({
            customRounds: [[null, 'Thunder']],
            customSeriesGames: [[null, 5]],
          }),
          '20',
        ),
      );
    });

    it('sin series aún, dice cuándo empiezan los playoffs', async () => {
      vi.mocked(api.fetchCustomLockState).mockResolvedValue({
        ...nbaState,
        knockoutRounds: [],
        playoffsStart: '2027-04-12T09:00:00+02:00',
      });
      renderPredictor();

      expect(
        await screen.findByText(/Los playoffs empiezan el lunes, 12 de abril/),
      ).toBeInTheDocument();
    });
  });

  it('avisa si aún no hay cruces', async () => {
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({ ...lockState(), knockoutRounds: [] });
    renderPredictor();

    expect(await screen.findByText(/Aún no se han sorteado los cruces/)).toBeInTheDocument();
  });
});
