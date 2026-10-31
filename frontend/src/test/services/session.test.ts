import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endSession,
  fetchMe,
  fetchStandings,
  getAuthToken,
  initSession,
  loginWithGoogle,
  setAuthToken,
  updateMyProfile,
} from '../../services/api';

type Reply = { status: number; body?: unknown };
type Route = (url: string, init: RequestInit) => Reply | Promise<Reply>;

function deferred<T>() {
  let resolve!: (reply: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const deferredReply = () => deferred<Reply>();

const json = (status: number, body: unknown = {}) => ({ status, body });

/** fetch falso que responde según la ruta y guarda cada llamada. */
function stubFetch(route: Route) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const { status, body } = await route(url, init);
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

  it.each([true, false])(
    'no reenvía una modificación de A con la sesión B (logout previo: %s)',
    async (logoutFirst) => {
      setAuthToken('cuenta-A');
      const pending = deferredReply();
      const fetchMock = stubFetch((url) =>
        url === '/api/users/me/profile' ? pending.promise : json(204),
      );
      const saved = updateMyProfile('Nombre elegido por A');
      const rejected = expect(saved).rejects.toThrow('La sesión ha cambiado');

      if (logoutFirst) endSession();
      setAuthToken('cuenta-B');
      pending.resolve(json(401));
      await rejected;

      const writes = fetchMock.mock.calls.filter(([url]) => url === '/api/users/me/profile');
      expect(writes).toHaveLength(1);
      expect(authHeader(writes[0][1])).toBe('Bearer cuenta-A');
      expect(getAuthToken()).toBe('cuenta-B');
    },
  );

  it('un 401 tardío reutiliza el token ya refrescado de la misma sesión', async () => {
    setAuthToken('caducado');
    const pending = deferredReply();
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/auth/session/refresh') return json(200, { token: 'renovado' });
      if (url === '/api/users/me/profile' && authHeader(init) === 'Bearer caducado') {
        return pending.promise;
      }
      return authHeader(init) === 'Bearer renovado' ? json(200, {}) : json(401);
    });
    const saved = updateMyProfile('Ana');
    await fetchMe();
    pending.resolve(json(401));
    await saved;

    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
    const writes = fetchMock.mock.calls.filter(([url]) => url === '/api/users/me/profile');
    expect(writes.map(([, init]) => authHeader(init))).toEqual([
      'Bearer caducado',
      'Bearer renovado',
    ]);
  });

  it('descarta una respuesta satisfactoria de A que llega después de iniciar sesión B', async () => {
    setAuthToken('cuenta-A');
    const pending = deferredReply();
    stubFetch(() => pending.promise);
    const response = fetchMe();
    const rejected = expect(response).rejects.toThrow('La sesión ha cambiado');
    setAuthToken('cuenta-B');
    pending.resolve(json(200, { participantName: 'A' }));

    await rejected;
    expect(getAuthToken()).toBe('cuenta-B');
  });

  it('descarta datos si la sesión cambia mientras se interpreta el JSON', async () => {
    setAuthToken('cuenta-A');
    const body = deferred<{ participantName: string }>();
    const readBody = vi.fn(() => body.promise);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: readBody })),
    );
    const response = fetchMe();
    const rejected = expect(response).rejects.toThrow('La sesión ha cambiado');
    await vi.waitFor(() => expect(readBody).toHaveBeenCalled());
    setAuthToken('cuenta-B');
    body.resolve({ participantName: 'A' });

    await rejected;
    expect(getAuthToken()).toBe('cuenta-B');
  });

  it('descarta el login de Google pendiente si se cierra sesión antes de recibirlo', async () => {
    const pending = deferredReply();
    stubFetch((url) => (url.endsWith('/logout') ? json(204) : pending.promise));
    const login = loginWithGoogle('credencial-sintética');
    const rejected = expect(login).rejects.toThrow('La sesión ha cambiado');
    endSession();
    pending.resolve(json(200, { token: 'no-restaurar', participantName: 'A' }));

    await rejected;
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('has_session')).toBeNull();
  });

  it('un refresco pendiente de A no sustituye el token de una nueva sesión B', async () => {
    setAuthToken('cuenta-A');
    const pending = deferredReply();
    const fetchMock = stubFetch((url) => (url.endsWith('/refresh') ? pending.promise : json(401)));
    const request = fetchMe();
    const rejected = expect(request).rejects.toThrow('La sesión ha cambiado');
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/refresh'))).toBe(true),
    );
    setAuthToken('cuenta-B');
    pending.resolve(json(200, { token: 'refresco-A' }));
    await rejected;
    expect(getAuthToken()).toBe('cuenta-B');
  });

  it('la sesión B puede refrescar aunque siga pendiente el refresco de A', async () => {
    setAuthToken('cuenta-A');
    const first = deferredReply();
    const second = deferredReply();
    let refreshCount = 0;
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/refresh')) return ++refreshCount === 1 ? first.promise : second.promise;
      return authHeader(init) === 'Bearer refresco-B' ? json(200, {}) : json(401);
    });
    const requestA = fetchMe();
    const rejected = expect(requestA).rejects.toThrow('La sesión ha cambiado');
    await vi.waitFor(() => expect(refreshCount).toBe(1));
    setAuthToken('cuenta-B');
    const requestB = fetchMe();
    await vi.waitFor(() => expect(refreshCount).toBe(2));
    first.resolve(json(200, { token: 'refresco-A' }));
    await rejected;
    const anotherRequestB = fetchMe();
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/users/me')).toHaveLength(3),
    );
    second.resolve(json(200, { token: 'refresco-B' }));

    await Promise.all([requestB, anotherRequestB]);
    expect(refreshCount).toBe(2);
    expect(getAuthToken()).toBe('refresco-B');
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

  it.each([200, 401])(
    'no restaura ni refresca tras logout durante exchange (%s)',
    async (status) => {
      localStorage.setItem('token', 'legacy');
      const pending = deferredReply();
      const fetchMock = stubFetch((url) =>
        url.endsWith('/exchange') ? pending.promise : json(200, { token: 'no-debe-usarse' }),
      );
      const restoring = initSession();
      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/exchange'))).toBe(true),
      );
      endSession();
      pending.resolve(json(status, { token: 'legacy-canjeado' }));

      await expect(restoring).resolves.toBe('superseded');
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem('has_session')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/refresh'))).toBe(false);
    },
  );

  it('descarta exchange y peticiones en espera si otra sesión empieza durante la restauración', async () => {
    localStorage.setItem('token', 'legacy-A');
    const pending = deferredReply();
    const fetchMock = stubFetch((url) => (url.endsWith('/exchange') ? pending.promise : json(200)));
    const restoring = initSession();
    const saved = updateMyProfile('Nombre de A');
    const rejected = expect(saved).rejects.toThrow('La sesión ha cambiado');
    setAuthToken('cuenta-B');
    pending.resolve(json(200, { token: 'legacy-A-canjeado' }));

    await expect(restoring).resolves.toBe('superseded');
    await rejected;
    expect(getAuthToken()).toBe('cuenta-B');
    expect(localStorage.getItem('has_session')).toBe('1');
    expect(localStorage.getItem('token')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/session/exchange']);
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
