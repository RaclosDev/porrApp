import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import FormulaOneStandings from '../../components/grandPrix/FormulaOneStandings';
import type { FormulaOneStandings as Standings } from '../../types/api';

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ activeGroupId: 7, isAuthenticated: true }),
}));

const standings: Standings = {
  season: '2026',
  drivers: [
    {
      rank: 1,
      name: 'Kimi Antonelli',
      shortName: 'K. Antonelli',
      abbreviation: 'ANT',
      country: 'Italia',
      flagUrl: null,
      team: 'Mercedes',
      teamColor: '00D2BE',
      points: 380,
    },
    {
      rank: 2,
      name: 'Max Verstappen',
      shortName: 'M. Verstappen',
      abbreviation: 'VER',
      country: 'Países Bajos',
      flagUrl: null,
      team: null,
      teamColor: null,
      points: 261,
    },
  ],
  constructors: [
    { rank: 1, name: 'Mercedes', color: '00D2BE', points: 630 },
    { rank: 2, name: 'Ferrari', color: 'DC0000', points: 504 },
  ],
};

const fetchStandings = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', () => ({ fetchFormulaOneStandings: fetchStandings }));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FormulaOneStandings />
    </QueryClientProvider>,
  );

describe('Mundial de Fórmula 1', () => {
  it('enseña los pilotos con su escudería y la diferencia con el líder', async () => {
    fetchStandings.mockResolvedValue(standings);
    renderPage();

    const table = await screen.findByRole('table', { name: 'Mundial de pilotos' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Kimi Antonelli');
    expect(rows[1]).toHaveTextContent('Mercedes');
    expect(rows[1]).toHaveTextContent('380');
    expect(rows[2]).toHaveTextContent('-119');
    expect(fetchStandings).toHaveBeenCalledWith(7);
  });

  it('cambia al Mundial de constructores', async () => {
    fetchStandings.mockResolvedValue(standings);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Constructores' }));
    const table = screen.getByRole('table', { name: 'Mundial de constructores' });
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('Ferrari');
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('-126');
  });

  it('avisa si la temporada aún no tiene puntos', async () => {
    fetchStandings.mockResolvedValue({ season: '2027', drivers: [], constructors: [] });
    renderPage();
    expect(await screen.findByText(/empieza con la primera carrera/)).toBeInTheDocument();
  });

  it('deja reintentar si ESPN falla', async () => {
    fetchStandings.mockRejectedValue(new Error('503'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el Mundial');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
