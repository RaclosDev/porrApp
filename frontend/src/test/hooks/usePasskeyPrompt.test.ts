import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePasskeyPrompt } from '../../hooks/usePasskeyPrompt';
import { markPasskeyPromptAnswered } from '../../utils/passkeyPrompt';
import { passkeysSupported } from '../../utils/webauthn';

vi.mock('../../utils/webauthn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/webauthn')>()),
  passkeysSupported: vi.fn(() => true),
}));

const platformAvailable = vi.fn();

beforeEach(() => {
  localStorage.clear();
  platformAvailable.mockResolvedValue(true);
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: platformAvailable,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(passkeysSupported).mockReturnValue(true);
});

it('shows once the device confirms it has Face ID, Touch ID or a fingerprint', async () => {
  const { result } = renderHook(() => usePasskeyPrompt('7', true));

  await waitFor(() => expect(result.current.show).toBe(true));
});

it('stays hidden after answering, for that account on this device', async () => {
  const { result } = renderHook(() => usePasskeyPrompt('7', true));
  await waitFor(() => expect(result.current.show).toBe(true));

  act(() => {
    markPasskeyPromptAnswered('7');
    result.current.done();
  });

  expect(result.current.show).toBe(false);
  // Otra cuenta en el mismo dispositivo sí se pregunta.
  const other = renderHook(() => usePasskeyPrompt('8', true));
  await waitFor(() => expect(other.result.current.show).toBe(true));
});

it('stays hidden while inactive or without a platform authenticator', async () => {
  const inactive = renderHook(() => usePasskeyPrompt('7', false));
  expect(inactive.result.current.show).toBe(false);
  expect(platformAvailable).not.toHaveBeenCalled();

  platformAvailable.mockResolvedValue(false);
  const noFaceId = renderHook(() => usePasskeyPrompt('7', true));
  await waitFor(() => expect(platformAvailable).toHaveBeenCalled());
  expect(noFaceId.result.current.show).toBe(false);
});

it('stays hidden without a signed-in user id', () => {
  const { result } = renderHook(() => usePasskeyPrompt('', true));
  expect(result.current.show).toBe(false);
});
