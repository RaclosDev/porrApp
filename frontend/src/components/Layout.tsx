import toast from 'react-hot-toast';
import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getAuthToken, setAuthToken } from '../services/api';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import ActiveLeagueDropdown from './ActiveLeagueDropdown';
import ProfileSettingsModal from './ProfileSettingsModal';
import { UserAvatar } from './Avatar';
import { useAppStore } from '../store/useAppStore';
import MobileBottomNav from './MobileBottomNav';

const PredictionViewer = React.lazy(() => import('./PredictionViewer'));

/** Evento de instalación de la PWA (solo Chromium; no está en los tipos del DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const prefetchRoute = (path: string) => {
  switch (path) {
    case '/ranking':
      import('../pages/Leaderboard');
      break;
    case '/jornadas':
      import('../pages/MatchdayPredictor');
      break;
    case '/tabla':
      import('../pages/LeagueStandings');
      break;
    case '/radar':
      import('../pages/Radar');
      break;
    case '/bracket':
      import('../pages/OfficialBracket');
      break;
    case '/grupos':
      import('../pages/Home');
      break;
    case '/search':
      import('../pages/Search');
      break;
    case '/stats':
      import('../pages/Stats');
      break;
    case '/mis-ligas':
      import('../pages/GroupsDashboard');
      break;
  }
};

/**
 * Componente Layout principal que envuelve a todas las rutas.
 * Contiene la barra de navegación superior (Header), el manejo de autenticación global (Google Login),
 * el banner de instalación PWA, y el visor global de porras (PredictionViewer).
 *
 * @component
 */
