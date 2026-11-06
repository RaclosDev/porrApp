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
  return finishPasskeyRegistration(requestId, credential, deviceName());
}

/** El dispositivo ya tenía una llave de esta cuenta: el navegador se niega a crear otra. */
export function isDuplicatePasskey(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError';
}
