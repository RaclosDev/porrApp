import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLeagueHomeData } from '../../hooks/useLeagueHomeData';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import type { Match } from '../../types/api';
import { appContext, matchdayFixture } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchCompetitionStandings: vi.fn(),
  fetchCustomStandings: vi.fn(),
  fetchCustomTeams: vi.fn(),
  fetchMatchdayFixtures: vi.fn(),
}));

const competitionMatch = (id: number, round: string, date: string): Match => ({
  id,
  home: `Local ${id}`,
  away: `Visitante ${id}`,
  home_team_id: null,
  away_team_id: null,
  homeLogo: null,
  awayLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
  home_score: null,
  away_score: null,
  date,
  finished: false,
  round,
  groupName: null,
  winner: null,
  displayClock: null,
  isStartingSoon: false,
  status: 'SCHEDULED',
});

const STANDINGS = [{ teamName: 'Barcelona', rank: 1, teamLogo: null, gamesPlayed: 11, points: 30 }];

describe('useLeagueHomeData', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.fetchCompetitionStandings).mockResolvedValue(STANDINGS as never);
  });

  it('una liga de varias competiciones enseña su semana y no la tabla de una competición', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '5',
        activeCompetitionId: 2,
        activeGroupPoolFormat: 'MATCH_DAY',
        activeGroupPicksMatches: true,
        activeGroupMultiCompetition: true,
        allGames: [competitionMatch(90, 'Jornada 16', '2099-11-08T21:00:00+01:00')],
      }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      matchdayFixture({
        matchId: 1,
        round: 'Semana 2099-11-09',
        matchDate: '2099-11-10T21:00:00+01:00',
        competitionName: 'UEFA Champions League',
      }),
      matchdayFixture({
        matchId: 2,
        round: 'Semana 2099-11-16',
        matchDate: '2099-11-21T21:00:00+01:00',
      }),
    ]);

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.matches.items[0]?.id).toBe(1));
    expect(result.current.matches.items).toHaveLength(1);
    expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith(5);
    expect(result.current.matches.title).toBe('Semana del 9 nov');
    expect(result.current.matches.items[0].id).toBe(1);
    expect(result.current.matches.allTo).toBe('/jornadas');
    expect(result.current.standings).toBeNull();
    expect(api.fetchCompetitionStandings).not.toHaveBeenCalled();
  });

  it('una liga con todos los partidos sigue con la jornada y la tabla de su competición', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '5',
        activeCompetitionId: 2,
        activeGroupPoolFormat: 'MATCH_DAY',
        allGames: [competitionMatch(90, 'Jornada 16', '2099-11-08T21:00:00+01:00')],
      }),
    );

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.standings?.rows).toHaveLength(1));
    expect(result.current.matches.title).toBe('Jornada 16');
    expect(result.current.matches.allTo).toBe('/radar');
    expect(api.fetchMatchdayFixtures).not.toHaveBeenCalled();
  });

  it('con varias tablas la portada enseña una: el primer grupo o la última fase del LoL', async () => {
    const row = { teamLogo: null, gamesPlayed: 4, points: 3, wins: 3, losses: 1, ties: 0 };
    vi.mocked(api.fetchCompetitionStandings).mockResolvedValue([
      { ...row, group: 'Play-in', teamName: 'Karmine Corp', rank: 1 },
      { ...row, group: 'Fase suiza', teamName: 'Gen.G', rank: 1 },
      { ...row, group: 'Fase suiza', teamName: 'T1', rank: 2, wins: 3, losses: 2 },
    ] as never);
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '5',
        activeCompetitionId: 3,
        activeCompetitionExternalId: 'lol.worlds',
        activeGroupPoolFormat: 'MATCH_DAY',
        allGames: [competitionMatch(91, 'group', '2099-11-08T21:00:00+01:00')],
      }),
    );

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.standings?.rows).toHaveLength(2));
    expect(result.current.standings?.title).toBe('Tabla · Fase suiza');
    expect(result.current.standings?.rows.map((r) => r.value)).toEqual(['3-1', '3-2']);
  });
});
