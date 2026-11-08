import { afterEach, expect, it, vi } from 'vitest';
import { isAppleCancel, signInWithApple } from '../../utils/appleSignIn';

afterEach(() => {
  delete window.AppleID;
});

it('opens the Apple popup and returns the token and the name Apple gives the first time', async () => {
  const init = vi.fn();
  window.AppleID = {
    auth: {
      init,
      signIn: vi.fn().mockResolvedValue({
        authorization: { id_token: 'apple-token', code: 'code' },
        user: { name: { firstName: 'Nuria', lastName: 'Gil' } },
      }),
    },
  };

  await expect(signInWithApple()).resolves.toEqual({ idToken: 'apple-token', name: 'Nuria Gil' });
  expect(init).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: 'name email',
      usePopup: true,
      redirectURI: `${location.origin}/`,
    }),
  );
});

it('has no name on later sign-ins', async () => {
  window.AppleID = {
    auth: {
      init: vi.fn(),
      signIn: vi.fn().mockResolvedValue({ authorization: { id_token: 't', code: 'c' } }),
    },
  };

  await expect(signInWithApple()).resolves.toEqual({ idToken: 't', name: undefined });
});

it('treats closing the Apple window as a cancel, not an error', () => {
  expect(isAppleCancel({ error: 'popup_closed_by_user' })).toBe(true);
  expect(isAppleCancel({ error: 'user_cancelled_authorize' })).toBe(true);
  expect(isAppleCancel(new Error('red'))).toBe(false);
});
