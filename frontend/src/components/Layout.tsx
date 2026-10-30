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
import LoginModal from './layout/LoginModal';

const PredictionViewer = React.lazy(() => import('./PredictionViewer'));

/** Evento de instalación de la PWA (solo Chromium; no está en los tipos del DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
  const [showMyPredictionModal, setShowMyPredictionModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const userAvatarUrl = useAppStore((state) => state.userAvatarUrl);
  const userId = useAppStore((state) => state.userId);
  const logout = useAppStore((state) => state.logout);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const isUserLoggedIn = isAuthenticated && Boolean(userName);
  const isMatchDayLeague =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const location = useLocation();
  const isDemo = isDemoMode;

  // /demo activates its mode in DemoPage; do not race that activation with a redirect.
  const isLanding = location.pathname === '/' && !isUserLoggedIn && !isDemo;
  // En la pantalla de acceso/invitación no mostrar la navegación global: la propia
  // pantalla ya contiene el acceso con Google y el contexto de la invitación.
  const isInviteAuthScreen = !isUserLoggedIn && location.pathname === '/mis-ligas';

  // Con sesión iniciada pero sin ninguna liga, la navegación queda bloqueada:
  // solo se puede crear o unirse a una liga desde Mis Ligas.
  const isNavLocked =
    isAuthenticated && userGroupsLoaded && userGroups.length === 0 && !isLanding && !isDemo;

  // Un usuario autenticado sin ninguna liga solo puede crear o unirse a una.
  const isNoLeagueAllowedPath =
    location.pathname === '/mis-ligas' ||
    location.pathname.startsWith('/join/') ||
    location.pathname.startsWith('/linkedin');

  useEffect(() => {
    if (!isNavLocked || isNoLeagueAllowedPath) return;
    navigate('/mis-ligas', { replace: true });
  }, [isNavLocked, isNoLeagueAllowedPath, navigate]);

  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };

  const isStandalone = () => {
    return (
      ('standalone' in window.navigator && window.navigator.standalone) ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  };

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

  useEffect(() => {
    if (isIos() && !isStandalone() && localStorage.getItem('pwa_banner_dismissed') !== 'true') {
      setShowInstallBanner(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (localStorage.getItem('pwa_banner_dismissed') !== 'true') {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      });
    }
  };

  const handleDismissBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  const signInWithGoogle = useGoogleSignIn();
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (await signInWithGoogle(credentialResponse)) setShowMyPredictionModal(false);
  };

  return (
    <>
      {isDemo && !isUserLoggedIn && (
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
              to={isUserLoggedIn ? '/' : isDemo ? '/demo' : '/'}
              className="header-brand-link"
              onClick={(e) => {
                if (isNavLocked) e.preventDefault();
              }}
              aria-disabled={isNavLocked || undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.25rem',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.3px',
                flexShrink: 0,
              }}
            >
              <span className="brand-ball-icon text-[1.35rem]">⚽</span>
              <span>
                Porr<span className="text-cyan">App</span>
              </span>
            </NavLink>

            {isLanding || isInviteAuthScreen ? null : isDemo ? (
              <span className="inline-block min-w-0 truncate py-1 px-2.5 rounded-[16px] bg-[rgba(0,_210,_211,_0.12)] bg-none border border-[rgba(0,_210,_211,_0.4)] text-cyan text-[0.8rem] font-bold">
                Mundial 2026
              </span>
            ) : (
              <>
                <ActiveLeagueDropdown />

                {loading ? null : isMatchDayLeague ? (
                  <button
                    id="btn-complete-my-prediction-header"
                    className={`glass-btn primary-btn header-porra-cta py-1.5 px-3.5 min-h-9.5 rounded-[10px] font-bold text-[0.85rem] whitespace-nowrap ${isNavLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${isNavLocked ? 'opacity-[0.4]' : 'opacity-[1]'}`}
                    onClick={() => navigate('/jornadas')}
                    disabled={isNavLocked}
                    aria-label="Pronosticar jornada"
                    title="Pronosticar jornada"
                  >
                    <span aria-hidden="true">⚽</span>
                    <span className="header-porra-cta-label"> Pronosticar jornada</span>
                  </button>
                ) : userName && myPrediction ? null : (
                  <button
                    id="btn-complete-my-prediction-header"
                    className={`glass-btn primary-btn header-porra-cta py-1.5 px-3.5 min-h-9.5 rounded-[10px] font-bold text-[0.85rem] whitespace-nowrap ${isNavLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${isNavLocked ? 'opacity-[0.4]' : 'opacity-[1]'}`}
                    onClick={() => navigate('/prediction')}
                    disabled={isNavLocked}
                    aria-label="Completar mi porra"
                    title="Completar mi porra"
                  >
                    <span aria-hidden="true">✍️</span>
                    <span className="header-porra-cta-label"> Completar mi porra</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!isLanding && !isInviteAuthScreen && (
          <MainNav isDemo={isDemo} isMatchDayLeague={isMatchDayLeague} isNavLocked={isNavLocked} />
        )}

        {!isInviteAuthScreen && (
          <HeaderActions
            enterDemoMode={enterDemoMode}
            isLanding={isLanding}
            isUserLoggedIn={isUserLoggedIn}
            navigate={navigate}
            onLogout={() => {
              logout();
              navigate('/', { replace: true });
            }}
            setShowMyPredictionModal={setShowMyPredictionModal}
            setShowProfileMenu={setShowProfileMenu}
            setShowProfileSettings={setShowProfileSettings}
            showProfileMenu={showProfileMenu}
            userAvatarUrl={userAvatarUrl}
            userId={userId}
            userName={userName}
          />
        )}
      </header>

      <main className={`app-container ${!isLanding ? 'has-mobile-bottom-nav' : ''}`}>
        {isNavLocked && !isNoLeagueAllowedPath ? null : children}
      </main>

      {showProfileSettings && (
        <ProfileSettingsModal onClose={() => setShowProfileSettings(false)} />
      )}

      {!isLanding && !isInviteAuthScreen && <MobileBottomNav />}

      {showInstallBanner && (
        <InstallBanner
          handleDismissBanner={handleDismissBanner}
          handleInstallClick={handleInstallClick}
          isIos={isIos}
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
