import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readKnownGroups, useGroupsDashboard } from '../../hooks/useGroupsDashboard';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../services/apiError';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchMyGroups: vi.fn(),
  fetchCompetitions: vi.fn().mockResolvedValue([]),
  fetchGroup: vi.fn(),
  fetchGroupInvitationPreview: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  uploadGroupImage: vi.fn(),
  deleteGroupImage: vi.fn(),
}));

const context = {
  changeGroup: vi.fn(),
  userName: 'Ana',
  userId: '7',
  activeGroupId: '',
  isAuthenticated: true,
};

describe('useGroupsDashboard', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAppContext).mockReturnValue(
      context as unknown as ReturnType<typeof useAppContext>,
    );
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('muestra el error sin guardar una lista vacía en la caché y permite reintentar', async () => {
    vi.mocked(api.fetchMyGroups).mockRejectedValueOnce(new ApiError(0, NETWORK_ERROR_MESSAGE));
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });

    await waitFor(() => expect(result.current.groupsError).toBe(NETWORK_ERROR_MESSAGE));
    expect(result.current.groups).toEqual([]);
    expect(client.getQueryData(['myGroups', true])).toBeUndefined();

    vi.mocked(api.fetchMyGroups).mockResolvedValueOnce([
      { id: 1, name: 'Liga A' },
      { id: 2, name: 'Liga B' },
    ] as Awaited<ReturnType<typeof api.fetchMyGroups>>);
    act(() => result.current.retryGroups());

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(result.current.groupsError).toBe('');
  });

  it('lee las ligas de la consulta compartida myGroups', async () => {
    client.setQueryData(['myGroups', true], [{ id: 5, name: 'Liga en caché' }]);
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    expect(result.current.groups).toEqual([{ id: 5, name: 'Liga en caché' }]);
    expect(result.current.loading).toBe(false);
  });

  it('trata un knownGroups corrupto como lista vacía', () => {
    localStorage.setItem('knownGroups', '{no es json');
    expect(readKnownGroups()).toEqual([]);
    localStorage.setItem('knownGroups', '[3, "4"]');
    expect(readKnownGroups()).toEqual(['3', '4']);
  });
});
