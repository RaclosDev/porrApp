/**
 * Puente entre el JSON de WebAuthn del servidor (binarios en base64url) y la API del navegador
 * (ArrayBuffer). Sin dependencias: solo convierte los campos binarios que usa el servidor.
 */

type Json = Record<string, unknown>;

/** Opciones tal como las manda el servidor: `{ publicKey: {...} }`. */
export interface BrowserOptions {
  publicKey: Json;
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const withBinaryIds = (list: unknown) =>
  Array.isArray(list)
    ? list.map((item: Json) => ({ ...item, id: base64UrlToBuffer(item.id as string) }))
    : undefined;

/** El navegador admite llaves de acceso. */
export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator.credentials?.get === 'function'
  );
}

/** Pide al dispositivo que cree una llave y devuelve su respuesta en JSON para el servidor. */
export async function createPasskey({ publicKey }: BrowserOptions): Promise<Json> {
  const user = publicKey.user as Json;
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...publicKey,
      challenge: base64UrlToBuffer(publicKey.challenge as string),
      user: { ...user, id: base64UrlToBuffer(user.id as string) },
      excludeCredentials: withBinaryIds(publicKey.excludeCredentials),
    } as unknown as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('Sin llave', 'NotAllowedError');
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    type: credential.type,
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

/** Pide al dispositivo que firme con una de sus llaves y devuelve la respuesta en JSON. */
export async function getPasskey({ publicKey }: BrowserOptions): Promise<Json> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...publicKey,
      challenge: base64UrlToBuffer(publicKey.challenge as string),
      allowCredentials: withBinaryIds(publicKey.allowCredentials),
    } as unknown as PublicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('Sin llave', 'NotAllowedError');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    type: credential.type,
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

/** La persona canceló el diálogo del sistema o se agotó el tiempo: no es un error que mostrar. */
export function isPasskeyCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

/** Nombre por defecto de una llave nueva, según el dispositivo. */
export function deviceName(userAgent = navigator.userAgent): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  return 'Llave de acceso';
}
