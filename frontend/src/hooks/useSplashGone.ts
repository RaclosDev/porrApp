import { useSyncExternalStore } from 'react';
import { isSplashGone, subscribeSplashGone } from '../services/splash';

/**
 * La pantalla de arranque ya no tapa la app. Las animaciones de entrada esperan a esto: si
 * arrancasen detrás, al quitarla se verían a medias y encima del fundido.
 */
export function useSplashGone(): boolean {
  return useSyncExternalStore(subscribeSplashGone, isSplashGone, () => true);
}
