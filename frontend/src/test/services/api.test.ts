import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, setAuthToken, fetchStandings, fetchMatches } from '../../services/api';

describe('api.ts service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda y recupera tokens de autenticación correctamente', () => {
    expect(getAuthToken()).toBeNull();

    setAuthToken('my-secret-jwt-token');
    expect(getAuthToken()).toBe('my-secret-jwt-token');
    expect(localStorage.getItem('token')).toBe('my-secret-jwt-token');

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
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

    await fetchMatches('laliga-2026');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/matches?competitionId=laliga-2026',
      expect.anything(),
    );
  });

  it('lanza un error si la respuesta HTTP no es ok (4xx/5xx)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchStandings()).rejects.toThrow('HTTP error! status: 404');
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
    await expect(fetchStandings()).rejects.toThrow('401');
    expect(getAuthToken()).toBe('new-test-token');
  });

  it('caduca la sesión cuando el token actual recibe un 401', async () => {
    setAuthToken('expired-test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchStandings()).rejects.toThrow('401');
    expect(getAuthToken()).toBeNull();
  });
});
