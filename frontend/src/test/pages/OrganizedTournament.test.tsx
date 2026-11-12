import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import OrganizedTournamentPage from '../../pages/OrganizedTournament';
import CreateTournament from '../../pages/CreateTournament';
import TournamentSetup from '../../components/tournament/TournamentSetup';
import MatchEditor from '../../components/tournament/MatchEditor';
import {
  changeTournament,
  createOrganizedTournament,
  fetchOrganizedTournament,
  type OrganizedTournament,
} from '../../services/endpoints/organizedTournaments';

vi.mock('../../services/endpoints/organizedTournaments', async (original) => ({
  ...(await original<typeof import('../../services/endpoints/organizedTournaments')>()),
  fetchOrganizedTournament: vi.fn(),
  createOrganizedTournament: vi.fn(),
  changeTournament: vi.fn(),
}));
vi.mock('../../components/tracker/TrackerQr', () => ({ default: () => <p>QR del torneo</p> }));
afterEach(() => vi.resetAllMocks());

const fixture = (): OrganizedTournament => ({
  id: 42,
  name: 'Copa de verano',
  activity: 'Petanca',
  participantType: 'PAIR',
  format: 'LEAGUE',
  published: false,
  publicId: 'public-key',
  revision: 3,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  participants: [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Bea' },
  ],
  matches: [
    {
      id: 'm',
      round: 1,
      position: 0,
      homeId: 'a',
      awayId: 'b',
      homeScore: 13,
      awayScore: 8,
      outcome: 'HOME',
      bye: false,
      scheduledAt: '2026-11-11T17:00:00Z',
      venue: 'La plaza',
    },
  ],
  standings: [
    {
      participantId: 'a',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      scored: 13,
      conceded: 8,
      points: 3,
    },
    {
      participantId: 'b',
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      scored: 8,
      conceded: 13,
      points: 0,
    },
  ],
});
function renderPage(publicView = false, create = false) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}
    >
      <MemoryRouter
        initialEntries={[create ? '/torneos/nuevo' : publicView ? '/t/public-key' : '/torneos/42']}
      >
        <Routes>
          <Route path="/torneos/nuevo" element={<CreateTournament />} />
          <Route path="/torneos/:id" element={<OrganizedTournamentPage />} />
          <Route path="/t/:publicId" element={<OrganizedTournamentPage publicView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('renders public standings, dates and participants without management controls', async () => {
  vi.mocked(fetchOrganizedTournament).mockResolvedValue({ ...fixture(), published: true });
  renderPage(true);
  expect(await screen.findByRole('heading', { name: 'Copa de verano' })).toBeInTheDocument();
  expect(fetchOrganizedTournament).toHaveBeenCalledWith('public-key', true);
  expect(screen.getByRole('row', { name: /Ana/ })).toHaveTextContent('13');
  expect(screen.getByText(/La plaza/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Editar encuentro|Publicar torneo/ }),
  ).not.toBeInTheDocument();
});

it('does not show unpublished data and can retry a failed public read', async () => {
  vi.mocked(fetchOrganizedTournament).mockRejectedValue(
    new Error('Este torneo no está publicado.'),
  );
  renderPage(true);
  expect(await screen.findByRole('heading', { name: 'Torneo no disponible' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('no está publicado');
  vi.mocked(fetchOrganizedTournament).mockResolvedValue({ ...fixture(), published: true });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'Copa de verano' })).toBeInTheDocument();
});

it('publishes using the loaded revision and shows a shareable link', async () => {
  vi.mocked(fetchOrganizedTournament).mockResolvedValue(fixture());
  vi.mocked(changeTournament).mockResolvedValue({ ...fixture(), published: true, revision: 4 });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar torneo' }));
  await waitFor(() =>
    expect(changeTournament).toHaveBeenCalledWith(42, 'publication', 'PUT', {
      published: true,
      revision: 3,
    }),
  );
  expect(await screen.findByRole('button', { name: 'Retirar publicación' })).toBeInTheDocument();
  expect(screen.getByLabelText('Enlace público')).toHaveValue(
    `${window.location.origin}/t/public-key`,
  );
});

