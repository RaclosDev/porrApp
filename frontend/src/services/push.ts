import { savePushSubscription } from './api';

/** El navegador puede recibir avisos push (en iOS, solo con la app añadida a la pantalla de inicio). */
function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac con pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** En iPhone y iPad los avisos solo funcionan desde la app instalada en la pantalla de inicio. */
export function needsIosInstall(): boolean {
  return isIos() && !isStandalone();
}

/**
 * Qué hace la campana de la cabecera al pulsarla: mostrar los últimos avisos, activarlos, explicar
 * que en iPhone hay que instalar antes la app o que el navegador los tiene bloqueados.
 * null: este navegador no admite avisos y la campana no se muestra.
 */
export type BellAction = 'recent' | 'enable' | 'install-first' | 'blocked';

export function bellAction(accountEnabled: boolean): BellAction | null {
  if (needsIosInstall()) return 'install-first';
  const permission = notificationPermission();
  if (permission === 'unsupported') return null;
  if (permission === 'denied') return 'blocked';
  return permission === 'granted' && accountEnabled ? 'recent' : 'enable';
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const expected = keyBytes(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((b, i) => b === expected[i]);
}

/**
 * El navegador no logra registrarse en su servicio push (AbortError «push service error»): suele ser
 * Brave sin «Usar servicios de Google para mensajería push», o una red, VPN o bloqueador que corta FCM.
 */
export const PUSH_SERVICE_UNAVAILABLE =
  'Tu navegador no ha podido conectar con su servicio de notificaciones. En Brave, activa «Usar servicios de Google para mensajería push» en brave://settings/privacy; si no, prueba sin VPN ni bloqueadores o con otro navegador.';

async function subscribe(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(PUSH_SERVICE_UNAVAILABLE);
    }
    throw err;
  }
}

/** Suscribe este dispositivo (si hace falta) y lo registra en el servidor. Requiere permiso concedido. */
export async function syncPushSubscription(publicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await subscribe(registration, publicKey);
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Suscripción push incompleta');
  }
  await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

/** Pide permiso y suscribe el dispositivo. @return si quedan activados los avisos */
export async function enablePush(publicKey: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== 'granted') return false;
  await syncPushSubscription(publicKey);
  return true;
}

/**
 * Da de baja este dispositivo al cerrar sesión, para que el siguiente usuario no reciba los avisos.
 * No necesita sesión: el servicio push responderá 410 y el servidor borrará la suscripción.
 */
export async function unsubscribeThisDevice(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
}
