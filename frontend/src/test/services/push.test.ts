import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { savePushSubscription } from '../../services/api';
import {
  enablePush,
  PUSH_SERVICE_UNAVAILABLE,
  syncPushSubscription,
  unsubscribeThisDevice,
} from '../../services/push';

vi.mock('../../services/api', () => ({ savePushSubscription: vi.fn(() => Promise.resolve()) }));

// Clave pública P-256 de ejemplo (65 bytes en base64url).
const KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function keyBytes(value: string) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function fakeSubscription(endpoint: string, serverKey: Uint8Array = keyBytes(KEY)) {
  return {
    endpoint,
    options: { applicationServerKey: serverKey.buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
}

let current: ReturnType<typeof fakeSubscription> | null;
const pushManager = {
  getSubscription: vi.fn(() => Promise.resolve(current)),
  subscribe: vi.fn((options: PushSubscriptionOptionsInit) => {
    void options;
    current = fakeSubscription('https://fcm.googleapis.com/fcm/send/new');
    return Promise.resolve(current);
  }),
};
const requestPermission = vi.fn(() => Promise.resolve<NotificationPermission>('granted'));

beforeEach(() => {
  current = null;
  const registration = { pushManager };
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('asks for permission, subscribes with the server key and registers the device', async () => {
  await expect(enablePush(KEY)).resolves.toBe(true);

  expect(requestPermission).toHaveBeenCalled();
  const key = pushManager.subscribe.mock.calls[0][0].applicationServerKey as Uint8Array;
  expect(Array.from(key)).toEqual(Array.from(keyBytes(KEY)));
  expect(savePushSubscription).toHaveBeenCalledWith({
    endpoint: 'https://fcm.googleapis.com/fcm/send/new',
    p256dh: 'p256',
    auth: 'auth',
  });
});

it('does nothing when the user refuses', async () => {
  requestPermission.mockResolvedValueOnce('denied');

  await expect(enablePush(KEY)).resolves.toBe(false);
  expect(pushManager.subscribe).not.toHaveBeenCalled();
  expect(savePushSubscription).not.toHaveBeenCalled();
});

it('reuses the subscription and replaces one made with another server key', async () => {
  current = fakeSubscription('https://fcm.googleapis.com/fcm/send/old');
  await syncPushSubscription(KEY);
  expect(pushManager.subscribe).not.toHaveBeenCalled();
  expect(savePushSubscription).toHaveBeenLastCalledWith(
    expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/old' }),
  );

  const stale = fakeSubscription('https://fcm.googleapis.com/fcm/send/stale', new Uint8Array(65));
  current = stale;
  await syncPushSubscription(KEY);
  expect(stale.unsubscribe).toHaveBeenCalled();
  expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
});

it('explains a browser push service failure instead of showing the raw error', async () => {
  pushManager.subscribe.mockRejectedValueOnce(
    new DOMException('Registration failed - push service error', 'AbortError'),
  );

  await expect(enablePush(KEY)).rejects.toThrow(PUSH_SERVICE_UNAVAILABLE);
  expect(savePushSubscription).not.toHaveBeenCalled();
});

it('unsubscribes the device on logout', async () => {
  const subscription = fakeSubscription('https://fcm.googleapis.com/fcm/send/ana');
  current = subscription;

  await unsubscribeThisDevice();

  expect(subscription.unsubscribe).toHaveBeenCalled();
});
