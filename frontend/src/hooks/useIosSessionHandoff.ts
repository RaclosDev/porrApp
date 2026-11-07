import { useEffect } from 'react';
import { prepareSessionHandoff } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { useInstallState } from './useInstallState';

/** El código vive 30 minutos en el servidor: se renueva antes de que caduque. */
const RENEW_MS = 20 * 60 * 1000;
/** Volver a la pestaña lo renueva, pero no más de una vez por minuto. */
const MIN_GAP_MS = 60 * 1000;

/**
 * En el navegador del iPhone, con sesión iniciada, mantiene listo el código de traspaso a la app
 * instalada. Así llega a la app aunque se añada a la pantalla de inicio desde «Compartir» sin abrir
 * la guía de instalación. Cada cuenta tiene un solo código, y otro navegador puede haberlo
 * reemplazado: por eso se renueva también al volver a la pestaña.
 */
export function useIosSessionHandoff(): void {
  const signedIn = useAppStore((state) => state.isAuthenticated && !state.isDemoMode);
  const onIosBrowser = useInstallState() === 'ios';
  const eligible = signedIn && onIosBrowser;

  useEffect(() => {
    if (!eligible) return;
    let preparedAt = -Infinity;
    const prepare = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - preparedAt < MIN_GAP_MS) return;
      preparedAt = Date.now();
      void prepareSessionHandoff();
    };
    prepare();
    const timer = setInterval(prepare, RENEW_MS);
    document.addEventListener('visibilitychange', prepare);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', prepare);
    };
  }, [eligible]);
}
