import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminPanel from '../../pages/AdminPanel';
import {
  applyAdminIncident,
  dismissAdminIncident,
  fetchAdminIncidents,
  fetchAdminOverview,
  sendAdminAnnouncement,
} from '../../services/endpoints/admin';
import type { AdminIncident, AdminOverview } from '../../types/api';
import { confirmAction } from '../../utils/confirmAction';

vi.mock('../../services/endpoints/admin', () => ({
  fetchAdminOverview: vi.fn(),
  sendAdminAnnouncement: vi.fn(),
  fetchAdminIncidents: vi.fn(),
  applyAdminIncident: vi.fn(),
  dismissAdminIncident: vi.fn(),
}));
vi.mock('../../utils/confirmAction', () => ({ confirmAction: vi.fn() }));

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
      plan: 'FREE',
      pokerMusic: false,
    },
  ],
};

const renderPanel = (url = '/gestion-7k2q') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <AdminPanel />
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAdminIncidents).mockResolvedValue([]);
});

const incident: AdminIncident = {
  id: 9,
  kind: 'REGRESSION',
  status: 'BLOCKED',
  matchId: 31,
  match: 'Betis - Sevilla',
  competition: 'LaLiga',
  matchDate: '2026-11-12T20:00:00Z',
  previous: { status: 'terminado', homeScore: 2, awayScore: 1, winner: null },
  received: { status: 'sin empezar', homeScore: null, awayScore: null, winner: null },
  firstSeenAt: '2026-11-13T09:00:00Z',
  lastSeenAt: '2026-11-13T09:05:00Z',
  seenCount: 2,
  autoApplyAt: null,
  resolvedAt: null,
  resolvedBy: null,
};

it('lists the held results and applies or dismisses them', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  vi.mocked(fetchAdminIncidents).mockResolvedValue([
    incident,
    { ...incident, id: 10, kind: 'SCORE_CHANGE', status: 'PENDING', match: 'Cádiz - Elche' },
    {
      ...incident,
      id: 8,
      status: 'APPLIED',
      match: 'Getafe - Celta',
      resolvedAt: '2026-11-12T22:00:00Z',
      resolvedBy: 'auto',
    },
  ]);
  vi.mocked(applyAdminIncident).mockResolvedValue({ ...incident, status: 'APPLIED' });
  vi.mocked(dismissAdminIncident).mockResolvedValue({ ...incident, status: 'DISMISSED' });
  vi.mocked(confirmAction).mockResolvedValue(true);
  renderPanel('/gestion-7k2q?seccion=incidencias');

  const tab = await screen.findByRole('tab', { name: /Incidencias/ });
  expect(await within(tab).findByText('2')).toBeInTheDocument();
  const held = screen.getByText('Betis - Sevilla').closest('li') as HTMLElement;
  expect(
    within(held).getByText('Un partido terminado vuelve atrás · LaLiga', { exact: false }),
  ).toBeInTheDocument();
  expect(within(held).getByText(/2-1 · terminado/)).toBeInTheDocument();
  expect(within(held).getByText(/sin marcador · sin empezar/)).toBeInTheDocument();

  const resolved = screen.getByText('Getafe - Celta').closest('li') as HTMLElement;
  expect(within(resolved).getByText(/Resuelta sola/)).toBeInTheDocument();
  expect(within(resolved).queryByRole('button', { name: /Aplicar/ })).not.toBeInTheDocument();

  fireEvent.click(within(held).getByRole('button', { name: /Aplicar/ }));
  await vi.waitFor(() => expect(applyAdminIncident).toHaveBeenCalledTimes(1));
  expect(vi.mocked(applyAdminIncident).mock.calls[0][0]).toBe(9);

  const pending = screen.getByText('Cádiz - Elche').closest('li') as HTMLElement;
  fireEvent.click(within(pending).getByRole('button', { name: /Descartar/ }));
  await vi.waitFor(() => expect(dismissAdminIncident).toHaveBeenCalledTimes(1));
  expect(vi.mocked(dismissAdminIncident).mock.calls[0][0]).toBe(10);
});

it('does not apply a held result when the confirmation is cancelled', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  vi.mocked(fetchAdminIncidents).mockResolvedValue([incident]);
  vi.mocked(confirmAction).mockResolvedValue(false);
  renderPanel('/gestion-7k2q?seccion=incidencias');

  fireEvent.click(await screen.findByRole('button', { name: /Aplicar/ }));
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(applyAdminIncident).not.toHaveBeenCalled();
});

it('shows the figures, the latest accounts and the leagues in their tabs', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  renderPanel();

  expect(await screen.findByText('42')).toBeInTheDocument();
  expect(screen.getByText('Póker')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /Cuentas/ }));
  expect(screen.getByText('marta@example.com')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Cuentas/ })).toHaveAttribute('aria-selected', 'true');

  fireEvent.keyDown(screen.getByRole('tab', { name: /Cuentas/ }), { key: 'ArrowRight' });
  expect(screen.getByText('Oficina')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Ligas/ })).toHaveFocus();
});

