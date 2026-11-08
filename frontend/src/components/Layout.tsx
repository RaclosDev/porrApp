import ActiveLeagueDropdown from './ActiveLeagueDropdown';
import type { CredentialResponse } from '@react-oauth/google';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, Suspense } from 'react';
import { useAppContext } from '../context/AppContext';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import ProfileSettingsModal from './ProfileSettingsModal';
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
import { promptInstall } from '../services/installPrompt';
import { useInstallState } from '../hooks/useInstallState';
import { useSessionHandoffPending } from '../hooks/useSessionHandoffPending';
import { useIosSessionHandoff } from '../hooks/useIosSessionHandoff';
import { isMatchBasedFormat, isGrandPrixFormat } from '../utils/poolFormat';
import { isUfcCompetition } from '../utils/fightCard';
import { isTennisCompetition } from '../utils/tennisDraw';

const PredictionViewer = React.lazy(() => import('./PredictionViewer'));

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
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    activeCompetitionExternalId,
    loading,
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    isAuthenticated,
    userGroups,
    userGroupsLoaded,
    loadingGroup,
    choosingLeague,
    activeGroupWorldCup,
  } = useAppContext();
  // Basta con los pronósticos propios: la lista de toda la liga solo la piden las pantallas que la usan.
  const myPrediction = useMyLeaguePrediction();
  const navigate = useNavigate();
  const [showMyPredictionModal, setShowMyPredictionModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
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
  const isMatchDayLeague =
    isMatchBasedFormat(activeGroupPoolFormat) || activeCompetitionFormatType === 'LEAGUE';
  const isGrandPrixLeague = isGrandPrixFormat(activeGroupPoolFormat);
  const isUfcLeague = isUfcCompetition(activeCompetitionExternalId);
  const isTennisLeague = isTennisCompetition(activeCompetitionExternalId);

  const location = useLocation();
  const isDemo = isDemoMode;

  // La portada es la portada aunque quede guardado el modo demo de una visita anterior: sin
  // sesión, «/» siempre muestra la landing, sin la barra ni el menú de la demo.
  const isLanding = location.pathname === '/' && !isUserLoggedIn;
  // En la pantalla de acceso/invitación no mostrar la navegación global: la propia
  // pantalla ya contiene el acceso con Google y el contexto de la invitación.
  const isInviteAuthScreen =
    location.pathname.startsWith('/join/') ||
    (!isUserLoggedIn && location.pathname === '/mis-ligas');

  // Con sesión iniciada pero sin ninguna liga, la navegación queda bloqueada:
  // solo se puede crear o unirse a una liga desde Mis Ligas.
  const isNavLocked =
    isAuthenticated && userGroupsLoaded && userGroups.length === 0 && !isLanding && !isDemo;

  // Un usuario autenticado sin ninguna liga solo puede crear o unirse a una.
  const isNoLeagueAllowedPath =
    location.pathname === '/mis-ligas' ||
    location.pathname === '/crear-liga' ||
    location.pathname.startsWith('/join/') ||
    location.pathname.startsWith('/linkedin');

  // Avisos inferiores, uno a la vez: el de cookies, el de instalar, el de la llave de acceso y
  // por último el de los recordatorios.
  const bottomPromptFree = !showInstallBanner && !isLanding && !consentPending;
  const passkeyPrompt = usePasskeyPrompt(
    userId,
    isUserLoggedIn &&
      !isDemo &&
      bottomPromptFree &&
      profileSetupCompleted !== false &&
      !showProfileSettings,
  );

  useEffect(() => {
    if (!isNavLocked || isNoLeagueAllowedPath) return;
    navigate('/mis-ligas', { replace: true });
  }, [isNavLocked, isNoLeagueAllowedPath, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMyPredictionModal(false);
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => setShowMyPredictionModal(true);
    window.addEventListener('open-login-modal', handleOpenLogin);
    return () => window.removeEventListener('open-login-modal', handleOpenLogin);
  }, []);

  /**
   * Efecto para forzar la apertura del modal de login si la ruta a la que se
   * redirigió requería estar logueado (via location.state).
   */
  useEffect(() => {
    if (location.state?.requireLogin) {
      setShowMyPredictionModal(true);
    }
  }, [location.state]);

  const handleInstallClick = () => {
    void promptInstall();
  };

  const handleDismissBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setInstallBannerDismissed(true);
  };

  const signInWithGoogle = useGoogleSignIn();
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (await signInWithGoogle(credentialResponse)) setShowMyPredictionModal(false);
  };

  return (
    <>
      {isDemo && !isUserLoggedIn && !isLanding && (
        <DemoBanner
          exitDemoMode={exitDemoMode}
          navigate={navigate}
          setShowMyPredictionModal={setShowMyPredictionModal}
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
                choosingLeague ||
                isMatchDayLeague ||
                isGrandPrixLeague ||
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
          <MainNav
            isDemo={isDemo}
            isMatchDayLeague={isMatchDayLeague}
            isGrandPrixLeague={isGrandPrixLeague}
            isUfcLeague={isUfcLeague}
            isTennisLeague={isTennisLeague}
            isNavLocked={isNavLocked}
            showGroups={activeGroupWorldCup}
            formatPending={loadingGroup || choosingLeague}
          />
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
            setShowMyPredictionModal={setShowMyPredictionModal}
            setShowProfileMenu={setShowProfileMenu}
            setShowProfileSettings={setShowProfileSettings}
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
          onClose={() => setShowProfileSettings(false)}
        />
      )}

      {!isLanding && !isInviteAuthScreen && <MobileBottomNav />}

      {passkeyPrompt.show && <PasskeyPrompt userId={userId} onDone={passkeyPrompt.done} />}
      {isUserLoggedIn && !isDemo && (
        <PushReminderPrompt canPrompt={bottomPromptFree && !passkeyPrompt.show} />
      )}

      {showInstallBanner && (
        <InstallBanner
          handleDismissBanner={handleDismissBanner}
          handleInstallClick={handleInstallClick}
        />
      )}

      <LoginModal
        exitDemoMode={exitDemoMode}
        handleGoogleSuccess={handleGoogleSuccess}
        isDemo={isDemo}
        navigate={navigate}
        setShowMyPredictionModal={setShowMyPredictionModal}
        showMyPredictionModal={showMyPredictionModal}
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
