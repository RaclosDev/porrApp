import ActiveLeagueDropdown from './ActiveLeagueDropdown';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, Suspense } from 'react';
import { lazyPage } from '../services/chunkReload';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import ProfileSettingsModal, { type SettingsSection } from './ProfileSettingsModal';
import { useAppStore } from '../store/useAppStore';
import MobileBottomNav from './MobileBottomNav';
import DemoBanner from './layout/DemoBanner';
import MainNav from './layout/MainNav';
import HeaderActions from './layout/HeaderActions';
import InstallBanner from './layout/InstallBanner';
import PushReminderPrompt from './layout/PushReminderPrompt';
import PasskeyPrompt from './layout/PasskeyPrompt';
import { usePasskeyPrompt } from '../hooks/usePasskeyPrompt';
import { useAnalyticsConsentPending } from './layout/CookieConsent';
import LoginModal from './layout/LoginModal';
import { OPEN_LOGIN_EVENT, type LoginModalRequest } from '../utils/loginModal';
import { promptInstall } from '../services/installPrompt';
import { useInstallState } from '../hooks/useInstallState';
import { useSessionHandoffPending } from '../hooks/useSessionHandoffPending';
import { useIosSessionHandoff } from '../hooks/useIosSessionHandoff';
import { leagueNavItems, showsFillBracketButton } from './layout/leagueNav';

const PredictionViewer = lazyPage(() => import('./PredictionViewer'));

/** Páginas a las que puede ir quien tiene sesión pero aún no tiene ninguna liga. */
const noLeagueAllowed = (pathname: string) =>
  pathname === '/mis-ligas' ||
  pathname === '/crear-liga' ||
  pathname.startsWith('/torneos/') ||
  pathname.startsWith('/t/') ||
  pathname.startsWith('/join/') ||
  // Una liga de juegos de mesa se crea aunque no haya ninguna otra liga.
  pathname === '/marcador/nuevo' ||
  pathname.startsWith('/linkedin');

/**
 * Componente Layout principal que envuelve a todas las rutas.
 * Contiene la barra de navegación superior (Header), el manejo de autenticación global (Google Login),
 * el banner de instalación PWA, y el visor global de porras (PredictionViewer).
 *
 * @component
 */
