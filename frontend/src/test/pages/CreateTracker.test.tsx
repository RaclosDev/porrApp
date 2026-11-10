import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import CreateTracker from '../../pages/CreateTracker';
import { createTracker } from '../../services/endpoints/trackers';

vi.mock('../../services/endpoints/trackers', async (original) => ({
  ...(await original<typeof import('../../services/endpoints/trackers')>()),
  createTracker: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/marcador/nuevo']}>
        <Routes>
          <Route path="/marcador/nuevo" element={<CreateTracker />} />
          <Route path="/" element={<p>Marcador abierto</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it('pide solo nombre y qué se cuenta, sin jugadores, y abre el marcador creado', async () => {
  vi.mocked(createTracker).mockResolvedValue({ id: 9 } as never);
  renderPage();

  expect(screen.queryByLabelText(/jugador/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Golf' } });
  fireEvent.click(screen.getByRole('button', { name: 'fichas' }));
  expect(screen.getByRole('button', { name: 'fichas' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('checkbox', { name: /Gana quien menos suma/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Crear marcador' }));

  expect(await screen.findByText('Marcador abierto')).toBeInTheDocument();
  expect(createTracker).toHaveBeenCalledWith({ name: 'Golf', unit: 'fichas', lowerWins: true });
});

it('avisa si falta el nombre y enseña el error del servidor', async () => {
  vi.mocked(createTracker).mockRejectedValue(new Error('Sin conexión'));
  renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Crear marcador' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Ponle nombre');
  expect(createTracker).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mus' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear marcador' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión'));
});

it('una plantilla deja el juego preparado: qué se cuenta, quién gana y su nombre', async () => {
  vi.mocked(createTracker).mockResolvedValue({ id: 9 } as never);
  renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Chinchón' }));
  expect(screen.getByLabelText('Nombre')).toHaveValue('Chinchón');
  expect(screen.getByRole('checkbox', { name: /Gana quien menos suma/ })).toBeChecked();
  expect(screen.getByText(/gana quien menos tiene/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Chinchón de la abuela' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear marcador' }));

  await screen.findByText('Marcador abierto');
  expect(createTracker).toHaveBeenCalledWith({
    name: 'Chinchón de la abuela',
    unit: 'puntos',
    lowerWins: true,
    gameName: 'Chinchón',
    mode: 'POINTS',
  });
});
