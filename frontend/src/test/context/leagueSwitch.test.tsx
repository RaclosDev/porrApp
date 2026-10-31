import { group, participantScore, predictionSummary } from './fixtures';
import { game } from '../fixtures';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useAppStore, defaultBracketState } from '../../store/useAppStore';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getAuthToken: () => null,
  fetchMyGroups: vi.fn(),
  fetchGroup: vi.fn(),
  fetchMatches: vi.fn(),
  fetchMatchRadar: vi.fn(),
  fetchPredictions: vi.fn(),
  fetchLeaderboard: vi.fn(),
  fetchStandings: vi.fn().mockResolvedValue({}),
  fetchTeamOdds: vi.fn().mockResolvedValue({}),
  fetchTopScorers: vi.fn().mockResolvedValue([]),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
}));

describe('league switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({
      activeGroupId: '10',
      activeCompetitionId: 2,
      isAuthenticated: true,
      userId: '7',
    });
    vi.mocked(api.fetchMyGroups).mockResolvedValue([
      group({ id: 10, competitionId: 2, poolFormat: 'MATCH_DAY' }),
      group({ id: 20, competitionId: 3, poolFormat: 'MATCH_DAY' }),
    ]);
    vi.mocked(api.fetchGroup).mockImplementation((id) =>
      id === '10'
        ? Promise.resolve(group({ id: 10, competitionId: 2, poolFormat: 'MATCH_DAY' }))
        : new Promise(() => {}),
    );
    vi.mocked(api.fetchMatches).mockImplementation((id) =>
      id === 2 ? Promise.resolve([game({ id: 101, home: 'Liga A' })]) : new Promise(() => {}),
    );
    vi.mocked(api.fetchPredictions).mockImplementation((id) =>
      id === '10' ? Promise.resolve([predictionSummary()]) : new Promise(() => {}),
    );
    vi.mocked(api.fetchLeaderboard).mockImplementation((id) =>
      id === '10' ? Promise.resolve([participantScore()]) : new Promise(() => {}),
    );
    vi.mocked(api.fetchMatchRadar).mockImplementation((id) =>
      id === 2
        ? Promise.resolve({ live: [game({ id: 101 })], last: [], next: [] })
        : new Promise(() => {}),
    );
  });

  const mount = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    return renderHook(() => useAppContext(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
  };

  it('never shows the previous competition, predictions or leaderboard while the next loads', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.allGames).toHaveLength(1));
    act(() => result.current.changeGroup('20'));
    expect(result.current.activeCompetitionId).toBe(3);
    expect(result.current.activeGroupPoolFormat).toBe('MATCH_DAY');
    expect(result.current.allGames).toEqual([]);
    expect(result.current.participantsHashes).toEqual([]);
    expect(result.current.leaderboardData).toEqual([]);
    expect(result.current.matchRadar.live).toEqual([]);
  });

  it('waits for unknown league metadata instead of assuming a bracket or the previous competition', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.allGames).toHaveLength(1));
    act(() => result.current.changeGroup('99'));
    expect(result.current.loadingGroup).toBe(true);
    expect(result.current.activeGroupPoolFormat).toBeNull();
    expect(result.current.activeCompetitionId).toBeNull();
    expect(result.current.allGames).toEqual([]);
    expect(api.fetchMatches).not.toHaveBeenCalledWith(null);
  });

  it('fetchData only invalidates the active league queries', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await act(() => result.current.fetchData());
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).not.toContain(undefined);
    expect(keys).toContainEqual(['predictions', '10']);
    expect(keys).toContainEqual(['leaderboard', '10']);
    expect(
      keys.some((k) => ['standings', 'matches', 'odds', 'topScorers'].includes(String(k?.[0]))),
    ).toBe(false);
  });

  it('flushes the outgoing bracket draft and resets league-specific selections immediately', () => {
    const bracket = { ...defaultBracketState, champion: { name: 'España' } };
    useAppStore.setState({
      bracketState: bracket,
      viewerPredictionId: 123,
      topScorer: 'Player',
    });
    useAppStore.getState().changeGroup('20');
    expect(JSON.parse(localStorage.getItem('draft_bracket_u7_g10') ?? '{}').champion.name).toBe(
      'España',
    );
    expect(useAppStore.getState()).toMatchObject({
      activeCompetitionId: null,
      viewerPredictionId: null,
      topScorer: '',
    });
    useAppStore.getState().changeGroup('10');
    expect(useAppStore.getState().bracketState.champion?.name).toBe('España');
  });
});
