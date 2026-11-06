import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  getAnalyticsConsent,
  isAnalyticsAvailable,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '../../services/analytics';

/** true mientras el visitante no haya aceptado ni rechazado la analítica. */
export function useAnalyticsConsentPending(): boolean {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => null);
  return consent === null && isAnalyticsAvailable();
}

/** Aviso de cookies de analítica: aceptar y rechazar cuestan lo mismo. */
export default function CookieConsent() {
  const pending = useAnalyticsConsentPending();
  if (!pending) return null;

  return (
    <div
      role="region"
      aria-label="Cookies de analítica"
      className="paper-panel album-sheet landing-tape fixed bottom-[calc(90px_+_env(safe-area-inset-bottom,_0px))] md:bottom-5 left-1/2 z-[999999] flex w-[90%] max-w-[380px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-[4px] border border-[var(--ink)] px-5 py-[15px] shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
    >
      <p className="m-0 text-center text-main text-[0.92rem] leading-[1.45]">
        ¿Nos dejas usar cookies de Google Analytics para saber cuánta gente usa PorrApp y qué
        mejorar? Sin publicidad ni perfiles.{' '}
        <Link to="/privacidad" className="underline">
          Más información
        </Link>
      </p>
      <div className="mt-[5px] flex gap-2.5">
        <button
          type="button"
          onClick={() => setAnalyticsConsent('granted')}
          className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsConsent('denied')}
          className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
