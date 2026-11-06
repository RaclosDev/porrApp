import {
  getAnalyticsConsent,
  initAnalytics,
  isAnalyticsAvailable,
  resetAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '../../services/analytics';

const gaScripts = () => document.querySelectorAll('script[src*="googletagmanager.com"]');

describe('analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelectorAll('script').forEach((script) => script.remove());
  });

  it('no hay elección hasta que el visitante decide', () => {
    expect(getAnalyticsConsent()).toBeNull();
  });

  it('guarda la elección y avisa a los suscriptores', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAnalyticsConsent(listener);

    setAnalyticsConsent('denied');
    expect(getAnalyticsConsent()).toBe('denied');

    resetAnalyticsConsent();
    expect(getAnalyticsConsent()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('ignora valores guardados que no son una elección válida', () => {
    localStorage.setItem('porrapp:analytics-consent', 'quizas');
    expect(getAnalyticsConsent()).toBeNull();
  });

  it('fuera de porrapp.app no carga Google Analytics aunque se acepte', () => {
    expect(isAnalyticsAvailable()).toBe(false);
    setAnalyticsConsent('granted');
    initAnalytics();
    expect(gaScripts()).toHaveLength(0);
  });
});
