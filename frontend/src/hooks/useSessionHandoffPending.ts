import { useEffect, useState } from 'react';
import { isRedeemingHandoff, whenSessionRestored } from '../services/api';
import { useAppStore } from '../store/useAppStore';

/** Si el perfil no llega en este tiempo, se muestra la portada como antes. */
const PROFILE_WAIT_MS = 8000;

/**
 * Primera apertura de la app instalada en iPhone: mientras se canjea el traspaso de sesión de
 * Safari y, si sale bien, mientras llega el perfil, la portada de visitante sería un parpadeo
 * engañoso. True durante esa espera.
 */
export function useSessionHandoffPending(): boolean {
  const [redeeming, setRedeeming] = useState(isRedeemingHandoff);
  const [awaitingProfile, setAwaitingProfile] = useState(false);
  const profileLoaded = useAppStore(
    (state) => Boolean(state.userName) || state.profileSetupCompleted !== null,
  );

  useEffect(() => {
    if (!redeeming) return;
    let active = true;
    void whenSessionRestored()?.then((result) => {
      if (!active) return;
      setAwaitingProfile(result === 'restored');
      setRedeeming(false);
    });
    return () => {
      active = false;
    };
  }, [redeeming]);

  useEffect(() => {
    if (!awaitingProfile) return;
    const timer = setTimeout(() => setAwaitingProfile(false), PROFILE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingProfile]);

  return redeeming || (awaitingProfile && !profileLoaded);
}
