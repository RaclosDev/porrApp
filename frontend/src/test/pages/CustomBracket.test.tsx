import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomBracket from '../../pages/CustomBracket';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');

describe('CustomBracket component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('carga y renderiza las rondas del cuadro incluso si activeCompetitionId es null', async () => {
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeCompetitionId: null,
        activeGroupPoolFormat: 'KNOCKOUTS_ONLY',
        activeGroupName: 'LOL Worlds 2026',
        activeGroupIsLocked: false,
        activeGroupLockDate: '2026-11-07T00:00:00',
        userName: 'Tester',
      }),
    );

    vi.mocked(api.fetchCustomTeams).mockResolvedValue([
      { id: 102, name: 'T1', groupName: null },
      { id: 103, name: 'Gen.G', groupName: null },
      { id: 104, name: 'HLE', groupName: null },
      { id: 105, name: 'DK', groupName: null },
      { id: 106, name: 'BLG', groupName: null },
      { id: 107, name: 'TES', groupName: null },
      { id: 108, name: 'WBG', groupName: null },
      { id: 109, name: 'LNG', groupName: null },
    ]);

    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      {
        id: 697,
        home: 'T1',
        away: 'Gen.G',
        away_team_id: 103,
        home_team_id: 102,
        round: 'bracket-1',
        finished: false,
      } as unknown as Match,
      {
        id: 698,
        home: 'HLE',
        away: 'DK',
        away_team_id: 105,
        home_team_id: 104,
        round: 'bracket-1',
        finished: false,
      } as unknown as Match,
      {
        id: 699,
        home: 'BLG',
        away: 'TES',
        away_team_id: 107,
        home_team_id: 106,
        round: 'bracket-1',
        finished: false,
      } as unknown as Match,
      {
        id: 700,
        home: 'WBG',
        away: 'LNG',
        away_team_id: 109,
        home_team_id: 108,
        round: 'bracket-1',
        finished: false,
      } as unknown as Match,
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <CustomBracket />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(api.fetchCustomTeams).toHaveBeenCalledWith(10);
      expect(api.fetchCustomMatches).toHaveBeenCalledWith(10);
    });

    // Debe mostrar los títulos de las tres rondas del torneo
    expect(await screen.findByText('Cuartos de final')).toBeInTheDocument();
    expect(screen.getByText('Semifinales')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();

    // Comprobar que los equipos de primera ronda aparecen
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('Gen.G')).toBeInTheDocument();

    // Seleccionar T1 y DK en cuartos de final
    const t1Radio = screen.getByRole('radio', { name: 'T1' });
    fireEvent.click(t1Radio);
    expect(t1Radio).toBeChecked();

    const dkRadio = screen.getByRole('radio', { name: 'DK' });
    fireEvent.click(dkRadio);
    expect(dkRadio).toBeChecked();

    // En semifinales, Cruce 1 ahora debe tener a T1 y DK
    const allT1 = screen.getAllByText('T1');
    expect(allT1.length).toBeGreaterThanOrEqual(2); // Uno en cuartos, uno en semis
  });
});
