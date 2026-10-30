import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endSession,
  fetchMe,
  fetchStandings,
  getAuthToken,
  initSession,
  loginWithGoogle,
  setAuthToken,
} from '../../services/api';

type Route = (url: string, init: RequestInit) => { status: number; body?: unknown };

const json = (status: number, body: unknown = {}) => ({ status, body });

/** fetch falso que responde según la ruta y guarda cada llamada. */
function stubFetch(route: Route) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const { status, body } = route(url, init);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const authHeader = (init: RequestInit = {}) =>
  (init.headers as Record<string, string> | undefined)?.Authorization;

describe('sesión con refresh token', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ante un 401 refresca una vez y repite la petición con el token nuevo', async () => {
    setAuthToken('caducado');
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/auth/session/refresh') return json(200, { token: 'nuevo' });
      return authHeader(init) === 'Bearer nuevo'
        ? json(200, { participantName: 'Ana' })
        : json(401);
    });

    await expect(fetchMe()).resolves.toEqual({ participantName: 'Ana' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/users/me',
      '/api/auth/session/refresh',
      '/api/users/me',
    ]);
    // El refresh token va en la cookie: la petición de refresco no lleva Authorization.
    expect(authHeader(fetchMock.mock.calls[1][1])).toBeUndefined();
    expect(getAuthToken()).toBe('nuevo');
  });

  it('varias peticiones con 401 a la vez comparten un solo refresco', async () => {
    setAuthToken('caducado');
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/auth/session/refresh') return json(200, { token: 'nuevo' });
      return authHeader(init) === 'Bearer nuevo' ? json(200, {}) : json(401);
    });

    await Promise.all([fetchMe(), fetchStandings(), fetchMe()]);

    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/session/refresh'),
    ).toHaveLength(1);
  });

  it('no refresca dos veces: si el reintento vuelve a dar 401, se devuelve el error', async () => {
    setAuthToken('caducado');
    const fetchMock = stubFetch((url) =>
      url === '/api/auth/session/refresh' ? json(200, { token: 'nuevo' }) : json(401),
    );

    await expect(fetchMe()).rejects.toThrow('401');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAuthToken()).toBe('nuevo');
  });

  it('si el refresco se rechaza, cierra la sesión', async () => {
    setAuthToken('caducado');
    const expired = vi.fn();
    window.addEventListener('auth-expired', expired);
    stubFetch(() => json(401));

    await expect(fetchMe()).rejects.toThrow('401');

    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('has_session')).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth-expired', expired);
  });

  it('sin conexión al refrescar, mantiene la sesión', async () => {
    setAuthToken('caducado');
    const expired = vi.fn();
    window.addEventListener('auth-expired', expired);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/auth/session/refresh') throw new TypeError('Failed to fetch');
        return { ok: false, status: 401, json: async () => ({}) };
      }),
    );

    await expect(fetchMe()).rejects.toThrow('401');

    expect(expired).not.toHaveBeenCalled();
    expect(localStorage.getItem('has_session')).toBe('1');
    window.removeEventListener('auth-expired', expired);
  });

  it('una credencial de Google rechazada no intenta refrescar', async () => {
    setAuthToken('vigente');
    const fetchMock = stubFetch(() => json(401, { error: 'Token de Google inválido' }));

    await expect(loginWithGoogle('mala')).rejects.toThrow('Token de Google inválido');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('al arrancar recupera la sesión con la cookie y las peticiones esperan al token', async () => {
    localStorage.setItem('has_session', '1');
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/auth/session/refresh') return json(200, { token: 'recuperado' });
      return authHeader(init) === 'Bearer recuperado' ? json(200, {}) : json(401);
    });

    const restored = initSession();
    const standings = fetchStandings();

    await expect(restored).resolves.toBe('restored');
    await standings;
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/session/refresh',
      '/api/standings',
    ]);
  });

  it('al arrancar sin rastro de sesión no llama al servidor', async () => {
    const fetchMock = stubFetch(() => json(200));

    await expect(initSession()).resolves.toBe('none');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cambia el JWT antiguo de localStorage por una sesión nueva y lo borra', async () => {
    localStorage.setItem('token', 'jwt-de-7-dias');
    const fetchMock = stubFetch((url) =>
      url === '/api/auth/session/exchange' ? json(200, { token: 'access-nuevo' }) : json(404),
    );

    await expect(initSession()).resolves.toBe('restored');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/session/exchange');
    expect(init?.method).toBe('POST');
    expect(authHeader(init)).toBe('Bearer jwt-de-7-dias');
    expect(localStorage.getItem('token')).toBeNull();
    expect(getAuthToken()).toBe('access-nuevo');
  });

  it('si el JWT antiguo ya no vale, lo borra y prueba con la cookie', async () => {
    localStorage.setItem('token', 'caducado');
    const fetchMock = stubFetch((url) =>
      url === '/api/auth/session/refresh' ? json(200, { token: 'de-la-cookie' }) : json(401),
    );

    await expect(initSession()).resolves.toBe('restored');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/session/exchange',
      '/api/auth/session/refresh',
    ]);
    expect(localStorage.getItem('token')).toBeNull();
    expect(getAuthToken()).toBe('de-la-cookie');
  });

  it('el logout olvida el token y revoca la sesión en el servidor', () => {
    setAuthToken('vigente');
    localStorage.setItem('token', 'jwt-de-7-dias');
    const fetchMock = stubFetch(() => json(204));

    endSession();

    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('has_session')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session/logout', {
      method: 'POST',
      keepalive: true,
    });
  });
});
