import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readKnownGroups, useGroupsDashboard } from '../../hooks/useGroupsDashboard';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import { appContext, group } from '../context/fixtures';
import { useAppStore } from '../../store/useAppStore';
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

  it('refresca una sola vez la lista de ligas al unirse', async () => {
    const joined = group({ id: 5, name: 'Nueva liga' });
    vi.mocked(api.fetchMyGroups).mockResolvedValue([]);
    vi.mocked(api.joinGroup).mockResolvedValue(joined);
    vi.mocked(api.fetchGroup).mockResolvedValue(joined);
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(api.fetchMyGroups).mockClear();
    act(() => result.current.setJoinCode('NUEVA'));
    await act(async () => {
      await result.current.handleJoin();
    });
    expect(api.fetchMyGroups).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['group', '5'])).toEqual(joined);
    expect(context.changeGroup).toHaveBeenCalledWith('5');
  });

  it('trata un knownGroups corrupto como lista vacía', () => {
    localStorage.setItem('knownGroups', '{no es json');
    expect(readKnownGroups()).toEqual([]);
    localStorage.setItem('knownGroups', '[3, "4"]');
    expect(readKnownGroups()).toEqual(['3', '4']);
  });
  it.each(['leave', 'delete'] as const)(
    'a late %s does not clear a newer league selection',
    async (operation) => {
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      vi.mocked(api.leaveGroup).mockReturnValue(pending.then(() => ({ status: 'success' })));
      vi.mocked(api.deleteGroup).mockReturnValue(pending.then(() => ({ status: 'success' })));
      vi.mocked(api.fetchMyGroups).mockResolvedValue([group({ id: 1 }), group({ id: 2 })]);
      const changeGroup = vi.fn();
      vi.mocked(useAppContext).mockReturnValue(
        appContext({ isAuthenticated: true, userName: 'Ana', activeGroupId: '1', changeGroup }),
      );
      useAppStore.setState({ activeGroupId: '1' });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
      let action!: Promise<unknown>;
      act(() => {
        action =
          operation === 'leave'
            ? result.current.handleLeaveGroup(1, 'A')
            : result.current.handleDeleteGroup(1, 'A', { skipConfirm: true });
      });
      useAppStore.setState({ activeGroupId: '2' });
      await act(async () => {
        finish();
        await action;
      });
      expect(changeGroup).not.toHaveBeenCalledWith(null);
    },
  );

  it.each([0, 500, 404])(
    'only removes a remembered guest league on definitive not-found (%s)',
    async (status) => {
      localStorage.setItem('knownGroups', '["5"]');
      vi.mocked(useAppContext).mockReturnValue(
        appContext({ userName: 'Invitado', isAuthenticated: false }),
      );
      vi.mocked(api.fetchGroup).mockRejectedValue(new ApiError(status, 'Unavailable'));
      renderHook(() => useGroupsDashboard(), { wrapper });
      await waitFor(() => expect(api.fetchGroup).toHaveBeenCalledWith('5'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(readKnownGroups()).toEqual(status === 404 ? [] : ['5']);
    },
  );
});
