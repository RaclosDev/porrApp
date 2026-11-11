/** Recordatorios push: configuración, suscripción y preferencias. */
import { request } from '../http';

export interface PushConfig {
  /** Clave pública VAPID; null si el servidor no tiene avisos configurados. */
  publicKey: string | null;
  remindersEnabled: boolean;
  /** Avisar cuando alguien se une a una de sus ligas. */
  memberJoinedEnabled: boolean;
  /** Avisar cuando termina una jornada de sus ligas, con enlace al ranking. */
  matchdayFinishedEnabled: boolean;
}

export type PushPreferences = Pick<
  PushConfig,
  'remindersEnabled' | 'memberJoinedEnabled' | 'matchdayFinishedEnabled'
>;

interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Un aviso push aceptado por el proveedor; no confirma su presentación en el dispositivo. */
export interface RecentPushNotification {
  title: string;
  body: string;
  /** Ruta de la app a la que lleva el aviso. */
  url: string | null;
  sentAt: string;
}

export const fetchPushConfig = () => request<PushConfig>('/push/config');

export const savePushDeviceState = (state: {
  deviceId: string;
  permission: NotificationPermission | 'unsupported';
  installRequired: boolean;
  promptShown: boolean;
}) => request<void>('/push/device-state', { method: 'POST', json: state });

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

export const sendTestPush = (endpoint: string) =>
  request<void>('/push/test', {
    method: 'POST',
    json: { endpoint },
    fallbackError: 'No se pudo enviar la prueba',
  });

/** Solo cambia las preferencias que se envían. */
export const setPushPreferences = (preferences: Partial<PushPreferences>) =>
  request<void>('/push/preferences', {
    method: 'PUT',
    json: preferences,
    fallbackError: 'No se pudo guardar la preferencia',
  });
