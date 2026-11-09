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
  fetchMyGroups: vi
    .fn()
    .mockResolvedValue([{ id: 7, name: 'Liga de Ana', createdAt: '2026-01-01' }]),
  fetchGroup: vi.fn().mockResolvedValue({}),
  fetchFeaturedGroup: vi.fn().mockResolvedValue(null),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchMatchRadar: vi.fn().mockResolvedValue({ live: [], last: [], next: [] }),
  fetchPredictions: vi.fn().mockResolvedValue([]),
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
  fetchLeaderboardMatchdays: vi.fn().mockResolvedValue([]),
  fetchTournamentStandings: vi.fn().mockResolvedValue({}),
  fetchTournamentGroupOdds: vi.fn().mockResolvedValue({}),
  fetchTournamentTopScorers: vi.fn().mockResolvedValue([]),
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

  it('sin liga guardada en el dispositivo espera a elegirla antes de pintar la portada', async () => {
    useAppStore.setState({ activeGroupId: '', choosingLeague: true });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppProvider>
          <div />
        </AppProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(useAppStore.getState().choosingLeague).toBe(false));
    expect(useAppStore.getState().activeGroupId).toBe('7');
  });
});
