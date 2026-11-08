import { useEffect, useRef } from 'react';
import { usePasskeySignIn } from './useGoogleSignIn';
import { whenSessionRestored } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { passkeysSupported } from '../utils/webauthn';
import { shouldOpenPasskeyAutomatically } from '../utils/passkeyPrompt';

/**
 * Si este dispositivo ya entró con una llave de acceso, la pide en cuanto aparece la pantalla de
 * acceso (Face ID, huella o PIN) sin que haya que pulsar nada. Una vez cada vez que se muestra: si
 * la cierran, quedan los botones de siempre.
 *
 * @param active     la pantalla de acceso está a la vista
 * @param onSignedIn después de entrar (cerrar el diálogo, unirse a la liga…)
 */
export function usePasskeyAutoSignIn(
  active: boolean,
  onSignedIn?: () => void,
  { navigateAfterLogin = true } = {},
) {
  const passkeySignIn = usePasskeySignIn({ navigateAfterLogin });
  const tried = useRef(false);
  const latest = useRef({ passkeySignIn, onSignedIn });
  useEffect(() => {
    latest.current = { passkeySignIn, onSignedIn };
  });

  useEffect(() => {
    if (!active) {
      // Al volver a abrirse la pantalla de acceso se puede ofrecer otra vez.
      tried.current = false;
      return;
    }
    if (tried.current || !passkeysSupported() || !shouldOpenPasskeyAutomatically()) return;
    tried.current = true;
    let cancelled = false;
    let started = false;
    // Esperar a que acabe de recuperarse la sesión (o el traspaso a la app instalada): quizá ya
    // hay sesión y no hace falta pedir nada.
    void Promise.resolve(whenSessionRestored()).then(async () => {
      const { isAuthenticated, userName } = useAppStore.getState();
      if (cancelled || (isAuthenticated && userName)) return;
      started = true;
      if (await latest.current.passkeySignIn({ automatic: true })) latest.current.onSignedIn?.();
    });
    return () => {
      cancelled = true;
      // Si aún no se había abierto, que pueda abrirse cuando la pantalla vuelva a mostrarse.
      if (!started) tried.current = false;
    };
  }, [active]);
}
