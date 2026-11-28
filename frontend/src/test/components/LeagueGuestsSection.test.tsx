import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueGuestsSection from '../../components/league/LeagueGuestsSection';
import { fetchPokerLeague, removePokerGuest } from '../../services/endpoints/poker';
import { deleteTrackerPlayer, fetchTracker } from '../../services/endpoints/trackers';

vi.mock('../../services/endpoints/poker', () => ({
  fetchPokerLeague: vi.fn(),
  removePokerGuest: vi.fn(),
}));
vi.mock('../../services/endpoints/trackers', () => ({
  fetchTracker: vi.fn(),
  deleteTrackerPlayer: vi.fn(),
}));

const player = (id: number, name: string, guest: boolean) => ({
  id,
  name,
  guest,
  userId: guest ? null : id,
  avatarUrl: null,
});
const poker = (players: ReturnType<typeof player>[]) => ({ id: 7, players });
const tracker = (players: { id: number; name: string }[], claimedPlayerIds: number[]) => ({
  id: 7,
  players,
  claimedPlayerIds,
});

const renderSection = (leagueKind: string | undefined, isAdmin = true) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LeagueGuestsSection leagueId={7} leagueKind={leagueKind} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchPokerLeague).mockResolvedValue(
    poker([player(1, 'Marta', false), player(2, 'Pepe', true)]) as never,
  );
});

it('póker: la administración quita a un invitado tras confirmarlo', async () => {
  vi.mocked(removePokerGuest).mockResolvedValue(poker([player(1, 'Marta', false)]) as never);
  renderSection('POKER');
  expect(await screen.findByText('Invitados sin cuenta (1)')).toBeInTheDocument();
  expect(screen.queryByText('Marta')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Pepe' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
  await waitFor(() => expect(removePokerGuest).toHaveBeenCalledWith(7, 2));
  await waitFor(() => expect(screen.queryByText('Pepe')).not.toBeInTheDocument());
});

it('póker: quien no administra ve a los invitados sin poder quitarlos', async () => {
  renderSection('POKER', false);
  expect(await screen.findByText('Pepe')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quitar a Pepe' })).not.toBeInTheDocument();
});

it('juegos de mesa: los jugadores sin reclamar son invitados y se quitan igual', async () => {
  vi.mocked(fetchTracker).mockResolvedValue(
    tracker(
      [
        { id: 1, name: 'Marta' },
        { id: 3, name: 'Abuelo' },
      ],
      [1],
    ) as never,
  );
  vi.mocked(deleteTrackerPlayer).mockResolvedValue(
    tracker([{ id: 1, name: 'Marta' }], [1]) as never,
  );
  renderSection('SCOREBOARD');
  expect(await screen.findByText('Abuelo')).toBeInTheDocument();
  expect(screen.queryByText('Marta')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Abuelo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
  await waitFor(() => expect(deleteTrackerPlayer).toHaveBeenCalledWith(7, 3));
  await waitFor(() => expect(screen.queryByText('Abuelo')).not.toBeInTheDocument());
});

it('las porras no tienen invitados: no pide nada ni pinta nada', () => {
  const { container } = renderSection('MATCHDAY');
  expect(container).toBeEmptyDOMElement();
  expect(fetchPokerLeague).not.toHaveBeenCalled();
  expect(fetchTracker).not.toHaveBeenCalled();
});
