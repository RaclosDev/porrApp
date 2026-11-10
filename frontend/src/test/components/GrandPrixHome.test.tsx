import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import GrandPrixHome from '../../components/grandPrix/GrandPrixHome';
import type { GrandPrix, GrandPrixBoard, RaceDriver } from '../../types/api';

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    activeGroupId: 7,
    activeGroupName: 'Porra del paddock',
    activeCompetitionName: 'Fórmula 1',
    isAuthenticated: true,
    userId: 1,
    userName: 'Ana',
    leaderboardData: [
      { id: 1, userId: 1, name: 'Ana', total: 42 },
      { id: 2, userId: 2, name: 'Luis', total: 30 },
    ],
  }),
}));

const api = vi.hoisted(() => ({
  fetchGrandPrixBoard: vi.fn(),
  fetchFormulaOneStandings: vi.fn(),
  fetchRaceClassification: vi.fn(),
}));
vi.mock('../../services/api', () => api);

const driver = (id: number, name: string): RaceDriver => ({
  id,
  name,
  shortName: name.replace(/^(\w)\w* /, '$1. '),
  country: null,
  flagUrl: null,
  team: 'Mercedes',
  teamColor: '00D2BE',
  number: null,
  headshotUrl: `https://a.espncdn.com/i/headshots/rpm/players/full/${id}.png`,
});

const gp = (id: number, overrides: Partial<GrandPrix>): GrandPrix => ({
  id,
  name: `GP ${id}`,
  circuit: null,
  city: null,
  country: null,
  sprint: false,
  lockAt: '2026-11-21T18:00:00Z',
  raceAt: '2026-11-22T17:00:00Z',
  status: 'SCHEDULED',
  locked: false,
  gridIds: [1, 2, 3],
  result: null,
  pick: null,
  points: null,
  details: null,
  ...overrides,
});

const podium = { first: 1, second: 2, third: 3, pole: 1, fastestLap: null };

const board: GrandPrixBoard = {
  grandsPrix: [
    gp(1, {
      name: 'GP de Bahréin',
      status: 'FINISHED',
      locked: true,
      raceAt: '2026-03-01T15:00:00Z',
      result: podium,
      points: 12,
    }),
    gp(2, {
      name: 'GP de Arabia Saudí',
      status: 'FINISHED',
      locked: true,
      raceAt: '2026-03-08T15:00:00Z',
      result: podium,
    }),
    gp(3, { name: 'GP de Las Vegas', pick: podium }),
    gp(4, { name: 'GP de Catar', raceAt: '2026-11-29T15:00:00Z' }),
    gp(5, { name: 'GP de Abu Dabi', raceAt: '2026-12-06T13:00:00Z' }),
  ],
  drivers: [driver(1, 'Kimi Antonelli'), driver(2, 'George Russell'), driver(3, 'Lando Norris')],
  rules: { exactPosition: 5, podium: 2, pole: 3, fastestLap: 2 },
};

const renderHome = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<GrandPrixHome />} />
          <Route path="/jornadas" element={<p>Predicciones de carreras</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Inicio de una liga de carreras', () => {
  it('enseña solo las dos próximas carreras y luego las disputadas, de la última a la primera', async () => {
    api.fetchGrandPrixBoard.mockResolvedValue(board);
    api.fetchFormulaOneStandings.mockResolvedValue({
      season: '2026',
      drivers: [],
      constructors: [],
    });
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Porra del paddock' })).toBeInTheDocument();
    expect(screen.getByText('GP de Las Vegas')).toBeInTheDocument();
    expect(screen.getByText('GP de Catar')).toBeInTheDocument();
    expect(screen.queryByText('GP de Abu Dabi')).not.toBeInTheDocument();

    const done = screen.getAllByRole('listitem').filter((item) => item.closest('.gp-done-list'));
    expect(done.map((item) => within(item).getByRole('button').textContent)).toEqual([
      expect.stringContaining('GP de Arabia Saudí'),
      expect.stringContaining('GP de Bahréin'),
    ]);
    expect(within(done[1]).getByText('+12')).toBeInTheDocument();
    expect(within(done[1]).getByText('K. Antonelli')).toBeInTheDocument();
  });

  it('avisa de la predicción que falta y lleva a la pestaña de predicciones', async () => {
    api.fetchGrandPrixBoard.mockResolvedValue(board);
    api.fetchFormulaOneStandings.mockResolvedValue({
      season: '2026',
      drivers: [],
      constructors: [],
    });
    renderHome();

    fireEvent.click(
      await screen.findByRole('button', { name: /Te falta la predicción del GP de Catar/ }),
    );
    expect(screen.getByText('Predicciones de carreras')).toBeInTheDocument();
  });

  it('pone el ranking de la liga y el Mundial con la cara de cada piloto', async () => {
    api.fetchGrandPrixBoard.mockResolvedValue(board);
    api.fetchFormulaOneStandings.mockResolvedValue({
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
          headshotUrl: 'https://a.espncdn.com/i/headshots/rpm/players/full/5829.png',
        },
      ],
      constructors: [],
    });
    const { container } = renderHome();

    const world = await screen.findByRole('list', { name: 'Mundial de pilotos' });
    expect(within(world).getByText('380 pts')).toBeInTheDocument();
    expect(world.querySelector('img.gp-face')).toHaveAttribute(
      'src',
      expect.stringContaining('5829.png'),
    );
    expect(
      within(screen.getByRole('list', { name: 'Top del ranking' })).getByText(/Ana/),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.gp-next')).toHaveLength(2);
  });
});
