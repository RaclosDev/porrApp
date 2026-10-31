import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const reply = (body: unknown = {}, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

describe.each([true, false])('session cookie ordering (Web Locks: %s)', (webLocks) => {
  let api: typeof import('../../services/api');

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    if (webLocks) {
      let tail = Promise.resolve();
      const request = <T>(_name: string, task: () => Promise<T>): Promise<T> => {
        const next = tail.then(task);
        tail = next.then(
          () => {},
          () => {},
        );
        return next;
      };
      vi.stubGlobal('navigator', { locks: { request } });
    }
    api = await import('../../services/api');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('an old refresh cannot overwrite the cookie of a subsequent login', async () => {
    const refresh = deferred();
    const events: string[] = [];
    let cookie = 'A';
    api.setAuthToken('A');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit = {}) => {
        if (url.endsWith('/refresh')) {
          events.push('refresh started');
          await refresh.promise;
          cookie = 'A-rotated';
          events.push('refresh completed');
          return reply({ token: 'A-rotated' });
        }
        if (url.endsWith('/login')) {
          events.push('login started');
          cookie = 'B';
          return reply({ token: 'B' });
        }
        return reply(
          {},
          (options.headers as Record<string, string>)?.Authorization === 'Bearer A' ? 401 : 200,
        );
      }),
    );
    const request = api.fetchMe().catch(() => undefined);
    await vi.waitFor(() => expect(events).toContain('refresh started'));
    const login = api.loginWithGoogle('synthetic-B');
    await Promise.resolve();
    refresh.resolve();
    await Promise.all([request, login]);
    expect(events.indexOf('login started')).toBeGreaterThan(events.indexOf('refresh completed'));
    expect(cookie).toBe('B');
    expect(api.getAuthToken()).toBe('B');
  });

  it('logout clears the cookie after an already running login finishes', async () => {
    const loginResponse = deferred();
    let cookie = '';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/login')) {
        await loginResponse.promise;
        cookie = 'A';
        return reply({ token: 'A' });
      }
      cookie = '';
      return reply();
    });
    vi.stubGlobal('fetch', fetchMock);
    const login = api.loginWithGoogle('synthetic-A');
    const rejected = expect(login).rejects.toThrow('La sesión ha cambiado');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    api.endSession();
    loginResponse.resolve();
    await rejected;
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/logout'))).toBe(true),
    );
    expect(cookie).toBe('');
    expect(api.getAuthToken()).toBeNull();
  });

  it('a pending logout cannot clear the cookie of the next login', async () => {
    const logoutResponse = deferred();
    let cookie = 'A';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/logout')) {
        await logoutResponse.promise;
        cookie = '';
        return reply();
      }
      cookie = 'B';
      return reply({ token: 'B' });
    });
    vi.stubGlobal('fetch', fetchMock);
    api.setAuthToken('A');
    api.endSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const login = api.loginWithGoogle('synthetic-B');
    await Promise.resolve();
    logoutResponse.resolve();
    await login;
    expect(cookie).toBe('B');
  });

  it('login waits for startup restoration without holding its lock', async () => {
    localStorage.setItem('has_session', '1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => reply({ token: url.endsWith('/login') ? 'B' : 'A' })),
    );
    const restoration = api.initSession();
    const login = api.loginWithGoogle('synthetic-B');
    await Promise.all([restoration, login]);
    expect(api.getAuthToken()).toBe('B');
  });

  it('does not send an old access token after another tab replaces the session', async () => {
    api.setAuthToken('A');
    localStorage.setItem('session_revision', 'other-tab-login');
    const fetchMock = vi.fn(async () => reply({ userId: 'A' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.fetchMe()).rejects.toThrow('La sesión ha cambiado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
