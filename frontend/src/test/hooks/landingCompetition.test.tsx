import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLandingData } from '../../hooks/useLandingData';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
  fetchPredictions: vi.fn().mockResolvedValue([]),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchCompetitions: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(useLandingData, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
};

it('resolves LaLiga by external ID instead of a database sequence', async () => {
  vi.mocked(api.fetchCompetitions).mockResolvedValue([
    { id: 4, name: 'Premier', externalId: 'eng.1', formatType: 'LEAGUE' },
    { id: 77, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE' },
  ]);
  mount();
  await waitFor(() => expect(api.fetchMatches).toHaveBeenCalledWith(77));
  expect(api.fetchMatches).not.toHaveBeenCalledWith(4);
});

it('waits for the catalogue and does not request every competition when LaLiga is absent', async () => {
  vi.mocked(api.fetchCompetitions).mockResolvedValue([]);
  const view = mount();
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(api.fetchMatches).not.toHaveBeenCalled();
});

it('demo waits for global league metadata rather than assuming competition 2', () => {
  useAppStore.setState({ activeCompetitionId: 99 });
  useAppStore.getState().enterDemoMode();
  expect(useAppStore.getState().activeGroupId).toBe('1');
  expect(useAppStore.getState().activeCompetitionId).toBeNull();
  expect(localStorage.getItem('activeCompetitionId')).toBeNull();
  useAppStore.setState({ isDemoMode: false });
});
