import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomTournamentHome from '../../pages/CustomTournamentHome';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');
vi.mock('../../hooks/useLeaguePredictions', () => ({ useMyLeaguePrediction: () => undefined }));

const knockout = (fields: Partial<Match>) =>
  ({ away_team_id: 2, home_team_id: 1, finished: false, round: 'bracket-1', ...fields }) as Match;

describe('CustomTournamentHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeGroupName: 'LOL Worlds 2026',
        activeCompetitionName: 'Worlds 2026',
        activeGroupLockDate: '2026-11-07T00:00:00+01:00',
      }),
    );
  });

  it('se muestra (sección activa) con el cuadro real y el ganador de cada cruce', async () => {
    vi.mocked(api.fetchCustomTeams).mockResolvedValue([]);
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout({
        id: 1,
        home: 'T1',
        away: 'Gen.G',
        finished: true,
        homeScore: 3,
        awayScore: 1,
        winner: 'T1',
      }),
      knockout({ id: 2, home: 'HLE', away: 'DK' }),
    ]);

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <CustomTournamentHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Semifinales')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worlds 2026' }).closest('section')).toHaveClass(
      'view-section',
      'active',
    );
    expect(screen.getByText('(ganador)').parentElement).toHaveTextContent('T1');
    expect(screen.getAllByText('T1')).toHaveLength(2);
    expect(screen.getByText('Ganador C2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rellenar mi pronóstico' })).toHaveAttribute(
      'href',
      '/prediction',
    );
  });
});