it('opens an empty tournament directly in setup', async () => {
  vi.mocked(fetchOrganizedTournament).mockResolvedValue({
    ...fixture(),
    participants: [],
    matches: [],
    standings: [],
  });
  renderPage();

  expect(await screen.findByRole('button', { name: 'Participantes y formato' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('textbox', { name: 'Nombre del participante' })).toBeVisible();
});

it('keeps a rejected result visible and reloads after a conflict', async () => {
  vi.mocked(fetchOrganizedTournament).mockResolvedValue(fixture());
  vi.mocked(changeTournament).mockRejectedValue(new Error('El torneo ha cambiado.'));
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Editar encuentro/ }));
  fireEvent.change(screen.getByLabelText('Marcador de Ana'), { target: { value: '14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El torneo ha cambiado');
  expect(screen.getByLabelText('Marcador de Ana')).toHaveValue(14);
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos' }));
  await waitFor(() => expect(screen.queryByLabelText('Marcador de Ana')).not.toBeInTheDocument());
});

it('shows the winner and automatic byes in a public knockout', async () => {
  const t = fixture();
  t.format = 'KNOCKOUT';
  t.matches[0].bye = true;
  vi.mocked(fetchOrganizedTournament).mockResolvedValue(t);
  renderPage(true);
  expect(await screen.findByText(/Ganador del torneo/)).toHaveTextContent('Ana');
  expect(screen.getByText(/Pase automático/)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Clasificación' })).not.toBeInTheDocument();
});

it('creates a draft with trimmed names and retains its idempotency key on retry', async () => {
  vi.mocked(createOrganizedTournament)
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValue(fixture());
  vi.mocked(fetchOrganizedTournament).mockResolvedValue(fixture());
  renderPage(false, true);
  fireEvent.change(screen.getByLabelText('Nombre del torneo'), { target: { value: ' Copa ' } });
  fireEvent.change(screen.getByLabelText('Deporte o juego'), { target: { value: ' Petanca ' } });
  fireEvent.change(screen.getByLabelText('Participan'), { target: { value: 'PAIR' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear torneo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  fireEvent.click(screen.getByRole('button', { name: 'Crear torneo' }));
  expect(await screen.findByRole('heading', { name: 'Copa de verano' })).toBeInTheDocument();
  const calls = vi.mocked(createOrganizedTournament).mock.calls;
  expect(calls[0][0]).toEqual({
    name: 'Copa',
    activity: 'Petanca',
    participantType: 'PAIR',
    creationKey: expect.any(String),
  });
  expect(calls[1][0].creationKey).toBe(calls[0][0].creationKey);
});

it('adds, renames, reorders and removes participants before generating a seeded bracket', async () => {
  const t = fixture();
  t.matches = [];
  t.format = 'MANUAL';
  const update = vi.fn().mockResolvedValue(true);
  render(<TournamentSetup tournament={t} update={update} busy={false} />);
  fireEvent.change(screen.getByLabelText('Nombre del participante'), {
    target: { value: ' Clara ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
  await waitFor(() => expect(screen.getByLabelText('Nombre del participante')).toHaveValue(''));
  expect(update).toHaveBeenLastCalledWith('participants', 'POST', { name: 'Clara' });
  fireEvent.change(screen.getByLabelText('Nombre de Ana'), { target: { value: 'Ana María' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre de Ana' }));
  expect(update).toHaveBeenLastCalledWith('participants/a', 'PUT', { name: 'Ana María' });
  fireEvent.click(screen.getByRole('button', { name: 'Bajar a Ana' }));
  expect(update).toHaveBeenLastCalledWith('order', 'PUT', { participantIds: ['b', 'a'] });
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Bea' }));
  expect(update).toHaveBeenLastCalledWith('participants/b?revision=3', 'DELETE');
  fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'KNOCKOUT' } });
  fireEvent.change(screen.getByLabelText('Crear cuadro'), { target: { value: 'SEEDED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generar cuadro' }));
  expect(update).toHaveBeenLastCalledWith('schedule', 'POST', {
    format: 'KNOCKOUT',
    draw: 'SEEDED',
    legs: 1,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
  });
});

it('swaps generated bracket positions only before play begins', () => {
  const t = fixture();
  t.format = 'KNOCKOUT';
  t.matches[0].outcome = null;
  const update = vi.fn().mockResolvedValue(true);
  const view = render(<TournamentSetup tournament={t} update={update} busy={false} />);
  fireEvent.change(screen.getByLabelText('Mover participante'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('Intercambiar con'), { target: { value: 'b' } });
  fireEvent.click(screen.getByRole('button', { name: 'Intercambiar posiciones' }));
  expect(update).toHaveBeenLastCalledWith('positions', 'PUT', { firstId: 'a', secondId: 'b' });
  t.matches[0].outcome = 'HOME';
  view.rerender(<TournamentSetup tournament={t} update={update} busy={false} />);
  expect(screen.queryByRole('button', { name: 'Intercambiar posiciones' })).not.toBeInTheDocument();
});

it('supports results without a score, dates and deliberate result clearing', async () => {
  const t = fixture();
  t.format = 'KNOCKOUT';
  const update = vi.fn().mockResolvedValue(true),
    close = vi.fn();
  render(
    <MatchEditor tournament={t} match={t.matches[0]} update={update} busy={false} close={close} />,
  );
  expect(screen.queryByRole('option', { name: 'Empate' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Marcador de Ana'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Marcador de Bea'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'AWAY' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(update).toHaveBeenLastCalledWith('matches/m/result', 'PUT', {
    homeScore: null,
    awayScore: null,
    outcome: 'AWAY',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Borrar resultado' }));
  expect(update).toHaveBeenLastCalledWith('matches/m/result', 'PUT', {
    homeScore: null,
    awayScore: null,
    outcome: null,
  });
});
