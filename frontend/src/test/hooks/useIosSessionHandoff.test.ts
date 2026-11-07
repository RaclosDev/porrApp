import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prepareSessionHandoff } from '../../services/api';
import { useInstallState } from '../../hooks/useInstallState';
import { useAppStore } from '../../store/useAppStore';
import { useIosSessionHandoff } from '../../hooks/useIosSessionHandoff';

vi.mock('../../services/api', () => ({
  prepareSessionHandoff: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../hooks/useInstallState', () => ({
  useInstallState: vi.fn(() => 'ios'),
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(prepareSessionHandoff).mockClear();
  vi.mocked(useInstallState).mockReturnValue('ios');
  useAppStore.setState({ isAuthenticated: true, isDemoMode: false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
});

it('prepares the handoff when signed in on the iPhone browser', () => {
  renderHook(() => useIosSessionHandoff());
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(1);
});

it.each([
  ['signed out', () => useAppStore.setState({ isAuthenticated: false })],
  ['in demo mode', () => useAppStore.setState({ isDemoMode: true })],
  ['inside the installed app', () => vi.mocked(useInstallState).mockReturnValue('installed')],
  ['in an in-app browser', () => vi.mocked(useInstallState).mockReturnValue('in-app')],
  ['outside iOS', () => vi.mocked(useInstallState).mockReturnValue('native')],
])('does nothing when %s', (_, setUp) => {
  setUp();
  renderHook(() => useIosSessionHandoff());
  expect(prepareSessionHandoff).not.toHaveBeenCalled();
});

it('renews the code before it expires', () => {
  renderHook(() => useIosSessionHandoff());
  act(() => vi.advanceTimersByTime(20 * 60 * 1000));
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(2);
});

it('renews on returning to the tab, at most once a minute', () => {
  renderHook(() => useIosSessionHandoff());
  act(() => setVisibility('hidden'));
  act(() => setVisibility('visible'));
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(1);

  act(() => vi.advanceTimersByTime(61 * 1000));
  act(() => setVisibility('hidden'));
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(1);
  act(() => setVisibility('visible'));
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(2);
});

it('stops after unmounting', () => {
  const { unmount } = renderHook(() => useIosSessionHandoff());
  unmount();
  act(() => vi.advanceTimersByTime(20 * 60 * 1000));
  act(() => setVisibility('visible'));
  expect(prepareSessionHandoff).toHaveBeenCalledTimes(1);
});
