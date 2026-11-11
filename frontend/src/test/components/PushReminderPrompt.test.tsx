import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PushReminderPrompt from '../../components/layout/PushReminderPrompt';
import { fetchPushConfig } from '../../services/api';
import * as push from '../../services/push';

vi.mock('../../services/api', () => ({ fetchPushConfig: vi.fn() }));
vi.mock('../../services/push', () => ({
  enablePush: vi.fn(),
  needsIosInstall: vi.fn(() => false),
  notificationPermission: vi.fn(() => 'default'),
  syncPushSubscription: vi.fn(() => Promise.resolve()),
}));

const renderPrompt = (canPrompt = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PushReminderPrompt canPrompt={canPrompt} />
    </QueryClientProvider>,
  );

const prompt = () => screen.queryByRole('region', { name: 'Avisos de predicción' });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(fetchPushConfig).mockResolvedValue({
    publicKey: 'KEY',
    remindersEnabled: true,
    memberJoinedEnabled: true,
    matchdayFinishedEnabled: true,
  });
  vi.mocked(push.notificationPermission).mockReturnValue('default');
  vi.mocked(push.needsIosInstall).mockReturnValue(false);
});

it('asks for permission and subscribes the device', async () => {
  vi.mocked(push.enablePush).mockResolvedValue(true);
  renderPrompt();

  fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

  await waitFor(() => expect(push.enablePush).toHaveBeenCalledWith('KEY'));
  await waitFor(() => expect(prompt()).toBeNull());
});

it('remembers "Ahora no" for a while', async () => {
  const { unmount } = renderPrompt();
  fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }));
  expect(prompt()).toBeNull();
  unmount();

  renderPrompt();
  await waitFor(() => expect(fetchPushConfig).toHaveBeenCalledTimes(2));
  expect(prompt()).toBeNull();
});

it.each([
  [
    'without server keys',
    {
      publicKey: null,
      remindersEnabled: true,
      memberJoinedEnabled: true,
      matchdayFinishedEnabled: true,
    },
    false,
    true,
  ],
  [
    'with every alert off',
    {
      publicKey: 'KEY',
      remindersEnabled: false,
      memberJoinedEnabled: false,
      matchdayFinishedEnabled: false,
    },
    false,
    true,
  ],
  [
    'on iOS outside the installed app',
    {
      publicKey: 'KEY',
      remindersEnabled: true,
      memberJoinedEnabled: true,
      matchdayFinishedEnabled: true,
    },
    true,
    true,
  ],
  [
    'while another banner is shown',
    {
      publicKey: 'KEY',
      remindersEnabled: true,
      memberJoinedEnabled: true,
      matchdayFinishedEnabled: true,
    },
    false,
    false,
  ],
])('stays hidden %s', async (_, config, iosInstall, canPrompt) => {
  vi.mocked(fetchPushConfig).mockResolvedValue(config);
  vi.mocked(push.needsIosInstall).mockReturnValue(iosInstall);
  renderPrompt(canPrompt);

  await waitFor(() => expect(fetchPushConfig).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(prompt()).toBeNull();
});

it('re-registers the device silently once permission was granted', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  renderPrompt();

  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledWith('KEY'));
  expect(prompt()).toBeNull();
});

it('retries a failed registration when the connection returns', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  vi.mocked(push.syncPushSubscription).mockRejectedValueOnce(new Error('offline'));
  renderPrompt(false);
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledTimes(1));
  fireEvent.online(window);
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledTimes(2));
  fireEvent.focus(window);
  expect(push.syncPushSubscription).toHaveBeenCalledTimes(2);
});

it('retries a transient failure after 30 seconds and cancels retries on unmount', async () => {
  vi.useFakeTimers();
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  vi.mocked(push.syncPushSubscription)
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('offline'));
  const { unmount } = renderPrompt();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(push.syncPushSubscription).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(push.syncPushSubscription).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300_000);
  });
  fireEvent.online(window);
  expect(push.syncPushSubscription).toHaveBeenCalledTimes(2);
});

it('registers after permission is granted in browser settings without reloading', async () => {
  renderPrompt();
  await screen.findByRole('button', { name: 'Activar avisos' });
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  fireEvent.focus(window);
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledWith('KEY'));
  expect(prompt()).toBeNull();
});

it('refreshes the subscription when returning to the app after five minutes', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  renderPrompt();
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledTimes(1));
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledTimes(2));
});

it('does not start another registration while one is pending', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  let finish: () => void = () => {};
  vi.mocked(push.syncPushSubscription).mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  renderPrompt();
  await waitFor(() => expect(push.syncPushSubscription).toHaveBeenCalledTimes(1));
  fireEvent.online(window);
  fireEvent.focus(window);
  expect(push.syncPushSubscription).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});
