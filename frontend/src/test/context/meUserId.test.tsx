import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
  fetchMe: vi.fn().mockResolvedValue({
    userId: 42,
    participantName: 'Ana',
    lastSelectedGroupId: null,
    avatarUrl: null,
  }),
  fetchMyGroups: vi.fn().mockResolvedValue([]),
  fetchGroup: vi.fn().mockResolvedValue({}),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchMatchRadar: vi.fn().mockResolvedValue({ live: [], last: [], next: [] }),
  fetchPredictions: vi.fn().mockResolvedValue([]),
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
  fetchLeaderboardMatchdays: vi.fn().mockResolvedValue([]),
  fetchStandings: vi.fn().mockResolvedValue({}),
  fetchTeamOdds: vi.fn().mockResolvedValue({}),
  fetchTopScorers: vi.fn().mockResolvedValue([]),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
  whenSessionRestored: () => null,
}));

describe('usuario de /api/users/me', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ isAuthenticated: true, isDemoMode: false, userName: '', userId: '' });
  });

  it('toma el id del servidor (semilla del avatar de la cabecera) sin depender de localStorage', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppProvider>
          <div />
        </AppProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(useAppStore.getState().userId).toBe('42'));
    expect(useAppStore.getState().userName).toBe('Ana');
  });
});