function Layout({ children }: { children: React.ReactNode }) {
  const {
    userName,
    viewerPredictionId,
    leagueKind,
    loading,
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    isAuthenticated,
    userGroups,
    userGroupsLoaded,
  } = useAppContext();
  // Basta con los pronósticos propios: la lista de toda la liga solo la piden las pantallas que la usan.
  const myPrediction = useMyLeaguePrediction();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Con qué intención se abrió el diálogo de acceso (crear cuenta o entrar) y adónde ir después.
  const [loginRequest, setLoginRequest] = useState<LoginModalRequest>({});
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  // Ajustes de cuenta abiertos y en qué sección: «Avisos» abre directamente la suya.
  const [profileSettings, setProfileSettings] = useState<SettingsSection | null>(null);
  const [pushPromptVisible, setPushPromptVisible] = useState(false);
  const showProfileSettings = profileSettings != null;
  const profileSetupCompleted = useAppStore((state) => state.profileSetupCompleted);
  const userAvatarUrl = useAppStore((state) => state.userAvatarUrl);
  const userId = useAppStore((state) => state.userId);
  const logout = useAppStore((state) => state.logout);

  const installState = useInstallState();
  const [installBannerDismissed, setInstallBannerDismissed] = useState(
    () => localStorage.getItem('pwa_banner_dismissed') === 'true',
  );
  // El aviso de cookies va primero; los demás avisos inferiores esperan a que se resuelva.
  const consentPending = useAnalyticsConsentPending();
  const showInstallBanner = !installBannerDismissed && installState === 'native' && !consentPending;

  const isUserLoggedIn = isAuthenticated && Boolean(userName);
  const sessionPending = useSessionHandoffPending();
  useIosSessionHandoff();

  const location = useLocation();
  const isDemo = isDemoMode;

  // La portada es la portada aunque quede guardado el modo demo de una visita anterior: sin
  // sesión, «/» siempre muestra la landing, sin la barra ni el menú de la demo.
  const isLanding = location.pathname === '/' && !isUserLoggedIn;
  // En la pantalla de acceso/invitación no mostrar la navegación global: la propia
  // pantalla ya contiene el acceso con Google y el contexto de la invitación.
  const isInviteAuthScreen =
    location.pathname.startsWith('/t/') ||
    location.pathname.startsWith('/torneos/') ||
    location.pathname.startsWith('/join/') ||
    (!isUserLoggedIn && location.pathname === '/mis-ligas');

  // Con sesión iniciada pero sin ninguna liga, la navegación queda bloqueada:
  // solo se puede crear o unirse a una liga desde Mis Ligas.
  const isNavLocked =
    isAuthenticated && userGroupsLoaded && userGroups.length === 0 && !isLanding && !isDemo;

  // Un usuario autenticado sin ninguna liga solo puede crear o unirse a una.
  const isNoLeagueAllowedPath = noLeagueAllowed(location.pathname);

  // Los permisos de notificación van tras completar el perfil y el consentimiento de cookies.
  // Los avisos de instalación y llave de acceso esperan a que se cierre esa petición.
  const bottomPromptFree = !showInstallBanner && !isLanding && !consentPending;
  const passkeyPrompt = usePasskeyPrompt(
    userId,
    isUserLoggedIn &&
      !isDemo &&
      !pushPromptVisible &&
      bottomPromptFree &&
      profileSetupCompleted !== false &&
      !showProfileSettings,
  );

  useEffect(() => {
    if (!isNavLocked || isNoLeagueAllowedPath) return;
    // Al entrar, la sesión se aplica antes que la navegación en curso (p. ej. a crear la liga):
    // si la URL ya apunta a una página permitida, no se pisa.
    if (noLeagueAllowed(window.location.pathname)) return;
    navigate('/mis-ligas', { replace: true });
  }, [isNavLocked, isNoLeagueAllowedPath, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLoginModal(false);
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenLogin = (event: Event) => {
      setLoginRequest((event as CustomEvent<LoginModalRequest | null>).detail ?? {});
      setShowLoginModal(true);
    };
    window.addEventListener(OPEN_LOGIN_EVENT, handleOpenLogin);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, handleOpenLogin);
  }, []);

  // Abierto desde la cabecera, la demo o una ruta privada: entrar, sin destino especial.
  useEffect(() => {
    if (!showLoginModal) setLoginRequest({});
  }, [showLoginModal]);

  /**
   * Efecto para forzar la apertura del modal de login si la ruta a la que se
   * redirigió requería estar logueado (via location.state).
   */
  useEffect(() => {
    if (location.state?.requireLogin) {
      setShowLoginModal(true);
    }
  }, [location.state]);

  const handleInstallClick = () => {
    void promptInstall();
  };

  const handleDismissBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setInstallBannerDismissed(true);
  };

  return (
    <>
      {isDemo && !isUserLoggedIn && !isLanding && (
        <DemoBanner
          exitDemoMode={exitDemoMode}
          navigate={navigate}
          setShowLoginModal={setShowLoginModal}
        />
      )}

      <header className={`top-bar${isLanding ? ' top-bar--landing' : ''}`}>
        <div className="header-left">
          <div className="header-title-row flex items-center gap-[15px] flex-nowrap">
            <NavLink
              to={isUserLoggedIn ? '/' : isDemo && !isLanding ? '/demo' : '/'}
              className="header-brand-link"
              onClick={(e) => {
                if (isNavLocked) e.preventDefault();
              }}
              aria-disabled={isNavLocked || undefined}
            >
              <span>PorrApp</span>
            </NavLink>

            {isLanding || isInviteAuthScreen || (!isUserLoggedIn && !isDemo) ? null : isDemo ? (
              <span className="ink-stamp ink-stamp-sm ink-stamp-ink inline-block min-w-0 truncate">
                Demo
              </span>
            ) : (
              <>
                <ActiveLeagueDropdown />

                {loading ||
                !showsFillBracketButton(leagueKind) ||
                (userName && myPrediction) ? null : (
                  <button
                    id="btn-complete-my-prediction-header"
                    className={`glass-btn primary-btn header-porra-cta py-1.5 px-3.5 min-h-9.5 rounded-[10px] font-bold text-[0.85rem] whitespace-nowrap ${isNavLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${isNavLocked ? 'opacity-[0.4]' : 'opacity-[1]'}`}
                    onClick={() => navigate('/prediction')}
                    disabled={isNavLocked}
                    aria-label="Rellenar mi porra"
                    title="Rellenar mi porra"
                  >
                    <span className="header-porra-cta-label">Rellenar mi porra</span>
                    <span className="header-porra-cta-short" aria-hidden="true">
                      Rellenar
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!isLanding && !isInviteAuthScreen && (
          <MainNav items={leagueNavItems(leagueKind, isDemo)} isNavLocked={isNavLocked} />
        )}

        {!isInviteAuthScreen && (
          <HeaderActions
            enterDemoMode={enterDemoMode}
            isLanding={isLanding}
            isUserLoggedIn={isUserLoggedIn}
            sessionPending={sessionPending}
            navigate={navigate}
            onLogout={() => {
              logout();
              navigate('/', { replace: true });
            }}
            setShowLoginModal={setShowLoginModal}
            setShowProfileMenu={setShowProfileMenu}
            onOpenSettings={setProfileSettings}
            showProfileMenu={showProfileMenu}
            showNotificationBell={isUserLoggedIn && !isDemo}
            userAvatarUrl={userAvatarUrl}
            userId={userId}
            userName={userName}
          />
        )}
      </header>

      <main className={`app-container ${!isLanding ? 'has-mobile-bottom-nav' : ''}`}>
        {isNavLocked && !isNoLeagueAllowedPath ? null : children}
      </main>

      {(showProfileSettings ||
        (isUserLoggedIn && !isDemo && !isInviteAuthScreen && profileSetupCompleted === false)) && (
        <ProfileSettingsModal
          onboarding={!showProfileSettings && profileSetupCompleted === false}
          section={profileSettings ?? 'account'}
          onClose={() => setProfileSettings(null)}
        />
      )}

      {!isLanding && !isInviteAuthScreen && <MobileBottomNav />}

      {passkeyPrompt.show && <PasskeyPrompt userId={userId} onDone={passkeyPrompt.done} />}
      {isUserLoggedIn && userId && !isDemo && (
        <PushReminderPrompt
          key={userId}
          userId={userId}
          canPrompt={
            !consentPending &&
            !isInviteAuthScreen &&
            profileSetupCompleted !== false &&
            !showProfileSettings
          }
          onVisibilityChange={setPushPromptVisible}
        />
      )}

      {showInstallBanner && !pushPromptVisible && (
        <InstallBanner
          handleDismissBanner={handleDismissBanner}
          handleInstallClick={handleInstallClick}
        />
      )}

      <LoginModal
        exitDemoMode={exitDemoMode}
        intent={loginRequest.intent ?? 'login'}
        redirectTo={loginRequest.redirectTo}
        isDemo={isDemo}
        navigate={navigate}
        setShowLoginModal={setShowLoginModal}
        showLoginModal={showLoginModal}
      />

      {viewerPredictionId && (
        <Suspense fallback={null}>
          <PredictionViewer />
        </Suspense>
      )}
    </>
  );
}

export default Layout;
