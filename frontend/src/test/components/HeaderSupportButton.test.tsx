import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import HeaderSupportButton from '../../components/layout/HeaderSupportButton';
import { fetchPokerHistory } from '../../services/endpoints/poker';

const context = vi.hoisted(() => ({
  value: { leagueKind: 'standard', activeGroupId: '7' } as Record<string, unknown>,
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context.value }));
vi.mock('../../services/endpoints/poker', () => ({ fetchPokerHistory: vi.fn() }));

const renderButton = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HeaderSupportButton />
    </QueryClientProvider>,
  );

beforeEach(() => vi.mocked(fetchPokerHistory).mockReset());

it('fuera del póker, la caña abre el diálogo de apoyo sin pedir el histórico', () => {
  context.value = { leagueKind: 'standard', activeGroupId: '7' };
  renderButton();

  fireEvent.click(screen.getByRole('button', { name: 'Invítanos a una caña' }));

  expect(screen.getByRole('dialog', { name: 'Invítanos a una caña' })).toBeInTheDocument();
  expect(fetchPokerHistory).not.toHaveBeenCalled();
});

it('en el póker, la cara del crupier abre la propina con lo que sobró del último torneo', async () => {
  context.value = { leagueKind: 'poker', activeGroupId: '9' };
  vi.mocked(fetchPokerHistory).mockResolvedValue([
    { leftoverCents: 350 },
    { leftoverCents: 100 },
  ] as never);
  renderButton();

  expect(fetchPokerHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Propina para el crupier' }));

  expect(screen.getByRole('dialog', { name: '¿Propina para el crupier?' })).toBeInTheDocument();
  expect(fetchPokerHistory).toHaveBeenCalledWith('9');
  expect(await screen.findByText(/3,50/)).toBeInTheDocument();
});
