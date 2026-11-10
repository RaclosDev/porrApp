import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import GroupsDashboard from '../../pages/GroupsDashboard';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitions, fetchMyGroups, fetchMyLeagueSummaries } from '../../services/api';
import { fetchTrackers } from '../../services/endpoints/trackers';
import { appContext, group } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  fetchMyGroups: vi.fn(),
  fetchMyLeagueSummaries: vi.fn(),
  fetchCompetitions: vi.fn(),
}));
vi.mock('../../services/endpoints/trackers', async (original) => ({
  ...(await original<typeof import('../../services/endpoints/trackers')>()),
  fetchTrackers: vi.fn(),
}));

const showMyLeagues = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <GroupsDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ isAuthenticated: true, userId: '1', userName: 'Ana', activeGroupId: '1' }),
  );
  vi.mocked(fetchCompetitions).mockResolvedValue([]);
  vi.mocked(fetchMyLeagueSummaries).mockResolvedValue([]);
});

it('una liga de juegos de mesa sale una sola vez, con su tarjeta, y se abre como liga activa', async () => {
  // El servidor la manda en las dos listas: como liga del usuario y como marcador.
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({ id: 1, name: 'Peña de LaLiga' }),
    group({ id: 9, name: 'Mus de los jueves', kind: 'SCOREBOARD', competitionName: null }),
  ]);
  vi.mocked(fetchTrackers).mockResolvedValue([
    { id: 9, name: 'Mus de los jueves', owner: true, players: 4, rounds: 12 },
  ]);
  showMyLeagues();

  const scoreboard = await screen.findByRole('link', {
    name: 'Abrir el marcador Mus de los jueves',
  });
  expect(scoreboard).toHaveAttribute('href', '/?group=9');
  expect(await screen.findByText('Peña de LaLiga')).toBeInTheDocument();
  expect(screen.getAllByText('Mus de los jueves')).toHaveLength(1);
  expect(within(scoreboard).getByText('Mus de los jueves')).toBeInTheDocument();
});

it('con solo una liga de juegos de mesa no enseña el aviso de «sin ligas»', async () => {
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({ id: 9, name: 'Mus de los jueves', kind: 'SCOREBOARD', competitionName: null }),
  ]);
  vi.mocked(fetchTrackers).mockResolvedValue([
    { id: 9, name: 'Mus de los jueves', owner: true, players: 4, rounds: 12 },
  ]);
  showMyLeagues();

  expect(
    await screen.findByRole('link', { name: 'Abrir el marcador Mus de los jueves' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Mus de los jueves')).toHaveLength(1);
});
