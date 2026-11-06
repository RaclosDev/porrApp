/**
 * Google Analytics 4 con consentimiento previo (Consent Mode v2, modo básico).
 *
 * El script de Google no se descarga hasta que el visitante acepta la analítica: sin
 * aceptación no hay cookies ni peticiones a Google. La elección se guarda en localStorage
 * y se puede cambiar desde la política de privacidad.
 */
export const GA_MEASUREMENT_ID = 'G-9MJJ2EGSLD';

const CONSENT_KEY = 'porrapp:analytics-consent';
/** Solo se mide el dominio público; en local, previews o el dominio antiguo no se carga. */
const ANALYTICS_HOSTS = ['porrapp.app'];

export type AnalyticsConsent = 'granted' | 'denied';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const listeners = new Set<() => void>();
let loaded = false;

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function isAnalyticsAvailable(): boolean {
  return typeof window !== 'undefined' && ANALYTICS_HOSTS.includes(window.location.hostname);
}

export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Sin almacenamiento la elección vale solo para esta visita.
  }
  if (consent === 'granted') {
    loadAnalytics();
  } else if (loaded) {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    clearAnalyticsCookies();
  }
  listeners.forEach((listener) => listener());
}

/** Vuelve a mostrar el aviso para que el visitante cambie su elección. */
export function resetAnalyticsConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Nada que borrar.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Carga GA solo si el visitante ya lo aceptó en una visita anterior. */
export function initAnalytics(): void {
  if (getAnalyticsConsent() === 'granted') loadAnalytics();
}

function loadAnalytics(): void {
  if (loaded || !isAnalyticsAvailable()) return;
  loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js espera el objeto arguments, no un array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  window.gtag('js', new Date());
  // Las vistas de página de la SPA las mide la medición mejorada (cambios de historial).
  window.gtag('config', GA_MEASUREMENT_ID, { allow_google_signals: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function clearAnalyticsCookies(): void {
  const domain = window.location.hostname;
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const scope of ['', `; domain=${domain}`, `; domain=.${domain}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${scope}`;
      }
    }
  });
}
