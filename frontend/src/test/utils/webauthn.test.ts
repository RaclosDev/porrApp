import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  createPasskey,
  deviceName,
  getPasskey,
  isPasskeyCancel,
} from '../../utils/webauthn';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

afterEach(() => {
  vi.unstubAllGlobals();
});

it('round-trips binary data through base64url without padding', () => {
  const data = bytes(0xfb, 0xff, 0x00, 0x10);
  const encoded = bufferToBase64Url(data);

  expect(encoded).toBe('-_8AEA');
  expect(new Uint8Array(base64UrlToBuffer(encoded))).toEqual(new Uint8Array(data));
});

describe('createPasskey', () => {
  it('decodes the server options and encodes the new key for the server', async () => {
    const create = vi.fn().mockResolvedValue({
      type: 'public-key',
      id: 'AQI',
      rawId: bytes(1, 2),
      response: {
        clientDataJSON: bytes(3),
        attestationObject: bytes(4),
        getTransports: () => ['internal'],
      },
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
    });
    vi.stubGlobal('navigator', { credentials: { create } });

    const json = await createPasskey({
      publicKey: {
        challenge: 'BQY',
        user: { id: 'Bw', name: 'ana@example.com', displayName: 'Ana' },
        excludeCredentials: [{ type: 'public-key', id: 'CA' }],
      },
    });

    const options = create.mock.calls[0][0].publicKey;
    expect(new Uint8Array(options.challenge)).toEqual(new Uint8Array([5, 6]));
    expect(new Uint8Array(options.user.id)).toEqual(new Uint8Array([7]));
    expect(options.user.name).toBe('ana@example.com');
    expect(new Uint8Array(options.excludeCredentials[0].id)).toEqual(new Uint8Array([8]));
    expect(json).toEqual({
      type: 'public-key',
      id: 'AQI',
      rawId: 'AQI',
      response: { clientDataJSON: 'Aw', attestationObject: 'BA', transports: ['internal'] },
      clientExtensionResults: { credProps: { rk: true } },
    });
  });
});

describe('getPasskey', () => {
  it('signs the challenge and sends back the user handle', async () => {
    const get = vi.fn().mockResolvedValue({
      type: 'public-key',
      id: 'AQI',
      rawId: bytes(1, 2),
      response: {
        clientDataJSON: bytes(3),
        authenticatorData: bytes(4),
        signature: bytes(5),
        userHandle: bytes(6),
      },
      getClientExtensionResults: () => ({}),
    });
    vi.stubGlobal('navigator', { credentials: { get } });

    const json = await getPasskey({ publicKey: { challenge: 'CQ', userVerification: 'required' } });

    const options = get.mock.calls[0][0].publicKey;
    expect(new Uint8Array(options.challenge)).toEqual(new Uint8Array([9]));
    // Sin lista de llaves: el dispositivo ofrece las que tenga de este sitio.
    expect(options.allowCredentials).toBeUndefined();
    expect(json.response).toEqual({
      clientDataJSON: 'Aw',
      authenticatorData: 'BA',
      signature: 'BQ',
      userHandle: 'Bg',
    });
    expect(get.mock.calls[0][0].mediation).toBeUndefined();
  });

  it('can offer the passkeys in the email autofill and be cancelled', async () => {
    const get = vi.fn().mockResolvedValue({
      type: 'public-key',
      id: 'AQI',
      rawId: bytes(1),
      response: { clientDataJSON: bytes(3), authenticatorData: bytes(4), signature: bytes(5) },
      getClientExtensionResults: () => ({}),
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    const controller = new AbortController();

    await getPasskey(
      { publicKey: { challenge: 'CQ' } },
      { conditional: true, signal: controller.signal },
    );

    expect(get.mock.calls[0][0].mediation).toBe('conditional');
    expect(get.mock.calls[0][0].signal).toBe(controller.signal);
  });
});

it('treats a cancelled system dialog as a cancel, not as an error', () => {
  expect(isPasskeyCancel(new DOMException('cancelado', 'NotAllowedError'))).toBe(true);
  expect(isPasskeyCancel(new DOMException('cancelada', 'AbortError'))).toBe(true);
  expect(isPasskeyCancel(new DOMException('otra', 'InvalidStateError'))).toBe(false);
  expect(isPasskeyCancel(new Error('red'))).toBe(false);
});

it.each([
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone'],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Android'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Mac'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'],
  ['curl/8', 'Llave de acceso'],
])('names a new key after the device: %s', (userAgent, name) => {
  expect(deviceName(userAgent)).toBe(name);
});
