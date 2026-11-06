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

/** Un aviso push que ya le ha llegado al usuario. */
export interface RecentPushNotification {
  title: string;
  body: string;
  /** Ruta de la app a la que lleva el aviso. */
  url: string | null;
  sentAt: string;
}

export const fetchPushConfig = () => request<PushConfig>('/push/config');

/** Los 3 últimos avisos del usuario, del más reciente al más antiguo. */
export const fetchRecentPushNotifications = () =>
  request<RecentPushNotification[]>('/push/recent', {
    fallbackError: 'No se pudieron cargar los avisos',
  });

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