it('sorts the accounts by the column that is clicked', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue({
    ...overview,
    recentUsers: [
      ...overview.recentUsers,
      {
        id: 2,
        name: 'Álvaro',
        email: 'zeta@example.com',
        method: 'email',
        joinedAt: '2026-11-10T08:00:00Z',
        lastActiveAt: '2026-11-20T09:00:00Z',
        leagues: 5,
      },
    ],
  });
  renderPanel();
  fireEvent.click(await screen.findByRole('tab', { name: /Cuentas/ }));
  const names = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.firstElementChild?.textContent);

  // De entrada, la última alta primero.
  expect(names()).toEqual(['Marta', 'Álvaro']);
  expect(screen.getByRole('columnheader', { name: 'Alta' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Nombre' }));
  expect(names()).toEqual(['Álvaro', 'Marta']);
  fireEvent.click(screen.getByRole('button', { name: 'Nombre' }));
  expect(names()).toEqual(['Marta', 'Álvaro']);

  fireEvent.click(screen.getByRole('button', { name: 'Última vez' }));
  expect(names()).toEqual(['Álvaro', 'Marta']);
  fireEvent.click(screen.getByRole('button', { name: 'Email' }));
  expect(names()).toEqual(['Marta', 'Álvaro']);
  fireEvent.click(screen.getByRole('button', { name: 'Ligas' }));
  expect(names()).toEqual(['Álvaro', 'Marta']);
});

it('filters the leagues by name and kind', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue({
    ...overview,
    leagues: [
      ...overview.leagues,
      { ...overview.leagues[0], id: 6, name: 'Póker del jueves', kind: 'POKER', owner: null },
    ],
  });
  renderPanel('/gestion-7k2q?seccion=ligas');

  expect(await screen.findByText('Póker del jueves')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Porras' }));
  expect(screen.queryByText('Póker del jueves')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
  fireEvent.change(screen.getByLabelText('Buscar liga o creador'), { target: { value: 'poker' } });
  expect(screen.getByText('Póker del jueves')).toBeInTheDocument();
  expect(screen.queryByText('Oficina')).not.toBeInTheDocument();
});

it('sends a notice to the chosen leagues after confirming and shows the counts', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  vi.mocked(confirmAction).mockResolvedValue(true);
  vi.mocked(sendAdminAnnouncement).mockResolvedValue({
    leagues: 1,
    members: 8,
    devices: 5,
    sent: 3,
    retrying: 1,
    failed: 1,
  });
  renderPanel('/gestion-7k2q?seccion=avisos');

  const send = await screen.findByRole('button', { name: /Mandar aviso/ });
  expect(send).toBeDisabled();

  fireEvent.click(screen.getByRole('checkbox', { name: /Oficina/ }));
  fireEvent.change(screen.getByLabelText(/Título/), { target: { value: ' Jornada 12 ' } });
  fireEvent.change(screen.getByLabelText(/Texto/), { target: { value: 'Ya podéis predecir.' } });
  expect(
    screen.getByText('Jornada 12', { selector: '.admin-push-preview-title' }),
  ).toBeInTheDocument();

  fireEvent.click(send);

  const status = await screen.findByRole('status');
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({ details: expect.arrayContaining(['Ligas: Oficina']) }),
  );
  expect(sendAdminAnnouncement).toHaveBeenCalledWith(
    { leagueIds: [5], title: 'Jornada 12', body: 'Ya podéis predecir.' },
    expect.anything(),
  );
  expect(within(status).getByText('Dispositivos').nextSibling).toHaveTextContent('5');
  expect(within(status).getByText('Fallidos').nextSibling).toHaveTextContent('1');
  expect(screen.getByLabelText(/Título/)).toHaveValue('');
});

it('does not send when the confirmation is cancelled and shows server errors', async () => {
  vi.mocked(fetchAdminOverview).mockResolvedValue(overview);
  vi.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  vi.mocked(sendAdminAnnouncement).mockRejectedValue(
    new Error('Has enviado 5 avisos en la última hora.'),
  );
  renderPanel('/gestion-7k2q?seccion=avisos');

  fireEvent.click(await screen.findByRole('checkbox', { name: /Oficina/ }));
  fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Hola' } });
  fireEvent.change(screen.getByLabelText(/Texto/), { target: { value: 'Qué tal' } });
  const send = screen.getByRole('button', { name: /Mandar aviso/ });

  fireEvent.click(send);
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(sendAdminAnnouncement).not.toHaveBeenCalled();

  fireEvent.click(send);
  expect(await screen.findByRole('alert')).toHaveTextContent('Has enviado 5 avisos');
  expect(screen.getByLabelText(/Título/)).toHaveValue('Hola');
});

it('looks like a missing page when the server refuses', async () => {
  vi.mocked(fetchAdminOverview).mockRejectedValue(new Error('404'));
  renderPanel();

  expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
});
