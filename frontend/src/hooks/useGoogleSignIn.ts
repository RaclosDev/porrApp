import toast from 'react-hot-toast';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import {
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

/**
 * Tras un inicio de sesión correcto (con Google, Apple, contraseña o llave de acceso): guarda el access token,
 * rellena el store y lleva a "Mis ligas" si el usuario aún no ha elegido ninguna.
 */
function completeSignIn(
  data: LoginResponse,
  navigate: NavigateFunction,
  navigateAfterLogin: boolean,
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

  toast.success(`¡Bienvenido, ${data.participantName}!`);
  if (navigateAfterLogin) {
    const pendingCode = localStorage.getItem('pendingJoinCode');
    if (pendingCode) navigate(`/join/${encodeURIComponent(pendingCode)}`, { replace: true });
    else if (!localStorage.getItem('activeGroupId')) navigate('/mis-ligas');
  }
}

/**
 * Inicia sesión con la credencial de Google. Devuelve si el inicio de sesión ha ido bien.
 */
export function useGoogleSignIn({ navigateAfterLogin = true } = {}) {
  const navigate = useNavigate();

  return async (credentialResponse: CredentialResponse): Promise<boolean> => {
    if (!credentialResponse.credential) {
      toast.error('Google no ha devuelto ninguna credencial.');
      return false;
    }
    try {
      completeSignIn(
        await loginWithGoogle(credentialResponse.credential),
        navigate,
        navigateAfterLogin,
      );
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
export function usePasskeySignIn({ navigateAfterLogin = true } = {}) {
  const navigate = useNavigate();

  /** @param automatic la abre la app sola al pedir acceso: entonces no se muestran errores */
  return async ({ automatic = false } = {}): Promise<boolean> => {
    try {
      const { requestId, options } = await startPasskeyLogin();
      const credential = await getPasskey(options);
      const data = await loginWithPasskey(requestId, credential);
      // Este dispositivo ya tiene llave: no hace falta ofrecer añadir otra, y la próxima vez se
      // ofrece sola.
      markPasskeyPromptAnswered(data.userId);
      markDeviceHasPasskey();
      completeSignIn(data, navigate, navigateAfterLogin);
      return true;
    } catch (err) {
      if (isPasskeyCancel(err)) {
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
export function useAppleSignIn({ navigateAfterLogin = true } = {}) {
  const navigate = useNavigate();

  return async (): Promise<boolean> => {
    try {
      const { idToken, name } = await signInWithApple();
      completeSignIn(await loginWithApple(idToken, name), navigate, navigateAfterLogin);
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

/**
 * Entra o crea una cuenta con email y contraseña, sin Google. Si falla lanza el error con el
 * mensaje del servidor, para que el formulario lo muestre junto a los campos.
 */
export function useEmailSignIn({ navigateAfterLogin = true } = {}) {
  const navigate = useNavigate();

  return async (mode: EmailSignInMode, email: string, password: string): Promise<void> => {
    const data =
      mode === 'register'
        ? await registerWithPassword(email, password)
        : await loginWithPassword(email, password);
    completeSignIn(data, navigate, navigateAfterLogin);
  };
}

/**
 * Pone la contraseña nueva con el enlace del correo y entra: a la invitación pendiente si la hay
 * o a la portada.
 */
export function usePasswordReset() {
  const navigate = useNavigate();

  return async (token: string, password: string): Promise<void> => {
    const data = await resetPassword(token, password);
    completeSignIn(data, navigate, false);
    const pendingCode = localStorage.getItem('pendingJoinCode');
    navigate(pendingCode ? `/join/${encodeURIComponent(pendingCode)}` : '/', { replace: true });
  };
}
