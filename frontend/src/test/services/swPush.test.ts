import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(resolve(process.cwd(), 'public/sw-push.js'), 'utf8');

function worker(windows: object[] = []) {
  const listeners = new Map<string, (event: object) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  runInNewContext(script, {
    URL,
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
  return { showNotification, openWindow, dispatch };
}

describe('push service worker', () => {
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
