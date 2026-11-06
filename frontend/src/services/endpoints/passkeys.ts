/** Llaves de acceso de la cuenta: verlas, añadirlas y borrarlas. Entrar con ellas está en http.ts. */
import { request } from '../http';
import type { BrowserOptions } from '../../utils/webauthn';

/** Reto del servidor y las opciones para el navegador. */
export interface PasskeyCeremony {
  requestId: string;
  options: BrowserOptions;
}

export interface PasskeySummary {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const fetchPasskeys = () =>
  request<PasskeySummary[]>('/users/me/passkeys', {
    fallbackError: 'No se pudieron cargar tus llaves de acceso',
  });

export const startPasskeyRegistration = () =>
  request<PasskeyCeremony>('/users/me/passkeys/options', {
    method: 'POST',
    fallbackError: 'No se pudo preparar la llave de acceso',
  });

export const finishPasskeyRegistration = (requestId: string, credential: unknown, name: string) =>
  request<PasskeySummary>('/users/me/passkeys', {
    method: 'POST',
    json: { requestId, credential, name },
    fallbackError: 'No se pudo guardar la llave de acceso',
  });

/** Devuelve las llaves que quedan. */
export const deletePasskey = (id: number) =>
  request<PasskeySummary[]>(`/users/me/passkeys/${id}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar la llave de acceso',
  });
