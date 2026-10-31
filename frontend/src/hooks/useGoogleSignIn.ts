import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import { loginWithGoogle, setAuthToken } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { errorMessage } from '../utils/errors';

/**
 * Inicia sesión con la credencial de Google: guarda el access token en memoria, rellena el store
 * y lleva a "Mis ligas" si el usuario aún no ha elegido ninguna.
 * Devuelve si el inicio de sesión ha ido bien.
 */
export function useGoogleSignIn({ navigateAfterLogin = true } = {}) {
  const navigate = useNavigate();

  return async (credentialResponse: CredentialResponse): Promise<boolean> => {
    if (!credentialResponse.credential) {
      toast.error('Google no ha devuelto ninguna credencial.');
      return false;
    }
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
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
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Error al iniciar sesión con Google'));
      return false;
    }
  };
}
