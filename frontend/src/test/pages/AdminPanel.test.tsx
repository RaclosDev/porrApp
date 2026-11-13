import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminPanel from '../../pages/AdminPanel';
import { fetchAdminOverview } from '../../services/endpoints/admin';
import type { AdminOverview } from '../../types/api';

vi.mock('../../services/endpoints/admin', () => ({ fetchAdminOverview: vi.fn() }));

const overview: AdminOverview = {
  generatedAt: '2026-11-13T10:00:00Z',
  totals: {
    users: 42,
    newUsers24h: 3,
    newUsers7d: 9,
    newUsers30d: 20,
    active24h: 11,
    active7d: 25,
    leagues: 7,
    publicLeagues: 2,
    newLeagues7d: 1,
    memberships: 60,
    leaguesByKind: { POOL: 5, POKER: 2 },
  },
  signupsByDay: [{ day: '2026-11-13', count: 3 }],
  recentUsers: [
    {
      id: 1,
      name: 'Marta',
      email: 'marta@example.com',
      method: 'google',
      joinedAt: '2026-11-13T08:00:00Z',
      lastActiveAt: '2026-11-13T09:00:00Z',
      leagues: 2,
    },
  ],
  leagues: [
    {
      id: 5,
      name: 'Oficina',
      kind: 'POOL',
      isPublic: false,
      owner: 'Marta',
      members: 8,
      createdAt: '2026-11-12T08:00:00Z',
    },
  ],
};

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminPanel />
    </QueryClientProvider>,
  );

beforeEach(() => vi.clearAllMocks());

it('shows the figures, the latest accounts and the leagues', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  renderPanel();

  expect(await screen.findByText('42')).toBeInTheDocument();
  expect(screen.getByText('marta@example.com')).toBeInTheDocument();
  expect(screen.getByText('Oficina')).toBeInTheDocument();
  expect(screen.getByText('Póker')).toBeInTheDocument();
});

it('looks like a missing page when the server refuses', async () => {
  vi.mocked(fetchAdminOverview).mockRejectedValue(new Error('404'));
  renderPanel();

  expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
});
