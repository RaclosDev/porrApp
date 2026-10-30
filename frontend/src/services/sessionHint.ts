/**
 * Rastro en localStorage de que este dispositivo tiene sesión. No guarda nada secreto: el
 * access token vive en memoria (api.ts) y el refresh token en una cookie HttpOnly.
 */

/** JWT de 7 días que guardaba la versión anterior; api.ts lo canjea por una sesión y lo borra. */
export const LEGACY_TOKEN_KEY = 'token';
export const SESSION_HINT_KEY = 'has_session';

/** Si este dispositivo tenía sesión al cargar (aún sin comprobar con el servidor). */
export function hasStoredSession(): boolean {
  return (
    localStorage.getItem(SESSION_HINT_KEY) !== null ||
    localStorage.getItem(LEGACY_TOKEN_KEY) !== null
  );
}
