import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, setAuthToken, fetchStandings, fetchMatches } from '../../services/api';
import { hasStoredSession } from '../../services/sessionHint';
import {
  ApiError,
  isApiError,
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from '../../services/apiError';

describe('api.ts service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda el access token solo en memoria', () => {
    expect(getAuthToken()).toBeNull();

    setAuthToken('my-secret-jwt-token');
    expect(getAuthToken()).toBe('my-secret-jwt-token');
    expect(Object.values(localStorage)).not.toContain('my-secret-jwt-token');
    expect(hasStoredSession()).toBe(true);

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(hasStoredSession()).toBe(false);
  });

  it('adjunta la cabecera Authorization: Bearer cuando el token existe', async () => {
    setAuthToken('valid-jwt-token-xyz');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ group: 'A', teams: [] }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const standings = await fetchStandings();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('/api/standings');
    expect(calledOptions.headers).toHaveProperty('Authorization', 'Bearer valid-jwt-token-xyz');
    expect(standings).toEqual([{ group: 'A', teams: [] }]);
  });

  it('construye la URL con competitionId para fetchMatches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchMatches(7);

    expect(mockFetch).toHaveBeenCalledWith('/api/matches?competitionId=7', expect.anything());
  });

  it('lanza un error si la respuesta HTTP no es ok (4xx/5xx)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchStandings()).rejects.toThrow('Error del servidor (404)');
  });

  it('mantiene la sesión ante un 403 de una liga y muestra el motivo', async () => {
    setAuthToken('test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'No perteneces a esta liga' }),
      }),
    );
    await expect(fetchStandings()).rejects.toThrow('No perteneces a esta liga');
    expect(getAuthToken()).toBe('test-token');
  });

  it('un 401 antiguo no cierra una sesión nueva', async () => {
    setAuthToken('old-test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        setAuthToken('new-test-token');
        return { ok: false, status: 401, json: async () => ({}) };
      }),
    );
    await expect(fetchStandings()).rejects.toThrow('La sesión ha cambiado');
    expect(getAuthToken()).toBe('new-test-token');
  });

  it('caduca la sesión cuando el token actual recibe un 401', async () => {
    setAuthToken('expired-test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchStandings()).rejects.toThrow('401');
    expect(getAuthToken()).toBeNull();
  });

  it('lanza un ApiError con el código HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'No perteneces a esta liga' }),
      }),
    );
    const err = await fetchStandings().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(isApiError(err, 403)).toBe(true);
    expect(isApiError(err, 404)).toBe(false);
  });

  it('traduce un fallo de red a un mensaje en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchStandings().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('distingue el tiempo de espera agotado de la falta de red', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );
    await expect(fetchStandings()).rejects.toThrow(TIMEOUT_ERROR_MESSAGE);
  });

  it('pasa siempre una señal con tiempo de espera', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    await fetchStandings();
    expect(mockFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
