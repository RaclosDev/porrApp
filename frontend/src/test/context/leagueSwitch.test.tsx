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
    api.fetchMyGroups.mockResolvedValue([
      { id: 10, competitionId: 2, poolFormat: 'MATCH_DAY' },
      { id: 20, competitionId: 3, poolFormat: 'MATCH_DAY' },
    ]);
    api.fetchGroup.mockImplementation((id) =>
      id === '10'
        ? Promise.resolve({ id: 10, competitionId: 2, poolFormat: 'MATCH_DAY' })
        : new Promise(() => {}),
    );
    api.fetchMatches.mockImplementation((id) =>
      id === 2 ? Promise.resolve([{ id: 101, home: 'Liga A' }]) : new Promise(() => {}),
    );
    api.fetchPredictions.mockImplementation((id) =>
      id === '10' ? Promise.resolve([{ id: 1 }]) : new Promise(() => {}),
    );
    api.fetchLeaderboard.mockImplementation((id) =>
      id === '10' ? Promise.resolve([{ id: 1 }]) : new Promise(() => {}),
    );
    api.fetchMatchRadar.mockImplementation((id) =>
      id === 2 ? Promise.resolve({ live: [{ id: 101 }] }) : new Promise(() => {}),
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
    expect(result.current.activeGroupBetMode).toBe('MATCH_DAY');
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
    expect(result.current.activeGroupBetMode).toBeNull();
    expect(result.current.activeCompetitionId).toBeNull();
    expect(result.current.allGames).toEqual([]);
    expect(api.fetchMatches).not.toHaveBeenCalledWith(null);
  });

  it('flushes the outgoing bracket draft and resets league-specific selections immediately', () => {
    const bracket = { ...defaultBracketState, champion: { name: 'España' } };
    useAppStore.setState({
      bracketState: bracket,
      viewerPredictionId: 123,
      viewerBetId: 123,
      topScorer: 'Player',
    });
    useAppStore.getState().changeGroup('20');
    expect(JSON.parse(localStorage.getItem('draft_bracket_10')).champion.name).toBe('España');
    expect(useAppStore.getState()).toMatchObject({
      activeCompetitionId: null,
      viewerPredictionId: null,
      viewerBetId: null,
      topScorer: '',
    });
    useAppStore.getState().changeGroup('10');
    expect(useAppStore.getState().bracketState.champion.name).toBe('España');
  });
});
