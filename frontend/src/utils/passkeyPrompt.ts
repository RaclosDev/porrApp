/**
 * Aviso para añadir una llave de acceso: se pregunta una vez por cuenta y dispositivo. Cuenta como
 * respondido decir «Más tarde», añadir una llave o entrar con una (el dispositivo ya la tiene).
 */
import {
  finishPasskeyRegistration,
  startPasskeyRegistration,
  type PasskeySummary,
} from '../services/api';
import { createPasskey, deviceName } from './webauthn';

const ANSWERED_PREFIX = 'passkey_prompt_answered:';
const DEVICE_KEY = 'passkey_on_device';
/** Cancelaciones seguidas de la llave abierta sola tras las que se deja de abrir sola. */
const MAX_AUTO_CANCELS = 2;

/**
 * Este dispositivo tiene una llave de acceso de PorrApp: se añadió o se entró con ella aquí. Así la
 * pantalla de acceso puede pedir Face ID o huella nada más abrirse, sin pulsar nada.
 */
export function shouldOpenPasskeyAutomatically(): boolean {
  const value = Number(localStorage.getItem(DEVICE_KEY));
  // 1 = tiene llave; cada cancelación de la llave abierta sola suma uno.
  return value > 0 && value <= MAX_AUTO_CANCELS;
}

export function markDeviceHasPasskey(): void {
  localStorage.setItem(DEVICE_KEY, '1');
}

/**
 * Cerraron la llave que se abrió sola: quizá prefieren otra forma de entrar, o la llave ya no
 * existe. Tras varias seguidas deja de abrirse sola hasta que vuelvan a entrar con una llave.
 */
export function notePasskeyAutoCancel(): void {
  const value = Number(localStorage.getItem(DEVICE_KEY));
  if (value > 0) localStorage.setItem(DEVICE_KEY, String(value + 1));
}

export function passkeyPromptAnswered(userId: string): boolean {
  return localStorage.getItem(ANSWERED_PREFIX + userId) !== null;
}

export function markPasskeyPromptAnswered(userId: string | number | null | undefined): void {
  if (userId) localStorage.setItem(ANSWERED_PREFIX + userId, '1');
}

/** El dispositivo tiene Face ID, Touch ID, huella o Windows Hello para guardar una llave. */
export async function platformPasskeyAvailable(): Promise<boolean> {
  try {
    return (
      (await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()) === true
    );
  } catch {
    return false;
  }
}

/** Crea una llave en este dispositivo y la guarda en la cuenta con el nombre del dispositivo. */
export async function addPasskeyOnThisDevice(): Promise<PasskeySummary> {
  const { requestId, options } = await startPasskeyRegistration();
  const credential = await createPasskey(options);
  const saved = await finishPasskeyRegistration(requestId, credential, deviceName());
  markDeviceHasPasskey();
  return saved;
}

/** El dispositivo ya tenía una llave de esta cuenta: el navegador se niega a crear otra. */
export function isDuplicatePasskey(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError';
}
