import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TennisDrawBoard from '../../../components/tennisDraw/TennisDrawBoard';
import { useAppContext } from '../../../context/AppContext';
import * as api from '../../../services/api';
import type { Competition } from '../../../types/api';
import { appContext, matchdayFixture } from '../../context/fixtures';

vi.mock('../../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../../services/api', () => ({
  fetchCompetitions: vi.fn(),
  fetchMatchdayFixtures: vi.fn(),
}));

const ATP_FINALS = {
  id: 42,
  name: 'ATP Finals',
  tennis: {
    tournamentId: 154,
    tournament: 'ATP Finals',
    level: 'FINALS',
    draw: 'MEN',
    setsToWin: 2,
    startDate: '2099-11-15T06:00:00+01:00',
    endDate: '2099-11-23T06:00:00+01:00',
  },
} as Competition;

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TennisDrawBoard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TennisDrawBoard', () => {
  beforeEach(() => {
    vi.mocked(api.fetchCompetitions).mockResolvedValue([ATP_FINALS]);
  });

  it('sin cuadro publicado dice cuándo empieza el torneo', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '7',
        activeGroupName: 'Finales con amigos',
        activeCompetitionId: 42,
        activeCompetitionName: 'ATP Finals',
      }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([]);

    renderBoard();

    expect(await screen.findByText('Empieza el 15 de noviembre.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'ATP Finals' })).toBeInTheDocument();
  });

  it('en una liga de varios torneos se titula con el nombre de la liga', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '6',
        activeGroupName: 'Temporada 2026',
        activeCompetitionId: 41,
        activeCompetitionName: null,
      }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      matchdayFixture({
        matchId: 180,
        homeTeam: 'Ben Shelton',
        awayTeam: 'Carlos Alcaraz',
        round: 'Masters de París 2026 · Final',
        matchDate: '2099-11-08T15:00:00+01:00',
        competitionName: 'Masters de París',
      }),
    ]);

    renderBoard();

    expect(await screen.findByText('Ben Shelton')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Temporada 2026' })).toBeInTheDocument();
    expect(api.fetchCompetitions).not.toHaveBeenCalled();
  });
});
