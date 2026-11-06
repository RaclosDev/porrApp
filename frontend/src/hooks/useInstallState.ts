import { useSyncExternalStore } from 'react';
import { installState, subscribeInstallState, type InstallState } from '../services/installPrompt';

/** Estado de instalación de la PWA; se actualiza al llegar el aviso del navegador o al instalarla. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstallState, installState, () => 'unavailable');
}
