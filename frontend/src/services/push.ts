import { savePushSubscription } from './api';

/** El navegador puede recibir avisos push (en iOS, solo con la app añadida a la pantalla de inicio). */
export function isPushSupported(): boolean {
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

/** Suscribe este dispositivo (si hace falta) y lo registra en el servidor. Requiere permiso concedido. */
export async function syncPushSubscription(publicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
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
