import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import GroupsDashboard from '../../pages/GroupsDashboard';
import { useAppContext } from '../../context/AppContext';
import { fetchMyGroups, fetchCompetitions } from '../../services/api';
import { appContext, group } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  fetchMyGroups: vi.fn(),
  fetchCompetitions: vi.fn(),
}));

it('does not offer administration of another user league with the same public name', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ isAuthenticated: true, userId: '2', userName: 'Ana' }),
  );
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({ name: 'Liga de Ana', adminUserId: 1, adminParticipantName: 'Ana' }),
  ]);
  vi.mocked(fetchCompetitions).mockResolvedValue([]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GroupsDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole('button', { name: 'Miembros de Liga de Ana' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Administrar Liga de Ana' })).not.toBeInTheDocument();
});
