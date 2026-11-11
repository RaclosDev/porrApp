import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PushReminderPrompt from '../../components/layout/PushReminderPrompt';
import { fetchPushConfig } from '../../services/api';
import * as push from '../../services/push';
import { reportPushDeviceState } from '../../services/pushPrompt';

vi.mock('../../services/pushPrompt', async (original) => ({
  ...(await original<typeof import('../../services/pushPrompt')>()),
  reportPushDeviceState: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/api', () => ({ fetchPushConfig: vi.fn() }));
vi.mock('../../services/push', () => ({
  enablePush: vi.fn(),
  needsIosInstall: vi.fn(() => false),
  notificationPermission: vi.fn(() => 'default'),
  syncPushSubscription: vi.fn(() => Promise.resolve()),
}));

const renderPrompt = (canPrompt = true, userId = '1') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PushReminderPrompt canPrompt={canPrompt} userId={userId} />
    </QueryClientProvider>,
  );

const prompt = () => screen.queryByRole('region', { name: 'Notificaciones de PorrApp' });

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

it('remembers the weekly reminder for the same account', async () => {
  const { unmount } = renderPrompt();
  fireEvent.click(await screen.findByRole('button', { name: 'Recordármelo en una semana' }));
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

it('offers the new prompt at the next visit despite the previous campaign dismissal', async () => {
  localStorage.setItem('push_prompt_dismissed_at', String(Date.now()));
  renderPrompt();
  expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeVisible();
  expect(reportPushDeviceState).toHaveBeenCalledWith(true);
});

it('waits seven days after showing the prompt, even if the user leaves without answering', async () => {
  const now = Date.now();
  const first = renderPrompt();
  await screen.findByRole('button', { name: 'Activar avisos' });
  first.unmount();
  vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 86400000);
  const second = renderPrompt();
  await waitFor(() => expect(fetchPushConfig).toHaveBeenCalledTimes(2));
  expect(prompt()).toBeNull();
  second.unmount();
  vi.spyOn(Date, 'now').mockReturnValue(now + 7 * 86400000 + 1000);
  renderPrompt();
  expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeVisible();
});

it('does not inherit the previous account dismissal', async () => {
  localStorage.setItem('push_prompt_v2:1', String(Date.now()));
  renderPrompt(true, '2');
  expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeVisible();
});

it('explains blocked permissions without calling the native prompt again', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('denied');
  renderPrompt();
  expect(
    await screen.findByText('Tienes las notificaciones bloqueadas en este dispositivo'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Activar avisos' })).toBeNull();
  expect(push.enablePush).not.toHaveBeenCalled();
  expect(reportPushDeviceState).toHaveBeenCalled();
});

it('explains installation on iPhone even when push is unsupported in the browser', async () => {
  vi.mocked(push.needsIosInstall).mockReturnValue(true);
  vi.mocked(push.notificationPermission).mockReturnValue('unsupported');
  renderPrompt();
  expect(await screen.findByText(/Abre PorrApp en Safari/)).toBeVisible();
  expect(push.enablePush).not.toHaveBeenCalled();
});

it('offers browser permission even when account preferences are off without changing them', async () => {
  vi.mocked(fetchPushConfig).mockResolvedValue({
    publicKey: 'KEY',
    remindersEnabled: false,
    memberJoinedEnabled: false,
    matchdayFinishedEnabled: false,
  });
  renderPrompt();
  expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeVisible();
});

it('reports revoked permission on returning to the app', async () => {
  vi.mocked(push.notificationPermission).mockReturnValue('granted');
  renderPrompt();
  await waitFor(() => expect(reportPushDeviceState).toHaveBeenCalled());
  vi.mocked(reportPushDeviceState).mockClear();
  vi.mocked(push.notificationPermission).mockReturnValue('denied');
  fireEvent.focus(window);
  await waitFor(() => expect(reportPushDeviceState).toHaveBeenCalled());
  expect(
    await screen.findByText('Tienes las notificaciones bloqueadas en este dispositivo'),
  ).toBeVisible();
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
