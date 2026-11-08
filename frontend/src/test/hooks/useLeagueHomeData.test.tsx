import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLeagueHomeData } from '../../hooks/useLeagueHomeData';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import type { CardSegment, Match } from '../../types/api';
import { appContext, matchdayFixture } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../context/leagueData', () => ({
  useWorldCupData: () => ({ groupOdds: {}, groupStandings: {} }),
}));
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
        leagueKind: 'matchday',
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

  it('en la UFC enseña la velada en el orden de la cartelera, con la estelar arriba', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '7',
        activeCompetitionId: 17,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'fightCard',
        activeGroupPicksMatches: true,
        allGames: [],
      }),
    );
    const bout = (matchId: number, segment: CardSegment, order: number, matchDate: string) =>
      matchdayFixture({
        matchId,
        round: 'UFC 334: Gane vs. Hokit',
        matchDate,
        fight: {
          eventId: '600061400',
          eventName: 'UFC 334: Gane vs. Hokit',
          segment,
          order,
          weightClass: null,
          scheduledRounds: 3,
          homeRecord: null,
          awayRecord: null,
          resultMethod: null,
          resultDetail: null,
          resultRound: null,
          resultClock: null,
          winner: null,
        },
      });
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      bout(1, 'PRELIMS', 7, '2099-11-15T01:00:00+01:00'),
      bout(2, 'MAIN', 3, '2099-11-15T03:00:00+01:00'),
      bout(3, 'MAIN', 1, '2099-11-15T03:00:00+01:00'),
      bout(4, 'EARLY_PRELIMS', 10, '2099-11-14T23:00:00+01:00'),
      bout(5, 'MAIN', 2, '2099-11-15T03:00:00+01:00'),
    ]);

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.matches.items).toHaveLength(5));
    expect(result.current.matches.items.map((match) => match.id)).toEqual([3, 5, 2, 1, 4]);
  });

  it('una liga con todos los partidos sigue con la jornada y la tabla de su competición', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '5',
        activeCompetitionId: 2,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
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
        leagueKind: 'matchday',
        allGames: [competitionMatch(91, 'group', '2099-11-08T21:00:00+01:00')],
      }),
    );

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.standings?.rows).toHaveLength(2));
    expect(result.current.standings?.title).toBe('Tabla · Fase suiza');
    expect(result.current.standings?.rows.map((r) => r.value)).toEqual(['3-1', '3-2']);
  });

  it('en el tenis la ronda de la portada lleva el torneo delante', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '5',
        activeCompetitionId: 41,
        activeCompetitionName: 'Masters de París',
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'tennisDraw',
        allGames: [competitionMatch(92, 'final', '2099-11-08T15:00:00+01:00')],
      }),
    );

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    expect(result.current.matches.title).toBe('Masters de París · Final');
  });

  it('en una liga de varios torneos de tenis la ronda ya trae el torneo', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '6',
        activeCompetitionId: 41,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'tennisDraw',
        activeGroupPicksMatches: true,
        activeGroupMultiCompetition: true,
      }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([
      matchdayFixture({
        matchId: 180,
        round: 'Masters de París 2026 · Final',
        matchDate: '2099-11-08T15:00:00+01:00',
        competitionName: 'Masters de París',
      }),
    ]);

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(result.current.matches.items[0]?.id).toBe(180));
    expect(result.current.matches.title).toBe('Masters de París 2026 · Final');
  });

  it('una liga de temporada de tenis enseña sus partidos y no los de su competición principal', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '15',
        activeCompetitionId: 19,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'tennisDraw',
        activeGroupMultiCompetition: true,
        // La final del Open de Australia de enero: es de la competición principal, no de la liga.
        allGames: [competitionMatch(93, 'final', '2099-02-01T09:45:00+01:00')],
      }),
    );
    vi.mocked(api.fetchMatchdayFixtures).mockResolvedValue([]);

    const { result } = renderHook(() => useLeagueHomeData(), { wrapper });

    await waitFor(() => expect(api.fetchMatchdayFixtures).toHaveBeenCalledWith(15));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matches.items).toEqual([]);
    expect(result.current.matches.empty).toMatch(/torneos de la liga/);
  });
});
