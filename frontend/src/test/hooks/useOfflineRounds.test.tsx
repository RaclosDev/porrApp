import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineRounds } from '../../hooks/useOfflineRounds';
import { addTrackerRound, type Tracker } from '../../services/endpoints/trackers';

vi.mock('../../services/endpoints/trackers', () => ({ addTrackerRound: vi.fn() }));

const KEY = 'porrapp.tracker.7.pendingRounds';
const saved = { id: 7 } as Tracker;

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useOfflineRounds', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(addTrackerRound).mockReset();
  });
  afterEach(() => setOnline(true));

  it('con red envía la ronda directamente', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockResolvedValue(saved);
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await expect(result.current.add({ scores: { '1': 5 } })).resolves.toBe(saved);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('sin red la guarda y la envía al volver la conexión', async () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add({ scores: { '1': 5 } });
    });
    expect(outcome).toBe('queued');
    expect(addTrackerRound).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(1);

    vi.mocked(addTrackerRound).mockResolvedValue(saved);
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(addTrackerRound).toHaveBeenCalledExactlyOnceWith(7, { scores: { '1': 5 } });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('si el envío falla por la red también la guarda para luego', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await act(async () => {
      await expect(result.current.add({ winners: [1] })).resolves.toBe('queued');
    });
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([{ winners: [1] }]);
  });

  it('un rechazo del servidor no se guarda', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockRejectedValue(new Error('Partida cerrada'));
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await expect(result.current.add({ winners: [1] })).rejects.toThrow('Partida cerrada');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
