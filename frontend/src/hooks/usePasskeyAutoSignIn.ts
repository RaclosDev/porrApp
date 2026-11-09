import { useEffect, useRef } from 'react';
import { usePasskeySignIn, type SignInOptions } from './useGoogleSignIn';
import { whenSessionRestored } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { conditionalPasskeysAvailable, passkeysSupported } from '../utils/webauthn';
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
  options: SignInOptions = {},
) {
  const passkeySignIn = usePasskeySignIn(options);
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

/**
 * Ofrece las llaves de acceso en el autocompletado del campo de email (mediación condicional), en
 * los dispositivos donde no se abren solas: por ejemplo, una llave sincronizada desde otro.
 * Devuelve una función para cancelarla antes de pedir la llave con el botón (el navegador solo
 * admite una petición a la vez).
 *
 * @param active el formulario de entrar está a la vista
 */
export function useConditionalPasskey(
  active: boolean,
  onSignedIn?: () => void,
  options: SignInOptions = {},
): () => void {
  const passkeySignIn = usePasskeySignIn(options);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef({ passkeySignIn, onSignedIn });
  useEffect(() => {
    latest.current = { passkeySignIn, onSignedIn };
  });

  useEffect(() => {
    if (!active || shouldOpenPasskeyAutomatically()) return;
    const current = new AbortController();
    controller.current = current;
    void conditionalPasskeysAvailable().then(async (available) => {
      if (!available || current.signal.aborted) return;
      const ok = await latest.current.passkeySignIn({ conditional: true, signal: current.signal });
      if (ok) latest.current.onSignedIn?.();
    });
    return () => current.abort();
  }, [active]);

  return () => controller.current?.abort();
}
