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
          <Route path="/marcador/:id" element={<p>Marcador abierto</p>} />
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
