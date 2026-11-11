import { beforeEach, expect, it, vi } from 'vitest';
import { savePushDeviceState } from '../../services/api';
import {
  pushPromptDue,
  rememberPushPrompt,
  reportPushDeviceState,
} from '../../services/pushPrompt';
import { needsIosInstall, notificationPermission } from '../../services/push';

vi.mock('../../services/api', () => ({ savePushDeviceState: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/push', () => ({
  notificationPermission: vi.fn(() => 'default'),
  needsIosInstall: vi.fn(() => false),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

it('reports a stable random browser identifier and the current permission without account identifiers', async () => {
  await reportPushDeviceState();
  vi.mocked(notificationPermission).mockReturnValue('denied');
  vi.mocked(needsIosInstall).mockReturnValue(true);
  await reportPushDeviceState(true);
  const first = vi.mocked(savePushDeviceState).mock.calls[0][0];
  expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(savePushDeviceState).toHaveBeenLastCalledWith({
    deviceId: first.deviceId,
    permission: 'denied',
    installRequired: true,
    promptShown: true,
  });
});

it('isolates the weekly reminder per account and ignores obsolete dismissals', () => {
  localStorage.setItem('push_prompt_dismissed_at', String(Date.now()));
  expect(pushPromptDue('1')).toBe(true);
  rememberPushPrompt('1');
  expect(pushPromptDue('1')).toBe(false);
  expect(pushPromptDue('2')).toBe(true);
});
