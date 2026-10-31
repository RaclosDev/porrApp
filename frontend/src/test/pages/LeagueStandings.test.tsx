import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueStandings from '../../pages/LeagueStandings';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitionStandings } from '../../services/api';
import { appContext } from '../context/fixtures';
import type { LeagueStanding } from '../../types/api';
vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({ fetchCompetitionStandings: vi.fn() }));
const row: LeagueStanding = {
  rank: 1,
  teamName: 'Equipo sin escudo',
  teamLogo: null,
  points: 5,
  gamesPlayed: 3,
  wins: 1,
  ties: 2,
  losses: 0,
  goalDiff: 1,
  goalsFor: 3,
  goalsAgainst: 2,
};
const setup = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LeagueStandings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
beforeEach(() => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeCompetitionId: 4,
      activeCompetitionName: 'Champions League',
      activeGroupPoolFormat: 'MATCH_DAY',
    }),
  );
  vi.clearAllMocks();
});
it('keeps team names in the complete table and does not invent competition zones', async () => {
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([
    row,
    { ...row, rank: 18, teamName: 'Escudo roto', teamLogo: '/broken.png' },
  ]);
  const { container } = setup();
  await screen.findByText(row.teamName);
  fireEvent.click(screen.getByRole('button', { name: 'Completa' }));
  fireEvent.error(container.querySelector('img')!);
  expect(screen.getByText(row.teamName)).toBeVisible();
  expect(screen.getByText('Escudo roto')).toBeVisible();
  expect(container.querySelector('.is-relegation, .is-champions, .is-europa')).toBeNull();
  expect(screen.queryByText('Descenso')).not.toBeInTheDocument();
});
it('shows a recoverable error instead of explaining an empty season', async () => {
  vi.mocked(fetchCompetitionStandings)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([row]);
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
  expect(screen.queryByText(/Los datos se sincronizarán/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(row.teamName)).toBeVisible();
});
it('shows the empty-season message only for an empty response', async () => {
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([]);
  setup();
  expect(await screen.findByText(/Los datos se sincronizarán/)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
