import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PokerGuestsSection from '../../components/league/PokerGuestsSection';
import { fetchPokerLeague, removePokerGuest } from '../../services/endpoints/poker';

vi.mock('../../services/endpoints/poker', () => ({
  fetchPokerLeague: vi.fn(),
  removePokerGuest: vi.fn(),
}));

const player = (id: number, name: string, guest: boolean) => ({
  id,
  name,
  guest,
  userId: guest ? null : id,
  avatarUrl: null,
});
const league = (players: ReturnType<typeof player>[]) => ({ id: 7, players });

const renderSection = (isAdmin: boolean) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PokerGuestsSection leagueId={7} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.mocked(fetchPokerLeague).mockResolvedValue(
    league([player(1, 'Marta', false), player(2, 'Pepe', true)]) as never,
  );
});

it('la administración quita a un invitado tras confirmarlo', async () => {
  vi.mocked(removePokerGuest).mockResolvedValue(league([player(1, 'Marta', false)]) as never);
  renderSection(true);
  expect(await screen.findByText('Invitados sin cuenta (1)')).toBeInTheDocument();
  expect(screen.queryByText('Marta')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Pepe' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
  await waitFor(() => expect(removePokerGuest).toHaveBeenCalledWith(7, 2));
  await waitFor(() => expect(screen.queryByText('Pepe')).not.toBeInTheDocument());
});

it('quien no administra ve a los invitados sin poder quitarlos', async () => {
  renderSection(false);
  expect(await screen.findByText('Pepe')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quitar a Pepe' })).not.toBeInTheDocument();
});
