import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineRounds } from '../../hooks/useOfflineRounds';
import { addTrackerRound, type Tracker } from '../../services/endpoints/trackers';
import { useAppStore } from '../../store/useAppStore';

vi.mock('../../services/endpoints/trackers', () => ({ addTrackerRound: vi.fn() }));

const PREFIX = 'porrapp.tracker.test-user.7.round.';
const entries = () => Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
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
    useAppStore.setState({ userId: 'test-user' });
    vi.mocked(addTrackerRound).mockReset();
  });
  afterEach(() => setOnline(true));

  it('con red envía la ronda directamente', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockResolvedValue(saved);
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await expect(result.current.add({ sessionId: 4, scores: { '1': 5 } })).resolves.toBe(saved);
    expect(entries()).toHaveLength(0);
  });

  it('sin red la guarda y la envía al volver la conexión', async () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add({ sessionId: 4, scores: { '1': 5 } });
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
    expect(addTrackerRound).toHaveBeenCalledExactlyOnceWith(7, {
      sessionId: 4,
      scores: { '1': 5 },
      clientRequestId: expect.any(String),
    });
    expect(entries()).toHaveLength(0);
  });

  it('si el envío falla por la red también la guarda para luego', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await act(async () => {
      await expect(result.current.add({ sessionId: 4, winners: [1] })).resolves.toBe('queued');
    });
    expect(entries()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(entries()[0]) ?? '{}').round).toEqual({
      sessionId: 4,
      winners: [1],
      clientRequestId: expect.any(String),
    });
  });

  it('un rechazo del servidor queda pendiente con su error para revisión', async () => {
    setOnline(true);
    vi.mocked(addTrackerRound).mockRejectedValue(new Error('Partida cerrada'));
    const { result } = renderHook(() => useOfflineRounds(7, '3'), { wrapper });
    await expect(result.current.add({ sessionId: 4, winners: [1] })).rejects.toThrow(
      'Partida cerrada',
    );
    expect(entries()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(entries()[0]) ?? '{}').problem).toBe('Partida cerrada');
  });
});
