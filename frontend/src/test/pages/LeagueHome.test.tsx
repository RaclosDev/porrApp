import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '../../pages/Home';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import { appContext } from '../context/fixtures';
type AppContextValue = ReturnType<typeof appContextModule.useAppContext>;
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');

let id = 1;
const match = (fields: Partial<Match>) =>
  ({
    id: id++,
    home: 'Local',
    away: 'Visitante',
    home_team_id: 1,
    away_team_id: 2,
    finished: false,
    status: 'SCHEDULED',
    round: 'group',
    groupName: null,
    home_score: null,
    away_score: null,
    date: '2030-06-01T18:00:00Z',
    ...fields,
  }) as Match;

const players = ['Ana', 'Bea', 'Carla', 'Dani', 'Eva', 'Fran'].map((name, index) => ({
  id: index + 1,
  userId: index + 1,
  name,
  total: 60 - index * 10,
}));

const renderHome = (fields: Partial<AppContextValue>) => {
  vi.mocked(appContextModule.useAppContext).mockReturnValue(
    appContext({
      activeGroupId: '10',
      activeGroupName: 'Liga de amigos',
      leaderboardData: players as AppContextValue['leaderboardData'],
      ...fields,
    }),
  );
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('league home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    id = 1;
  });

  it('keeps every panel as a skeleton until the ranking and the matches arrive', () => {
    renderHome({
      leagueKind: 'matchday',
      activeGroupPoolFormat: 'MATCH_DAY',
      loadingLeaderboard: true,
    });

    // La cabecera de la liga ya se sabe; los paneles aparecen todos a la vez, no uno a uno.
    expect(screen.getByRole('heading', { name: 'Liga de amigos' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando la liga' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Top del ranking' })).not.toBeInTheDocument();
    expect(screen.queryByText('Aún no hay puntuaciones en esta liga.')).not.toBeInTheDocument();
  });

  it('shows the top five of the ranking with plain positions, without medals', () => {
    renderHome({ leagueKind: 'matchday', activeGroupPoolFormat: 'MATCH_DAY' });
    const ranking = screen.getByRole('list', { name: 'Top del ranking' });
    const rows = within(ranking).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    rows.forEach((row, index) => expect(row).toHaveTextContent(new RegExp(`^${index + 1}`)));
    expect(ranking).not.toHaveTextContent(/🥇|🥈|🥉|º/);
  });

  it('gives tied participants the same position, also before they have a prediction', () => {
    renderHome({
      leagueKind: 'matchday',
      activeGroupPoolFormat: 'MATCH_DAY',
      leaderboardData: [
        { id: 1, userId: 7, name: 'Ana', total: 0 },
        { id: null, userId: 8, name: 'Bea', total: 0 },
        { id: null, userId: 9, name: 'Carla', total: 0 },
      ] as AppContextValue['leaderboardData'],
    });
    const rows = within(screen.getByRole('list', { name: 'Top del ranking' })).getAllByRole(
      'listitem',
    );
    rows.forEach((row) => expect(row).toHaveTextContent(/^1/));
  });

  it('gives a bracket league the same home, with upcoming matches instead of the bracket', () => {
    renderHome({
      leagueKind: 'groupStage',
      activeCompetitionExternalId: 'fifa.world',
      allGames: [
        match({
          home: 'España',
          away: 'Japón',
          groupName: 'A',
          finished: true,
          home_score: 2,
          away_score: 0,
        }),
        match({ home: 'Brasil', away: 'Chile', groupName: 'B', date: '2030-06-03T18:00:00Z' }),
        match({
          home: 'Francia',
          away: 'Perú',
          groupName: 'C',
          status: 'LIVE',
          date: '2030-06-04T18:00:00Z',
        }),
      ],
    });
    expect(screen.getByRole('heading', { name: 'Liga de amigos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Próximos partidos' })).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: /ver resultados$/ });
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Francia contra Perú, ver resultados',
      'Brasil contra Chile, ver resultados',
    ]);
    expect(screen.getByRole('list', { name: 'Top del ranking' })).toBeInTheDocument();
  });

  it('shows the swiss stage as the team table of an official tournament', () => {
    renderHome({
      leagueKind: 'ownBracket',
      activeCompetitionExternalId: 'lol.worlds',
      allGames: [
        match({
          home: 'T1',
          away: 'G2',
          finished: true,
          homeScore: 2,
          awayScore: 0,
          round: 'group',
        }),
        match({ home: 'KC', away: 'FNC', round: 'qf', date: '2030-06-05T18:00:00Z' }),
      ],
    });
    const table = screen.getByRole('list', { name: 'Fase suiza' });
    expect(within(table).getAllByRole('listitem')[0]).toHaveTextContent('1T11-0');
  });

  it('keeps the league table for matchday leagues', async () => {
    vi.mocked(api.fetchCompetitionStandings).mockResolvedValue([
      { rank: 1, teamName: 'Betis', teamLogo: null, gamesPlayed: 3, points: 9 },
      { rank: 2, teamName: 'Sevilla', teamLogo: null, gamesPlayed: 3, points: 6 },
    ] as Awaited<ReturnType<typeof api.fetchCompetitionStandings>>);
    renderHome({
      leagueKind: 'matchday',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeCompetitionId: 5,
    });
    const table = await screen.findByRole('list', { name: 'Tabla' });
    expect(within(table).getAllByRole('listitem')[1]).toHaveTextContent('2Sevilla3 PJ6 pts');
  });
});