function Layout({ children }: { children: React.ReactNode }) {
  const {
    participantsHashes,
    userName,
    setUserName,
    viewerPredictionId,
    setIsAuthenticated,
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
  const navigate = useNavigate();
  const [showMyPredictionModal, setShowMyPredictionModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const userAvatarUrl = useAppStore((state) => state.userAvatarUrl);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const isUserLoggedIn = Boolean(getAuthToken()) && Boolean(userName);
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
      {/* Banner flotante de Modo Demo */}
      {isDemo && !isUserLoggedIn && (
        <div
          id="demo-mode-banner"
          style={{
            background:
              'linear-gradient(90deg, rgba(0, 210, 211, 0.2) 0%, rgba(37, 99, 235, 0.22) 100%)',
            borderBottom: '1px solid rgba(0, 210, 211, 0.35)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.8rem',
            color: '#f8fafc',
            position: 'sticky',
            top: 0,
            zIndex: 110,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>✨</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>Modo Demo:</strong> Cuadro, resultados y participantes reales
            </span>
          </div>
          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowMyPredictionModal(true)}
              style={{
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontWeight: 800,
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Jugar
            </button>
            <button
              type="button"
              onClick={() => {
                exitDemoMode?.();
                navigate('/', { replace: true });
              }}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: 'none',
                textDecoration: 'underline',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '2px 4px',
                whiteSpace: 'nowrap',
              }}
            >
              Salir
            </button>
          </div>
        </div>
      )}

      <header className={`top-bar${isLanding ? ' top-bar--landing' : ''}`}>
        <div className="header-left">
          <div
            className="header-title-row"
            style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'nowrap' }}
          >
            {/* Logo de PorrApp */}
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
              <span className="brand-ball-icon" style={{ fontSize: '1.35rem' }}>
                ⚽
              </span>
              <span>
                Porr<span style={{ color: 'var(--accent-cyan, #00d2d3)' }}>App</span>
              </span>
            </NavLink>

            {isLanding || isInviteAuthScreen ? null : isDemo ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  background: 'rgba(0, 210, 211, 0.12)',
                  border: '1px solid rgba(0, 210, 211, 0.4)',
                  color: 'var(--accent-cyan, #00d2d3)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                🌍 Mundial 2026
              </span>
            ) : (
              <>
                {/* Selector Global de Liga Activa */}
                <ActiveLeagueDropdown />

                {/* Botón Ver Mi Porra / Pronosticar Jornada */}
                {loading ? null : isMatchDayLeague ? (
                  <button
                    id="btn-complete-my-prediction-header"
                    className="glass-btn primary-btn header-porra-cta"
                    style={{
                      padding: '6px 14px',
                      minHeight: '38px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: isNavLocked ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: isNavLocked ? 0.4 : 1,
                    }}
                    onClick={() => navigate('/jornadas')}
                    disabled={isNavLocked}
                  >
                    ⚽ Pronosticar Jornada
                  </button>
                ) : userName &&
                  participantsHashes.find((h) => h.participantName === userName) ? null : (
                  <button
                    id="btn-complete-my-prediction-header"
                    className="glass-btn primary-btn header-porra-cta"
                    style={{
                      padding: '6px 14px',
                      minHeight: '38px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: isNavLocked ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: isNavLocked ? 0.4 : 1,
                    }}
                    onClick={() => navigate('/prediction')}
                    disabled={isNavLocked}
                  >
                    ✍️ Completar Mi Porra
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!isLanding && !isInviteAuthScreen && (
          <div className="header-center">
            {/* Navegación */}
            <nav
              className="nav-links"
              inert={isNavLocked}
              aria-disabled={isNavLocked || undefined}
              style={isNavLocked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            >
              {isDemo ? (
                <>
                  <NavLink
                    to="/demo"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Inicio
                  </NavLink>
                  <NavLink
                    to="/prediction"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Mi Porra
                  </NavLink>
                  <NavLink
                    to="/bracket"
                    onMouseEnter={() => prefetchRoute('/bracket')}
                    onFocus={() => prefetchRoute('/bracket')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Resultados
                  </NavLink>
                  <NavLink
                    to="/grupos"
                    onMouseEnter={() => prefetchRoute('/grupos')}
                    onFocus={() => prefetchRoute('/grupos')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Grupos
                  </NavLink>
                  <NavLink
                    to="/ranking"
                    onMouseEnter={() => prefetchRoute('/ranking')}
                    onFocus={() => prefetchRoute('/ranking')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Ranking
                  </NavLink>
                </>
              ) : isMatchDayLeague ? (
                <>
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Inicio
                  </NavLink>
                  <NavLink
                    to="/jornadas"
                    onMouseEnter={() => prefetchRoute('/jornadas')}
                    onFocus={() => prefetchRoute('/jornadas')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Jornadas
                  </NavLink>
                  <NavLink
                    to="/ranking"
                    onMouseEnter={() => prefetchRoute('/ranking')}
                    onFocus={() => prefetchRoute('/ranking')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Ranking
                  </NavLink>
                  <NavLink
                    to="/tabla"
                    onMouseEnter={() => prefetchRoute('/tabla')}
                    onFocus={() => prefetchRoute('/tabla')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Tabla
                  </NavLink>
                  <NavLink
                    to="/mis-ligas"
                    onMouseEnter={() => prefetchRoute('/mis-ligas')}
                    onFocus={() => prefetchRoute('/mis-ligas')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Mis Ligas
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Inicio
                  </NavLink>
                  <NavLink
                    to="/prediction"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Mi Porra
                  </NavLink>
                  <NavLink
                    to="/bracket"
                    onMouseEnter={() => prefetchRoute('/bracket')}
                    onFocus={() => prefetchRoute('/bracket')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Resultados
                  </NavLink>
                  <NavLink
                    to="/ranking"
                    onMouseEnter={() => prefetchRoute('/ranking')}
                    onFocus={() => prefetchRoute('/ranking')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Ranking
                  </NavLink>
                  <NavLink
                    to="/mis-ligas"
                    onMouseEnter={() => prefetchRoute('/mis-ligas')}
                    onFocus={() => prefetchRoute('/mis-ligas')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Mis Ligas
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        )}

        {!isInviteAuthScreen && (
          <div
            className="header-right"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '10px',
              position: 'relative',
            }}
          >
            {!isUserLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isLanding && (
                  <button
                    id="btn-header-demo"
                    type="button"
                    onClick={() => {
                      if (enterDemoMode) enterDemoMode();
                      navigate('/demo');
                    }}
                    className="glass-btn"
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      fontSize: '0.82rem',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#e2e8f0',
                    }}
                    title="Probar Demo del Mundial"
                  >
                    <span>🚀</span>
                    <span>Demo</span>
                  </button>
                )}
                <button
                  id="btn-login-header"
                  type="button"
                  onClick={() => setShowMyPredictionModal(true)}
                  className="glass-btn"
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    fontSize: '0.88rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: 'rgba(0, 210, 211, 0.12)',
                    border: '1px solid rgba(0, 210, 211, 0.45)',
                    color: '#00d2d3',
                    boxShadow: '0 4px 15px rgba(0, 210, 211, 0.15)',
                  }}
                  title="Iniciar Sesión"
                >
                  <span style={{ fontSize: '1.05rem' }}>👤</span>
                  <span>Iniciar Sesión</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  id="btn-profile-menu"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="glass-btn"
                  style={{
                    height: '36px',
                    width: '36px',
                    minWidth: '36px',
                    maxWidth: '36px',
                    minHeight: '36px',
                    maxHeight: '36px',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Menú de Usuario"
                  aria-label="Menú de Usuario"
                >
                  {userAvatarUrl ? (
                    <UserAvatar url={userAvatarUrl} name={userName} size={34} />
                  ) : (
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>👤</span>
                  )}
                </button>

                {showProfileMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      background: '#151525',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      marginTop: '10px',
                      zIndex: 100,
                      minWidth: '200px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <UserAvatar url={userAvatarUrl} name={userName} size={32} />
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 'bold',
                            color: '#fff',
                            fontSize: '0.9rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {userName || 'Usuario'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Conectado
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowProfileSettings(true);
                      }}
                      className="glass-btn"
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      ⚙️ Ajustes de cuenta
                    </button>

                    <button
                      onClick={() => {
                        setAuthToken(null);
                        setIsAuthenticated?.(false);
                        setUserName('');
                        localStorage.removeItem('my_prediction_name');
                        localStorage.removeItem('my_user_id');
                        localStorage.removeItem('my_avatar_url');
                        localStorage.removeItem('token');
                        window.location.href = '/';
                      }}
                      style={{
                        background: 'rgba(255, 71, 87, 0.12)',
                        border: '1px solid rgba(255, 71, 87, 0.4)',
                        color: '#ff4757',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        width: '100%',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      🚪 Cerrar Sesión
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </header>

      {/* Contenido Principal */}
      <main className={`app-container ${!isLanding ? 'has-mobile-bottom-nav' : ''}`}>
        {isNavLocked && !isNoLeagueAllowedPath ? null : children}
      </main>

      {showProfileSettings && (
        <ProfileSettingsModal onClose={() => setShowProfileSettings(false)} />
      )}

      {/* Barra de navegación inferior fija para móviles */}
      {!isLanding && !isInviteAuthScreen && <MobileBottomNav />}

      {/* Banner PWA */}
      {showInstallBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--accent-color)',
            borderRadius: '12px',
            padding: '15px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 30px rgba(0,210,211,0.3)',
            zIndex: 999999,
            backdropFilter: 'blur(10px)',
            width: '90%',
            maxWidth: '350px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
            {isIos()
              ? 'Para instalar la app, pulsa Compartir y luego "Añadir a la pantalla de inicio".'
              : 'Para instalar la app, toca los 3 puntos de tu navegador y selecciona "Instalar aplicación", o pulsa abajo.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            {!isIos() && (
              <button
                onClick={handleInstallClick}
                className="glass-btn"
                style={{
                  background: 'var(--accent-color)',
                  color: 'black',
                  fontWeight: 'bold',
                  padding: '8px 15px',
                }}
              >
                Sí, Instalar
              </button>
            )}
            <button
              onClick={handleDismissBanner}
              className="glass-btn"
              style={{ padding: '8px 15px' }}
            >
              {isIos() ? 'Entendido' : 'No, gracias'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Autenticación / Registro */}
      <div
        id="my-prediction-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Identificación de usuario"
        style={{ display: showMyPredictionModal ? 'flex' : 'none', zIndex: 999999 }}
      >
        <div
          className="modal-content glass-panel"
          style={{
            maxWidth: '420px',
            textAlign: 'center',
            padding: '35px 25px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h3
            style={{
              color: 'var(--accent-color)',
              marginBottom: '20px',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '1.8rem',
              letterSpacing: '1px',
            }}
          >
            Iniciar sesión
          </h3>
          <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
            <p
              style={{
                marginBottom: '30px',
                fontSize: '1rem',
                color: 'var(--text-muted)',
                lineHeight: '1.5',
              }}
            >
              Para ver en qué liga estás o rellenar tu porra, ¡inicia sesión con Google!
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Inicio de sesión cancelado o fallido')}
                theme="filled_black"
                shape="pill"
                text="continue_with"
              />
            </div>
            <button
              className="glass-btn"
              style={{
                marginTop: '10px',
                fontSize: '0.85rem',
                padding: '8px 15px',
                opacity: 0.8,
                width: '100%',
              }}
              onClick={() => {
                setShowMyPredictionModal(false);
                if (isDemo) {
                  exitDemoMode?.();
                }
                navigate('/', { replace: true, state: {} });
              }}
            >
              {isDemo ? 'Salir de la demo' : 'Volver al inicio'}
            </button>
          </div>
        </div>
      </div>

      {/* Visor Global de Porras (Portal Inyectado) */}
      {viewerPredictionId && (
        <Suspense fallback={null}>
          <PredictionViewer />
        </Suspense>
      )}
    </>
  );
}

export default Layout;
