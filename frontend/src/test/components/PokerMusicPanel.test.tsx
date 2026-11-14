import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import PokerMusicPanel from '../../components/poker/PokerMusicPanel';
import { request } from '../../services/http';

vi.mock('../../services/http', () => ({ request: vi.fn() }));
const api = vi.mocked(request);

const track = { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', channel: 'Queen Official' };
const queued = { id: 7, ...track, addedBy: 'Ana', removable: true };

function mount() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PokerMusicPanel leagueId={8} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.mockReset();
});

it('busca por nombre y añade la canción a la cola', async () => {
  let items: (typeof queued)[] = [];
  api.mockImplementation((url: string, options?: { method?: string }) => {
    if (url.startsWith('/poker/8/music/search'))
      return Promise.resolve({ available: true, results: [track] });
    if (options?.method === 'POST') {
      items = [queued];
    }
    return Promise.resolve({ organizer: false, searchAvailable: true, items });
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir canción' }));
  fireEvent.change(await screen.findByPlaceholderText(/enlace de YouTube/), {
    target: { value: 'queen' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir' }));
  expect(await screen.findByRole('button', { name: 'En la cola' })).toBeDisabled();
  expect(screen.getByText('Sonando · Ana')).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    '/poker/8/music',
    expect.objectContaining({ method: 'POST', json: track }),
  );
});

it('avisa cuando la búsqueda no está disponible', async () => {
  api.mockResolvedValue({ organizer: false, searchAvailable: false, items: [] });
  mount();
  expect(await screen.findByText(/no está disponible/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Añadir canción' })).toBeNull();
});

it('pliega la cola: solo se ve lo que suena hasta desplegarla', async () => {
  const second = { ...queued, id: 8, title: 'Despacito', videoId: 'kJQP7kiw5Fk' };
  api.mockResolvedValue({ organizer: false, searchAvailable: true, items: [queued, second] });
  mount();
  expect(await screen.findByText('Sonando · Ana')).toBeVisible();
  expect(screen.queryByText('Despacito')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver la cola (1 más)' }));
  expect(screen.getByText('Despacito')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Quitar Despacito' })).toBeVisible();
});
