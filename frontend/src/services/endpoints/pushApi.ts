/** Recordatorios push: configuración, suscripción y preferencias. */
import { request } from '../http';

export interface PushConfig {
  /** Clave pública VAPID; null si el servidor no tiene avisos configurados. */
  publicKey: string | null;
  remindersEnabled: boolean;
  /** Avisar cuando alguien se une a una de sus ligas. */
  memberJoinedEnabled: boolean;
}

export type PushPreferences = Pick<PushConfig, 'remindersEnabled' | 'memberJoinedEnabled'>;

interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const fetchPushConfig = () => request<PushConfig>('/push/config');

export const savePushSubscription = (subscription: PushSubscriptionPayload) =>
  request<void>('/push/subscriptions', {
    method: 'POST',
    json: subscription,
    fallbackError: 'No se pudieron activar los avisos',
  });

/** Solo cambia las preferencias que se envían. */
export const setPushPreferences = (preferences: Partial<PushPreferences>) =>
  request<void>('/push/preferences', {
    method: 'PUT',
    json: preferences,
    fallbackError: 'No se pudo guardar la preferencia',
  });
