import toast from 'react-hot-toast';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import {
  loginWithGoogle,
  loginWithPasskey,
  setAuthToken,
  startPasskeyLogin,
} from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { LoginResponse } from '../types/api';
import { errorMessage } from '../utils/errors';
import { getPasskey, isPasskeyCancel } from '../utils/webauthn';

/**
 * Tras un inicio de sesión correcto (con Google o con llave de acceso): guarda el access token,
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

  return async (): Promise<boolean> => {
    try {
      const { requestId, options } = await startPasskeyLogin();
      const credential = await getPasskey(options);
      completeSignIn(await loginWithPasskey(requestId, credential), navigate, navigateAfterLogin);
      return true;
    } catch (err) {
      if (!isPasskeyCancel(err)) {
        toast.error(errorMessage(err, 'No se ha podido entrar con la llave de acceso'));
      }
      return false;
    }
  };
}
