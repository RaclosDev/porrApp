import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

it('uses the league card for tracking tournaments and opens them for members', async () => {
  const ctx = appContext({
    isAuthenticated: true,
    userId: '7',
    userName: 'Ana',
    changeGroup: vi.fn(),
  });
  vi.mocked(useAppContext).mockReturnValue(ctx);
  vi.mocked(fetchMyGroups).mockResolvedValue([
    group({
      id: 30,
      name: 'Poker Sábados',
      kind: 'TOURNAMENT',
      adminUserId: 7,
      joinCode: 'POKER30',
    }),
    group({ id: 31, name: 'Otro torneo', kind: 'TOURNAMENT', adminUserId: 8 }),
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<GroupsDashboard />} />
          <Route path="/torneos/31" element={<h1>Seguimiento del torneo</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  const options = await screen.findByRole('button', { name: 'Más opciones de Poker Sábados' });
  const ownerCard = within(options.closest('li')!);
  fireEvent.click(options);
  expect(
    ownerCard.getByRole('button', { name: 'Invitar a Poker Sábados por WhatsApp' }),
  ).toBeVisible();
  expect(
    ownerCard.getByRole('button', { name: 'Copiar enlace de invitación de Poker Sábados' }),
  ).toBeVisible();
  expect(ownerCard.getByRole('button', { name: 'Ver las reglas de esta liga' })).toBeVisible();
  expect(ownerCard.getByRole('button', { name: 'Administrar Poker Sábados' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Otro torneo' }));
  expect(screen.getByRole('button', { name: 'Miembros de Otro torneo' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Administrar Otro torneo' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Otro torneo' }));
  expect(screen.getByRole('heading', { name: 'Seguimiento del torneo' })).toBeVisible();
  expect(ctx.changeGroup).not.toHaveBeenCalled();
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
