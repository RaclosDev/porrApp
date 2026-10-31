import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useLeaguePredictions, useMyLeaguePrediction } from '../../hooks/useLeaguePredictions';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  getAuthToken: () => null,
  fetchMyGroups: vi.fn().mockResolvedValue([]),
  fetchGroup: vi.fn().mockResolvedValue({ id: 10, competitionId: 2 }),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchMatchRadar: vi.fn().mockResolvedValue({ live: [], last: [], next: [] }),
  fetchPredictions: vi.fn().mockResolvedValue([{ key: '1', participantName: 'Ana' }]),
  fetchMyPredictions: vi.fn().mockResolvedValue([
    { key: '7', groupId: 20 },
    { key: '8', groupId: 10 },
  ]),
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
  fetchStandings: vi.fn().mockResolvedValue({}),
  fetchTeamOdds: vi.fn().mockResolvedValue({}),
  fetchTopScorers: vi.fn().mockResolvedValue([]),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
}));

describe('pronósticos de la liga', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({ activeGroupId: '10', isAuthenticated: true, userId: '7' });
  });

  it('useAppContext no descarga los pronósticos de toda la liga', async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(api.fetchLeaderboard).toHaveBeenCalled());

    expect(api.fetchPredictions).not.toHaveBeenCalled();
    expect(result.current.participantsHashes).toEqual([]);
  });

  it('las pantallas que los usan los piden y useAppContext los lee de la caché', async () => {
    const { result } = renderHook(
      () => ({ screen: useLeaguePredictions(), context: useAppContext() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.context.participantsHashes).toHaveLength(1));
    expect(result.current.screen).toHaveLength(1);
    expect(api.fetchPredictions).toHaveBeenCalledTimes(1);
  });

  it('el pronóstico propio de la liga activa sale de /predictions/mine', async () => {
    const { result } = renderHook(() => useMyLeaguePrediction(), { wrapper });

    await waitFor(() => expect(result.current?.key).toBe('8'));
    expect(api.fetchPredictions).not.toHaveBeenCalled();
  });

  it('sin sesión no pide los pronósticos propios', () => {
    useAppStore.setState({ isAuthenticated: false });
    const { result } = renderHook(() => useMyLeaguePrediction(), { wrapper });

    expect(result.current).toBeUndefined();
    expect(api.fetchMyPredictions).not.toHaveBeenCalled();
  });
});
