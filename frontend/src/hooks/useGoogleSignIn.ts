import toast from 'react-hot-toast';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import {
  confirmRegistration,
  loginWithApple,
  loginWithGoogle,
  loginWithPasskey,
  loginWithPassword,
  registerWithPassword,
  resetPassword,
  setAuthToken,
  startPasskeyLogin,
} from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { LoginResponse } from '../types/api';
import { errorMessage } from '../utils/errors';
import { getPasskey, isPasskeyCancel } from '../utils/webauthn';
import {
  markDeviceHasPasskey,
  markPasskeyPromptAnswered,
  notePasskeyAutoCancel,
} from '../utils/passkeyPrompt';
import { isAppleCancel, signInWithApple } from '../utils/appleSignIn';

export interface SignInOptions {
  /** Ir a la invitación pendiente, a `redirectTo` o a «Mis ligas» al entrar. */
  navigateAfterLogin?: boolean;
  /** Adónde ir al entrar si no hay invitación pendiente (por ejemplo, a crear la liga). */
  redirectTo?: string;
}

/**
 * Tras un inicio de sesión correcto (con Google, Apple, contraseña o llave de acceso): guarda el
 * access token, rellena el store y lleva a la invitación pendiente, a `redirectTo` o a «Mis ligas»
 * si el usuario aún no ha elegido ninguna.
 */
function completeSignIn(
  data: LoginResponse,
  navigate: NavigateFunction,
  { navigateAfterLogin = true, redirectTo }: SignInOptions,
  newAccount = false,
) {
  setAuthToken(data.token);

  const store = useAppStore.getState();
  store.setIsAuthenticated(true);
  store.setUserName(data.participantName);
  if (data.userId) store.setUserId(String(data.userId));
  store.setUserAvatarUrl(data.avatarUrl || '');
  if (data.lastSelectedGroupId && data.lastSelectedGroupId > 0) {
    // Pasar por changeGroup para que el store quede sincronizado con localStorage.
    store.changeGroup(data.lastSelectedGroupId);
  }

  // Una cuenta nueva aún lleva el apodo provisional (sacado del email): no se saluda con él.
  toast.success(
    newAccount ? '¡Cuenta creada! Bienvenido a PorrApp' : `¡Hola, ${data.participantName}!`,
  );
  if (navigateAfterLogin) {
    const pendingCode = localStorage.getItem('pendingJoinCode');
    if (pendingCode) navigate(`/join/${encodeURIComponent(pendingCode)}`, { replace: true });
    else if (redirectTo) navigate(redirectTo);
    else if (!localStorage.getItem('activeGroupId')) navigate('/mis-ligas');
  }
}

/**
 * Inicia sesión con la credencial de Google. Devuelve si el inicio de sesión ha ido bien.
 */
export function useGoogleSignIn(options: SignInOptions = {}) {
  const navigate = useNavigate();

  return async (credentialResponse: CredentialResponse): Promise<boolean> => {
    if (!credentialResponse.credential) {
      toast.error('Google no ha devuelto ninguna credencial.');
      return false;
    }
    try {
      completeSignIn(await loginWithGoogle(credentialResponse.credential), navigate, options);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Error al iniciar sesión con Google'));
      return false;
    }
  };
}

/**
 * Inicia sesión con una llave de acceso: el dispositivo ofrece las cuentas que tiene guardadas y
 * pide Face ID, huella o PIN. Devuelve si el inicio de sesión ha ido bien.
 */
export function usePasskeySignIn(signInOptions: SignInOptions = {}) {
  const navigate = useNavigate();

  /**
   * @param automatic   la abre la app sola al pedir acceso: entonces no se muestran errores
   * @param conditional se ofrece en el autocompletado del campo de email
   * @param signal      para cancelarla
   */
  return async ({
    automatic = false,
    conditional = false,
    signal,
  }: {
    automatic?: boolean;
    conditional?: boolean;
    signal?: AbortSignal;
  } = {}): Promise<boolean> => {
    try {
      const { requestId, options } = await startPasskeyLogin();
      if (signal?.aborted) return false;
      const credential = await getPasskey(options, { conditional, signal });
      const data = await loginWithPasskey(requestId, credential);
      // Este dispositivo ya tiene llave: no hace falta ofrecer añadir otra, y la próxima vez se
      // ofrece sola.
      markPasskeyPromptAnswered(data.userId);
      markDeviceHasPasskey();
      completeSignIn(data, navigate, signInOptions);
      return true;
    } catch (err) {
      if (isPasskeyCancel(err) || signal?.aborted) {
        if (automatic) notePasskeyAutoCancel();
      } else if (!automatic) {
        toast.error(errorMessage(err, 'No se ha podido entrar con la llave de acceso'));
      }
      return false;
    }
  };
}

/**
 * Inicia sesión con Apple (ventana emergente de Apple). Devuelve si el inicio de sesión ha ido
 * bien; si la persona cierra la ventana no se muestra ningún error.
 */
export function useAppleSignIn(options: SignInOptions = {}) {
  const navigate = useNavigate();

  return async (): Promise<boolean> => {
    try {
      const { idToken, name } = await signInWithApple();
      completeSignIn(await loginWithApple(idToken, name), navigate, options);
      return true;
    } catch (err) {
      if (!isAppleCancel(err)) {
        toast.error(errorMessage(err, 'No se ha podido iniciar sesión con Apple'));
      }
      return false;
    }
  };
}

export type EmailSignInMode = 'login' | 'register';

/** Tras enviar el formulario: ya hay sesión, o hay que escribir el código que llega al email. */
export type EmailSignInResult = 'signed-in' | 'code-sent';

/**
 * Entra o crea una cuenta con email y contraseña, sin Google. Crear la cuenta suele pedir antes el
 * código que llega al email (`confirm`). Si falla lanza el error con el mensaje del servidor, para
 * que el formulario lo muestre junto a los campos.
 */
export function useEmailSignIn(options: SignInOptions = {}) {
  const navigate = useNavigate();

  const signIn = async (
    mode: EmailSignInMode,
    email: string,
    password: string,
  ): Promise<EmailSignInResult> => {
    if (mode === 'login') {
      completeSignIn(await loginWithPassword(email, password), navigate, options);
      return 'signed-in';
    }
    const result = await registerWithPassword(email, password);
    if ('verificationRequired' in result) return 'code-sent';
    completeSignIn(result, navigate, options, true);
    return 'signed-in';
  };

  const confirm = async (email: string, code: string, password: string): Promise<void> => {
    completeSignIn(await confirmRegistration(email, code, password), navigate, options, true);
  };

  return { signIn, confirm };
}

/**
 * Pone la contraseña nueva con el enlace del correo y entra: a la invitación pendiente si la hay
 * o a la portada.
 */
export function usePasswordReset() {
  const navigate = useNavigate();

  return async (token: string, password: string): Promise<void> => {
    const data = await resetPassword(token, password);
    completeSignIn(data, navigate, { navigateAfterLogin: false });
    const pendingCode = localStorage.getItem('pendingJoinCode');
    navigate(pendingCode ? `/join/${encodeURIComponent(pendingCode)}` : '/', { replace: true });
  };
}
