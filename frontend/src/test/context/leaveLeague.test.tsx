import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useLeagueDataEffects } from '../../context/leagueData';
import { dropFromMyGroups, pickMostRecentLeague } from '../../context/leagueFallback';
import { ApiError } from '../../services/apiError';
import { queryKeys } from '../../services/queryKeys';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../services/api';
import { group, participantScore } from './fixtures';

vi.mock('../../services/api', () => ({
  getAuthToken: () => null,
  fetchMyGroups: vi.fn(),
  fetchFeaturedGroup: vi.fn(),
  fetchGroup: vi.fn(),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchCustomMatches: vi.fn().mockResolvedValue([]),
  fetchMatchRadar: vi.fn().mockResolvedValue({ live: [], last: [], next: [] }),
  fetchPredictions: vi.fn().mockResolvedValue([]),
  fetchLeaderboard: vi.fn(),
  fetchLeaderboardMatchdays: vi.fn().mockResolvedValue([]),
  fetchTournamentStandings: vi.fn().mockResolvedValue({}),
  fetchTournamentGroupOdds: vi.fn().mockResolvedValue({}),
  fetchTournamentTopScorers: vi.fn().mockResolvedValue([]),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
}));

const laLiga = (id: number, joinedAt: string) =>
  group({
    id,
    competitionId: 2,
    competitionExternalId: 'esp.1',
    poolFormat: 'MATCH_DAY',
    joinedAt,
  });

describe('pickMostRecentLeague', () => {
  const leagues = [
    laLiga(10, '2026-01-01T00:00:00Z'),
    laLiga(20, '2026-03-01T00:00:00Z'),
    laLiga(30, '2026-02-01T00:00:00Z'),
  ];

  it('prefers the league the user opened last on this device', () => {
    expect(pickMostRecentLeague(leagues, { 10: 9, 30: 5, 99: 100 })).toBe('10');
  });

  it('without visits, takes the one the user joined last', () => {
    expect(pickMostRecentLeague(leagues, {})).toBe('20');
  });

  it('returns null without leagues', () => {
    expect(pickMostRecentLeague([], { 10: 9 })).toBeNull();
  });
});

describe('when the active league stops being available', () => {
  let client: QueryClient;
  let serverGroups: ReturnType<typeof laLiga>[];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    serverGroups = [
      laLiga(10, '2026-01-01T00:00:00Z'),
      laLiga(20, '2026-03-01T00:00:00Z'),
      laLiga(30, '2026-02-01T00:00:00Z'),
    ];
    vi.mocked(api.fetchMyGroups).mockImplementation(async () => serverGroups);
    vi.mocked(api.fetchGroup).mockImplementation(async (id) => {
      const found = serverGroups.find((g) => String(g.id) === String(id));
      if (!found) throw new ApiError(404, 'Liga no encontrada');
      return found;
    });
    vi.mocked(api.fetchLeaderboard).mockResolvedValue([participantScore()]);
    useAppStore.setState({
      activeGroupId: '10',
      activeCompetitionId: null,
      isAuthenticated: true,
      isDemoMode: false,
      choosingLeague: false,
      userId: '7',
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
  });

  const mount = () =>
    renderHook(
      () => {
        useLeagueDataEffects();
        return useAppContext();
      },
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

  /** Lo que hace «Salir de la liga» al responder el servidor. */
  const leave = (id: number) => {
    serverGroups = serverGroups.filter((g) => g.id !== id);
    act(() => dropFromMyGroups(client, id));
  };

  it('opens the most recent remaining league without reloading and forgets the old one', async () => {
    localStorage.setItem('group_last_visited', JSON.stringify({ 10: 9, 30: 5 }));
    localStorage.setItem('draft_bracket_u7_g10', '{}');
    localStorage.setItem('draft_matchday_u7_g10', '{}');
    localStorage.setItem('draft_matchday_u7_g30', '{"keep":true}');
    const { result } = mount();
    await waitFor(() => expect(result.current.userGroups).toHaveLength(3));
    await waitFor(() => expect(result.current.leaderboardData).toHaveLength(1));

    leave(10);

    await waitFor(() => expect(result.current.activeGroupId).toBe('30'));
    expect(localStorage.getItem('activeGroupId')).toBe('30');
    expect(localStorage.getItem('draft_bracket_u7_g10')).toBeNull();
    expect(localStorage.getItem('draft_matchday_u7_g10')).toBeNull();
    expect(localStorage.getItem('draft_matchday_u7_g30')).toBe('{"keep":true}');
    expect(JSON.parse(localStorage.getItem('group_last_visited')!)).not.toHaveProperty('10');
    expect(client.getQueryData(queryKeys.leaderboard('10'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.group('10'))).toBeUndefined();
  });

  it('without visits on this device, opens the league joined last', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.userGroups).toHaveLength(3));

    leave(10);

    await waitFor(() => expect(result.current.activeGroupId).toBe('20'));
  });

  it('with no leagues left, shows nothing from any competition (no World Cup fallback)', async () => {
    serverGroups = [laLiga(10, '2026-01-01T00:00:00Z')];
    const { result } = mount();
    await waitFor(() => expect(result.current.userGroups).toHaveLength(1));
    vi.mocked(api.fetchMatches).mockClear();
    vi.mocked(api.fetchMatchRadar).mockClear();

    leave(10);

    await waitFor(() => expect(result.current.activeGroupId).toBe(''));
    expect(result.current.activeGroupName).toBe('Ninguna liga seleccionada');
    expect(result.current.activeGroupPoolFormat).toBeNull();
    expect(result.current.activeCompetitionId).toBeNull();
    expect(result.current.leagueKind).toBe('none');
    expect(result.current.activeGroupPichichi).toBe(false);
    expect(result.current.allGames).toEqual([]);
    expect(result.current.matchRadar).toEqual({ live: [], last: [], next: [] });
    // Ni partidos de todas las competiciones ni datos del Mundial.
    expect(api.fetchMatches).not.toHaveBeenCalled();
    expect(api.fetchMatchRadar).not.toHaveBeenCalled();
    expect(api.fetchTournamentStandings).not.toHaveBeenCalled();
    expect(api.fetchTournamentGroupOdds).not.toHaveBeenCalled();
    expect(api.fetchTournamentTopScorers).not.toHaveBeenCalled();
  });

  it('a league deleted elsewhere (404) is replaced once the server confirms it is gone', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.userGroups).toHaveLength(3));
    serverGroups = serverGroups.filter((g) => g.id !== 10);

    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.group('10') });
    });

    await waitFor(() => expect(result.current.activeGroupId).toBe('20'));
  });

  it('keeps a league chosen moments ago that an older list does not include yet', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.userGroups).toHaveLength(3));
    const fetchesBefore = vi.mocked(api.fetchMyGroups).mock.calls.length;
    serverGroups = [...serverGroups, laLiga(99, '2026-04-01T00:00:00Z')];

    act(() => result.current.changeGroup('99'));

    await waitFor(() => expect(result.current.userGroups).toHaveLength(4));
    expect(vi.mocked(api.fetchMyGroups).mock.calls.length).toBeGreaterThan(fetchesBefore);
    expect(result.current.activeGroupId).toBe('99');
  });
});
