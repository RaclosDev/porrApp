/**
 * Error de una llamada al backend. `status` es el código HTTP, o 0 cuando la petición no llegó
 * a tener respuesta (sin red o tiempo de espera agotado).
 *
 * Vive fuera de `api.ts` para que los tests que simulan ese módulo puedan seguir usando
 * `instanceof ApiError`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const NETWORK_ERROR_MESSAGE = 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
export const TIMEOUT_ERROR_MESSAGE =
  'El servidor no responde. Inténtalo de nuevo en unos segundos.';

export const isApiError = (err: unknown, status?: number): err is ApiError =>
  err instanceof ApiError && (status === undefined || err.status === status);
