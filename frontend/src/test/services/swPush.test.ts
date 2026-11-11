import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(resolve(process.cwd(), 'public/sw-push.js'), 'utf8');

function worker(windows: object[] = [], stored = new Map<string, Response>()) {
  const listeners = new Map<string, (event: object) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  const cache = {
    put: vi.fn(async (key: string, response: Response) => {
      stored.set(key, response.clone());
    }),
    keys: vi.fn(async () => [...stored.keys()]),
    match: vi.fn(async (key: string) => stored.get(key)?.clone()),
    delete: vi.fn(async (key: string) => stored.delete(key)),
  };
  runInNewContext(script, {
    URL,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch,
    caches: { open: vi.fn().mockResolvedValue(cache) },
    self: {
      location: { origin: 'https://porrapp.app' },
      addEventListener: (type: string, handler: (event: object) => void) =>
        listeners.set(type, handler),
      registration: { showNotification },
      clients: { matchAll: vi.fn().mockResolvedValue(windows), openWindow },
    },
  });
  async function dispatch(type: string, event: object) {
    let pending: Promise<unknown> | undefined;
    listeners.get(type)?.({
      ...event,
      waitUntil: (value: Promise<unknown>) => {
        pending = value;
      },
    });
    await pending;
  }
  return { showNotification, openWindow, dispatch, fetch, cache, stored };
}

describe('push service worker', () => {
  const token = '12345678-1234-4123-8123-123456789abc';
  const trackedMessage = () => ({
    title: 'Aviso',
    body: 'Contenido',
    tag: 'member-joined-6',
    url: '/?group=6',
    receiptToken: token,
    receiptExpiresAt: Date.now() + 3600000,
  });

  it('confirms only after the notification API succeeds, without a login cookie', async () => {
    const sw = worker();
    await sw.dispatch('push', { data: { json: trackedMessage } });
    expect(sw.fetch).toHaveBeenCalledWith(
      '/api/push/receipts',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        body: JSON.stringify({ token }),
      }),
    );
    expect(sw.showNotification.mock.invocationCallOrder[0]).toBeLessThan(
      sw.fetch.mock.invocationCallOrder[0],
    );
    expect(sw.stored.size).toBe(0);
  });

  it('does not falsely confirm if showing the notification fails', async () => {
    const sw = worker();
    sw.showNotification.mockRejectedValue(new Error('Permission denied'));
    await expect(sw.dispatch('push', { data: { json: trackedMessage } })).rejects.toThrow(
      'Permission denied',
    );
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it('reuses a stable notification tag without renotifying on retransmission', async () => {
    const sw = worker();
    for (let i = 0; i < 2; i++) await sw.dispatch('push', { data: { json: trackedMessage } });
    expect(sw.showNotification).toHaveBeenCalledTimes(2);
    for (const [, options] of sw.showNotification.mock.calls) {
      expect(options).toMatchObject({ tag: 'delivery-' + token, renotify: false });
    }
  });

  it('persists a failed acknowledgement across worker restarts and retries without another notification', async () => {
    const first = worker();
    first.fetch.mockRejectedValue(new Error('Offline'));
    await first.dispatch('push', { data: { json: trackedMessage } });
    expect(first.stored.size).toBe(1);
    const restarted = worker([], first.stored);
    await restarted.dispatch('message', { data: { type: 'porrapp:flush-push-receipts' } });
    expect(restarted.fetch).toHaveBeenCalledTimes(1);
    expect(restarted.stored.size).toBe(0);
    expect(restarted.showNotification).not.toHaveBeenCalled();
  });

  it('keeps rejected acknowledgements and expires them without retrying forever', async () => {
    const sw = worker();
    sw.fetch.mockResolvedValue({ ok: false });
    await sw.dispatch('push', {
      data: { json: () => ({ ...trackedMessage(), receiptExpiresAt: Date.now() - 1 }) },
    });
    expect(sw.stored.size).toBe(1);
    sw.fetch.mockClear();
    await sw.dispatch('message', { data: { type: 'porrapp:flush-push-receipts' } });
    expect(sw.fetch).not.toHaveBeenCalled();
    expect(sw.stored.size).toBe(0);
  });

  it('still acknowledges when device storage is unavailable', async () => {
    const sw = worker();
    sw.cache.put.mockRejectedValue(new Error('Quota exceeded'));
    await sw.dispatch('push', { data: { json: trackedMessage } });
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'member-joined-6',
    'league-repeated-6',
    'score-day-6',
    'matchday-finished-6',
    'gp-result-1',
    'prediction-reminder',
    'survivor-reminder',
    'fight-card-6',
    'push-test',
  ])('displays %s without needing an open app window', async (tag) => {
    const sw = worker();
    await sw.dispatch('push', {
      data: { json: () => ({ title: 'Aviso', body: 'Contenido', tag, url: '/?group=6' }) },
    });
    expect(sw.showNotification).toHaveBeenCalledWith(
      'Aviso',
      expect.objectContaining({
        body: 'Contenido',
        tag,
        renotify: true,
        data: { url: '/?group=6' },
      }),
    );
  });

  it('opens the destination when the app is closed', async () => {
    const sw = worker();
    const close = vi.fn();
    await sw.dispatch('notificationclick', {
      notification: { close, data: { url: '/ranking?group=6' } },
    });
    expect(close).toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith('https://porrapp.app/ranking?group=6');
  });

  it('uses the iOS navigation fallback for an already open app', async () => {
    const postMessage = vi.fn();
    const client = { url: 'https://porrapp.app/', postMessage, focus: vi.fn() };
    client.focus.mockResolvedValue(client);
    const sw = worker([client]);
    await sw.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/ranking?group=6' } },
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'porrapp:navigate', url: '/ranking?group=6' });
  });

  it('does not navigate to a different origin', async () => {
    const sw = worker();
    await sw.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: 'https://example.com' } },
    });
    expect(sw.openWindow).toHaveBeenCalledWith('https://porrapp.app');
  });
});
