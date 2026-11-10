import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readKnownGroups, useGroupsDashboard } from '../../hooks/useGroupsDashboard';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import { appContext, group } from '../context/fixtures';
import { useAppStore } from '../../store/useAppStore';
import { confirmAction } from '../../utils/confirmAction';

vi.mock('../../utils/confirmAction', () => ({ confirmAction: vi.fn().mockResolvedValue(true) }));
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../services/apiError';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  fetchMyGroups: vi.fn(),
  fetchMyLeagueSummaries: vi.fn(async () => []),
  fetchCompetitions: vi.fn().mockResolvedValue([]),
  fetchGroup: vi.fn(),
  fetchGroupInvitationPreview: vi.fn(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  repeatGroup: vi.fn(),
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

  it('al unirse a una liga de juegos de mesa abre su marcador y no la deja como liga activa', async () => {
    const joined = group({ id: 9, name: 'Mus de los jueves', kind: 'SCOREBOARD' });
    vi.mocked(api.fetchMyGroups).mockResolvedValue([]);
    vi.mocked(api.joinGroup).mockResolvedValue(joined);
    const { result } = renderHook(
      () => ({ dashboard: useGroupsDashboard(), location: useLocation() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));
    act(() => result.current.dashboard.setJoinCode('MUS123'));
    await act(async () => {
      await result.current.dashboard.handleJoin();
    });
    expect(result.current.location.pathname).toBe('/marcador/9');
    expect(context.changeGroup).not.toHaveBeenCalled();
    expect(result.current.dashboard.joinCode).toBe('');
  });

  it('las ligas de juegos de mesa no entran en la lista de ligas de predicciones', async () => {
    vi.mocked(api.fetchMyGroups).mockResolvedValue([
      group({ id: 1, name: 'Peña de LaLiga' }),
      group({ id: 9, name: 'Mus de los jueves', kind: 'SCOREBOARD' }),
    ]);
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    expect(result.current.groups[0].name).toBe('Peña de LaLiga');
  });

  it('repetir una liga la crea, refresca la lista y deja la nueva como activa', async () => {
    const ended = group({ id: 1, name: 'Amigos', seasonEnded: true, canRepeat: true });
    const repeated = group({ id: 9, name: 'Amigos', season: '2026/27' });
    vi.mocked(api.fetchMyGroups).mockResolvedValue([ended]);
    vi.mocked(api.repeatGroup).mockResolvedValue(repeated);
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(api.fetchMyGroups).mockClear();
    context.changeGroup.mockClear();

    await act(async () => {
      await result.current.handleRepeatGroup(ended);
    });

    expect(api.repeatGroup).toHaveBeenCalledWith(1);
    expect(api.fetchMyGroups).toHaveBeenCalledTimes(1);
    expect(context.changeGroup).toHaveBeenCalledWith('9');
    expect(result.current.error).toBe('');
  });

  it('sin confirmar no se repite la liga', async () => {
    vi.mocked(api.fetchMyGroups).mockResolvedValue([]);
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });

    await act(async () => {
      await result.current.handleRepeatGroup(group({ id: 1 }));
    });

    expect(api.repeatGroup).not.toHaveBeenCalled();
  });

  it('si repetir la liga falla, enseña el motivo y no cambia de liga', async () => {
    vi.mocked(api.fetchMyGroups).mockResolvedValue([group({ id: 1 }), group({ id: 2 })]);
    vi.mocked(api.repeatGroup).mockRejectedValue(
      new ApiError(400, 'La temporada de esta liga aún no ha terminado'),
    );
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    context.changeGroup.mockClear();

    await act(async () => {
      await result.current.handleRepeatGroup(group({ id: 1 }));
    });

    expect(result.current.error).toBe('La temporada de esta liga aún no ha terminado');
    expect(context.changeGroup).not.toHaveBeenCalled();
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

  it('al salir quita la liga de la lista en caché para que se abra sola la más reciente', async () => {
    vi.mocked(api.leaveGroup).mockResolvedValue({ status: 'success' });
    vi.mocked(api.fetchMyGroups).mockResolvedValue([group({ id: 1 }), group({ id: 2 })]);
    const changeGroup = vi.fn();
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ isAuthenticated: true, userName: 'Ana', activeGroupId: '1', changeGroup }),
    );
    useAppStore.setState({ activeGroupId: '1' });
    const { result } = renderHook(() => useGroupsDashboard(), { wrapper });
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    vi.mocked(api.fetchMyGroups).mockResolvedValue([group({ id: 2 })]);

    await act(async () => {
      await result.current.handleLeaveGroup(1, 'A');
    });

    expect(api.leaveGroup).toHaveBeenCalledWith(1);
    await waitFor(() => expect(result.current.groups.map((g) => g.id)).toEqual([2]));
    // La nueva liga la elige useLeagueDataEffects; aquí no se deja la app sin liga.
    expect(changeGroup).not.toHaveBeenCalledWith(null);
  });

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
