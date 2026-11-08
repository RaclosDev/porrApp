import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LeagueStandings from '../../pages/LeagueStandings';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitionStandings } from '../../services/api';
import { appContext } from '../context/fixtures';
import type { LeagueStanding } from '../../types/api';
vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({ fetchCompetitionStandings: vi.fn() }));
const row: LeagueStanding = {
  rank: 1,
  teamName: 'Equipo sin escudo',
  teamLogo: null,
  points: 5,
  gamesPlayed: 3,
  wins: 1,
  ties: 2,
  losses: 0,
  goalDiff: 1,
  goalsFor: 3,
  goalsAgainst: 2,
};
const setup = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LeagueStandings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
beforeEach(() => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeCompetitionId: 4,
      activeCompetitionName: 'Champions League',
      activeGroupPoolFormat: 'MATCH_DAY',
      leagueKind: 'matchday',
    }),
  );
  vi.clearAllMocks();
});
it('keeps team names in the complete table and does not invent competition zones', async () => {
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([
    row,
    { ...row, rank: 18, teamName: 'Escudo roto', teamLogo: '/broken.png' },
  ]);
  const { container } = setup();
  await screen.findByText(row.teamName);
  fireEvent.click(screen.getByRole('button', { name: 'Completa' }));
  fireEvent.error(container.querySelector('img')!);
  expect(screen.getByText(row.teamName)).toBeVisible();
  expect(screen.getByText('Escudo roto')).toBeVisible();
  expect(container.querySelector('.is-relegation, .is-champions, .is-europa')).toBeNull();
  expect(screen.queryByText('Descenso')).not.toBeInTheDocument();
});
it('shows a recoverable error instead of explaining an empty season', async () => {
  vi.mocked(fetchCompetitionStandings)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([row]);
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
  expect(screen.queryByText(/Los datos se sincronizarán/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(row.teamName)).toBeVisible();
});
it('shows the empty-season message only for an empty response', async () => {
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([]);
  setup();
  expect(
    await screen.findByText(/La tabla aparecerá cuando haya partidos con resultado/),
  ).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('shows every group of a group-stage competition under its own title', async () => {
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([
    { ...row, group: 'Grupo A', teamName: 'Estudiantes' },
    { ...row, group: 'Grupo A', rank: 2, teamName: 'Flamengo' },
    { ...row, group: 'Grupo B', teamName: 'River Plate' },
    { ...row, group: 'Grupo B', rank: 2, teamName: 'Universitario' },
  ]);
  setup();
  expect(await screen.findByRole('heading', { name: 'Grupo A' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Grupo B' })).toBeVisible();
  const tables = screen.getAllByRole('table');
  expect(tables).toHaveLength(2);
  expect(tables[1]).toHaveTextContent('River Plate');
  expect(tables[1]).not.toHaveTextContent('Flamengo');
});
it('shows the LoL phases with their win-loss record and points to Jornadas for the knockouts', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeCompetitionId: 5,
      activeCompetitionName: 'Worlds',
      activeCompetitionExternalId: 'lol.worlds',
      activeGroupPoolFormat: 'MATCH_DAY',
      leagueKind: 'matchday',
    }),
  );
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([
    { ...row, group: 'Play-in', teamName: 'Karmine Corp', points: 2, wins: 2, losses: 0, ties: 0 },
    { ...row, group: 'Fase suiza', teamName: 'Gen.G', points: 3, wins: 3, losses: 1, ties: 0 },
  ]);
  setup();
  expect(await screen.findByRole('heading', { name: 'Fase suiza' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Play-in' })).toBeVisible();
  expect(screen.getByText('3-1')).toBeVisible();
  expect(screen.getAllByRole('columnheader', { name: 'V-D' })).toHaveLength(2);
  expect(screen.queryByRole('columnheader', { name: 'PTS' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Completa' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Jornadas' })).toHaveAttribute('href', '/jornadas');
});
it('shows the NFL by division with records and playoff seeds, and by conference with the playoff line', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      activeCompetitionId: 14,
      activeCompetitionName: 'NFL',
      activeCompetitionExternalId: 'nfl',
      activeGroupPoolFormat: 'MATCH_DAY',
      leagueKind: 'matchday',
    }),
  );
  const team = (
    name: string,
    group: string,
    rank: number,
    seed: number,
    wins: number,
    losses: number,
    ties = 0,
  ) => ({
    ...row,
    group,
    rank,
    teamName: name,
    teamShortName: name.split(' ').pop(),
    playoffSeed: seed,
    points: wins,
    wins,
    losses,
    ties,
    gamesPlayed: wins + losses + ties,
  });
  vi.mocked(fetchCompetitionStandings).mockResolvedValue([
    team('Buffalo Bills', 'AFC Este', 1, 1, 6, 1),
    team('New York Jets', 'AFC Este', 2, 12, 2, 6),
    ...Array.from({ length: 7 }, (_, i) => team(`AFC Team${i}`, 'AFC Oeste', i + 1, i + 2, 5, 3)),
    team('New York Giants', 'NFC Este', 1, 3, 4, 2, 1),
  ]);
  const { container } = setup();
  expect(await screen.findByRole('heading', { name: 'AFC Este' })).toBeVisible();
  expect(screen.getByText('4-2-1')).toBeVisible();
  expect(screen.getByText('.643')).toBeVisible();
  expect(screen.getByLabelText('Puesto 1 para los playoffs')).toBeVisible();
  // Fuera de los playoffs no lleva número.
  expect(screen.queryByLabelText('Puesto 12 para los playoffs')).not.toBeInTheDocument();
  expect(screen.getByText('Bills')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Conferencias' }));
  expect(screen.getByRole('heading', { name: 'AFC' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'NFC' })).toBeVisible();
  expect(container.querySelectorAll('.is-playoff-cutline')).toHaveLength(1);
  expect(screen.getByText(/entran los 7 primeros/)).toBeVisible();
});
