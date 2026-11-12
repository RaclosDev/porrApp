import { fireEvent, render, screen, within } from '@testing-library/react';
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
  fireEvent.click(await screen.findByRole('button', { name: 'Más opciones de Liga de Ana' }));
  expect(screen.getByRole('button', { name: 'Miembros de Liga de Ana' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Administrar Liga de Ana' })).not.toBeInTheDocument();
});

it('offers direct tournament management only to its creator', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ isAuthenticated: true, userId: '7', userName: 'Ana' }),
  );
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({ id: 30, name: 'Poker Sábados', kind: 'TOURNAMENT', adminUserId: 7 }),
    group({ id: 31, name: 'Otro torneo', kind: 'TOURNAMENT', adminUserId: 8 }),
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GroupsDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole('link', { name: 'Administrar torneo: Poker Sábados' }),
  ).toHaveAttribute('href', '/torneos/30');
  expect(screen.queryByRole('link', { name: 'Administrar torneo: Otro torneo' })).toBeNull();
});

it('lista primero la liga activa, luego las abiertas hace menos y al final las nunca abiertas', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ isAuthenticated: true, userId: '1', userName: 'Ana', activeGroupId: '3' }),
  );
  localStorage.setItem('group_last_visited', JSON.stringify({ 1: 100, 2: 300 }));
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({ id: 1, name: 'Vieja', createdAt: '2026-01-01T00:00:00Z' }),
    group({ id: 2, name: 'Reciente', createdAt: '2026-01-02T00:00:00Z' }),
    group({ id: 3, name: 'Activa', createdAt: '2026-01-03T00:00:00Z' }),
    group({ id: 4, name: 'Nueva sin abrir', createdAt: '2026-06-01T00:00:00Z' }),
    group({ id: 5, name: 'Antigua sin abrir', createdAt: '2025-06-01T00:00:00Z' }),
  ]);
  vi.mocked(fetchCompetitions).mockResolvedValue([]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GroupsDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: 'Abrir Vieja' });
  const names = within(screen.getByRole('list'))
    .getAllByRole('button', { name: /^Abrir / })
    .map((button) => button.getAttribute('aria-label'));
  expect(names).toEqual([
    'Abrir Activa',
    'Abrir Reciente',
    'Abrir Vieja',
    'Abrir Nueva sin abrir',
    'Abrir Antigua sin abrir',
  ]);
  localStorage.removeItem('group_last_visited');
});
