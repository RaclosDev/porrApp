import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isRedeemingHandoff, whenSessionRestored, type SessionRestore } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useSessionHandoffPending } from '../../hooks/useSessionHandoffPending';

vi.mock('../../services/api', () => ({
  isRedeemingHandoff: vi.fn(() => false),
  whenSessionRestored: vi.fn(() => null),
}));

let finish: (result: SessionRestore) => void;

beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({ userName: '', profileSetupCompleted: null });
  vi.mocked(isRedeemingHandoff).mockReturnValue(true);
  vi.mocked(whenSessionRestored).mockReturnValue(
    new Promise<SessionRestore>((resolve) => {
      finish = resolve;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

it('is false outside a handoff redemption', () => {
  vi.mocked(isRedeemingHandoff).mockReturnValue(false);
  expect(renderHook(() => useSessionHandoffPending()).result.current).toBe(false);
});

it('waits for the redemption and then for the profile', async () => {
  const { result } = renderHook(() => useSessionHandoffPending());
  expect(result.current).toBe(true);

  await act(async () => finish('restored'));
  expect(result.current).toBe(true);

  act(() => useAppStore.setState({ userName: 'Ana' }));
  expect(result.current).toBe(false);
});

it('stops waiting when there was nothing to redeem', async () => {
  const { result } = renderHook(() => useSessionHandoffPending());
  await act(async () => finish('none'));
  expect(result.current).toBe(false);
});

it('gives up on a profile that never arrives', async () => {
  const { result } = renderHook(() => useSessionHandoffPending());
  await act(async () => finish('restored'));

  act(() => vi.advanceTimersByTime(8000));
  expect(result.current).toBe(false);
});
