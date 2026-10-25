import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getAuthToken, setAuthToken, fetchClaimedNames } from '../services/api';
import { GoogleLogin } from '@react-oauth/google';
import ActiveLeagueDropdown from './ActiveLeagueDropdown';
import MobileBottomNav from './MobileBottomNav';

const PredictionViewer = React.lazy(() => import('./PredictionViewer'));

const prefetchRoute = (path) => {
  switch (path) {
    case '/clasificacion':
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
    case '/cuadro':
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
    case '/reglas':
      import('../pages/Rules');
      break;
    case '/mis-ligas':
      import('../pages/GroupsDashboard');
      break;
  }
};

/**
 * Componente Layout principal que envuelve a todas las rutas.
 * Contiene la barra de navegación superior (Header), el manejo de autenticación global (Google Login),
 * el banner de instalación PWA, y el visor global de porras (BetViewer).
 *
 * @component
 * @param {Object} props
 * @param {ReactNode} props.children - El contenido de la ruta actual.
 * @returns {JSX.Element} Layout de la aplicación.
 */
function Layout({ children }) {
  const {
    participantsHashes,
    userName,
    setUserName,
    viewerBetId,
    setViewerBetId,
    isRaclos,
    setIsAuthenticated,
    setIsAdminAuthenticated,
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    loading,
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
  } = useAppContext();
  const navigate = useNavigate();
  const [showMyBetModal, setShowMyBetModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [requiresName, setRequiresName] = useState(false);
  const [claimedNames, setClaimedNames] = useState([]);
  const [newNameInput, setNewNameInput] = useState('');
  const [pendingCredential, setPendingCredential] = useState(null);
  const isUserLoggedIn = (Boolean(getAuthToken()) && Boolean(userName)) || isRaclos;
  const isMatchDayLeague =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const location = useLocation();
  const isDemo =
    isDemoMode || location.pathname === '/demo' || location.pathname === '/mundial-2026';
  const isLanding = location.pathname === '/' && !isUserLoggedIn && !isDemo;

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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMyBetModal(false);
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => setShowMyBetModal(true);
    window.addEventListener('open-login-modal', handleOpenLogin);
    return () => window.removeEventListener('open-login-modal', handleOpenLogin);
  }, []);

  /**
   * Efecto para forzar la apertura del modal de login si la ruta a la que se
   * redirigió requería estar logueado (via location.state).
   */
  useEffect(() => {
    if (location.state?.requireLogin) {
      setShowMyBetModal(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (isIos() && !isStandalone() && localStorage.getItem('pwa_banner_dismissed') !== 'true') {
      setShowInstallBanner(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
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

  /**
   * Callback tras loguearse correctamente en Google.
   * Valida el credential con el backend.
   */
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (data.status === 'requires_name') {
        setPendingCredential(credentialResponse.credential);
        setRequiresName(true);
        fetchClaimedNames().then((names) => setClaimedNames(names));
      } else if (data.token) {
        // Logueo exitoso.
        setAuthToken(data.token);
        setIsAuthenticated?.(true);
        setUserName(data.participantName);
        localStorage.setItem('my_prediction_name', data.participantName);
        localStorage.setItem('my_bet_name', data.participantName);
        if (data.userId) localStorage.setItem('my_user_id', data.userId);
        if (data.lastSelectedGroupId) {
          localStorage.setItem('activeGroupId', data.lastSelectedGroupId.toString());
        }
        setShowMyBetModal(false);
      }
    } catch (e) {
      alert('Error conectando con Google: ' + e.message);
    }
  };

  /**
   * Envía el nombre escogido por el usuario por primera vez tras vincular Google.
   */
  const handleNameSubmit = async () => {
    if (!newNameInput.trim()) return alert('El nombre no puede estar vacío');
    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: pendingCredential,
          participantName: newNameInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        setIsAuthenticated?.(true);
        setUserName(data.participantName);
        localStorage.setItem('my_prediction_name', data.participantName);
        localStorage.setItem('my_bet_name', data.participantName);
        if (data.userId) localStorage.setItem('my_user_id', data.userId);
        if (data.lastSelectedGroupId) {
          localStorage.setItem('activeGroupId', data.lastSelectedGroupId.toString());
        }
        setRequiresName(false);
        setShowMyBetModal(false);
        if (!localStorage.getItem('activeGroupId')) {
          navigate('/mis-ligas');
        }
      } else {
        alert(data.error || 'Error al vincular cuenta');
      }
    } catch (e) {
      alert('Error de red: ' + e.message);
    }
  };

  const decodedParticipants = participantsHashes
    .map((h) => ({
      hash: h.hash,
      name: h.participantName || 'Anónimo',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '0.84rem',
            color: '#f8fafc',
            textAlign: 'center',
            flexWrap: 'wrap',
            position: 'sticky',
            top: 0,
            zIndex: 110,
            backdropFilter: 'blur(8px)',
          }}
        >
          <span>
            🌍 <strong>Modo Demostración</strong> · Estás explorando la{' '}
            <strong>Porra Oficial del Mundial 2026</strong> (cuadro, grupos y participantes reales).
          </span>
          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowMyBetModal(true)}
              style={{
                background: 'var(--accent-cyan, #00d2d3)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Crear mi cuenta / Jugar
            </button>
            <button
              type="button"
              onClick={() => {
                exitDemoMode?.();
                navigate('/');
              }}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: 'none',
                textDecoration: 'underline',
                fontSize: '0.78rem',
                cursor: 'pointer',
                marginLeft: '4px',
              }}
            >
              Salir del demo
            </button>
          </div>
        </div>
      )}

      <header className="top-bar">
        <div className="header-left">
          <div
            className="header-title-row"
            style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'nowrap' }}
          >
            {/* Logo de PorrApp */}
            <NavLink
              to={isUserLoggedIn ? '/' : isDemo ? '/demo' : '/'}
              className="header-brand-link"
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

            {isLanding ? null : isDemo ? (
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
                    id="btn-complete-my-bet-header"
                    className="glass-btn primary-btn header-porra-cta"
                    style={{
                      padding: '6px 14px',
                      minHeight: '38px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => navigate('/jornadas')}
                  >
                    ⚽ Pronosticar Jornada
                  </button>
                ) : userName && participantsHashes.find((h) => h.participantName === userName) ? (
                  <button
                    id="btn-view-my-bet-header"
                    className="glass-btn primary-btn header-porra-cta"
                    style={{
                      padding: '6px 14px',
                      minHeight: '38px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      const myPred = participantsHashes.find((h) => h.participantName === userName);
                      if (myPred?.key) {
                        setViewerBetId(myPred.key);
                      }
                    }}
                  >
                    👁️ Ver Mi Porra
                  </button>
                ) : (
                  <button
                    id="btn-complete-my-bet-header"
                    className="glass-btn primary-btn header-porra-cta"
                    style={{
                      padding: '6px 14px',
                      minHeight: '38px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => navigate('/bracket')}
                  >
                    ✍️ Completar Mi Porra
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!isLanding && (
          <div className="header-center">
            {/* Navegación */}
            <nav className="nav-links">
              {isDemo ? (
                <>
                  <NavLink
                    to="/cuadro"
                    onMouseEnter={() => prefetchRoute('/cuadro')}
                    onFocus={() => prefetchRoute('/cuadro')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Cuadro
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
                    to="/clasificacion"
                    onMouseEnter={() => prefetchRoute('/clasificacion')}
                    onFocus={() => prefetchRoute('/clasificacion')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    🏆 Clasificación
                  </NavLink>
                  <NavLink
                    to="/radar"
                    onMouseEnter={() => prefetchRoute('/radar')}
                    onFocus={() => prefetchRoute('/radar')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Partidos
                  </NavLink>
                  <NavLink
                    to="/stats"
                    onMouseEnter={() => prefetchRoute('/stats')}
                    onFocus={() => prefetchRoute('/stats')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Más Elegidos
                  </NavLink>
                  <NavLink
                    to="/reglas"
                    onMouseEnter={() => prefetchRoute('/reglas')}
                    onFocus={() => prefetchRoute('/reglas')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Reglas
                  </NavLink>
                </>
              ) : isMatchDayLeague ? (
                <>
                  <NavLink
                    to="/"
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
                    ⚽ Jornadas
                  </NavLink>
                  <NavLink
                    to="/clasificacion"
                    onMouseEnter={() => prefetchRoute('/clasificacion')}
                    onFocus={() => prefetchRoute('/clasificacion')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    🏆 Clasificación Porra
                  </NavLink>
                  <NavLink
                    to="/tabla"
                    onMouseEnter={() => prefetchRoute('/tabla')}
                    onFocus={() => prefetchRoute('/tabla')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    📊 Tabla Oficial
                  </NavLink>
                  <NavLink
                    to="/radar"
                    onMouseEnter={() => prefetchRoute('/radar')}
                    onFocus={() => prefetchRoute('/radar')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    📅 Partidos
                  </NavLink>
                  <NavLink
                    to="/reglas"
                    onMouseEnter={() => prefetchRoute('/reglas')}
                    onFocus={() => prefetchRoute('/reglas')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    📜 Reglas
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink
                    to="/"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Inicio
                  </NavLink>
                  <NavLink
                    to="/clasificacion"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Clasificación
                  </NavLink>
                  <NavLink
                    to="/cuadro"
                    onMouseEnter={() => prefetchRoute('/cuadro')}
                    onFocus={() => prefetchRoute('/cuadro')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Cuadro
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
                    to="/radar"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Partidos
                  </NavLink>
                  <NavLink
                    to="/search"
                    onMouseEnter={() => prefetchRoute('/search')}
                    onFocus={() => prefetchRoute('/search')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    🔍 Buscador
                  </NavLink>
                  <NavLink
                    to="/stats"
                    onMouseEnter={() => prefetchRoute('/stats')}
                    onFocus={() => prefetchRoute('/stats')}
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Más Elegidos
                  </NavLink>
                  <NavLink
                    to="/reglas"
                    className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
                  >
                    Reglas
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        )}

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
          {isDemo && !isUserLoggedIn && (
            <button
              type="button"
              onClick={() => {
                exitDemoMode?.();
                navigate('/');
              }}
              className="glass-btn"
              style={{
                fontSize: '0.84rem',
                padding: '6px 12px',
                minHeight: '36px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Volver al inicio
            </button>
          )}

          {!isUserLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <button
                id="btn-login-header"
                type="button"
                onClick={() => setShowMyBetModal(true)}
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
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>👤</span>
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
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(0, 210, 211, 0.15)',
                        color: '#00d2d3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
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
                    onClick={() => {
                      setAuthToken(null);
                      setIsAuthenticated?.(false);
                      setIsAdminAuthenticated?.(false);
                      setUserName('');
                      localStorage.removeItem('my_prediction_name');
                      localStorage.removeItem('my_bet_name');
                      localStorage.removeItem('my_user_id');
                      localStorage.removeItem('token');
                      localStorage.removeItem('adminToken');
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
      </header>

      {/* Contenido Principal */}
      <main className={`app-container ${!isLanding ? 'has-mobile-bottom-nav' : ''}`}>
        {children}
      </main>

      {/* Barra de navegación inferior fija para móviles */}
      {!isLanding && <MobileBottomNav />}

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
        id="my-bet-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Identificación de usuario"
        style={{ display: showMyBetModal ? 'flex' : 'none', zIndex: 999999 }}
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
            ¿Quién eres?
          </h3>
          {requiresName ? (
            <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
              <p
                style={{
                  marginBottom: '25px',
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                }}
              >
                ¡Hola! Vemos que es tu primera vez con Google. Si ya habías hecho una porra,{' '}
                <strong>búscate en la lista</strong>. Si no,{' '}
                <strong>escribe un nombre nuevo</strong>.
              </p>

              <select
                aria-label="Selecciona tu nombre en la lista"
                className="glass-select"
                style={{
                  width: '100%',
                  marginBottom: '15px',
                  fontSize: '1rem',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                value={decodedParticipants.some((p) => p.name === newNameInput) ? newNameInput : ''}
                onChange={(e) => setNewNameInput(e.target.value)}
              >
                <option value="" disabled hidden>
                  Elige tu nombre en la lista...
                </option>
                {decodedParticipants
                  .filter((p) => !claimedNames.includes(p.name))
                  .map((p) => (
                    <option key={p.hash} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                <div
                  style={{
                    margin: '0 15px',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  O crea uno
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              </div>

              <input
                type="text"
                aria-label="Nombre nuevo de participante"
                placeholder="Nombre nuevo (ej: MiPrimo)"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                className="glass-input"
                style={{
                  width: '100%',
                  marginBottom: '25px',
                  padding: '12px',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              />
              <button
                className="glass-btn primary-btn"
                style={{ width: '100%', padding: '12px', fontSize: '1.1rem', letterSpacing: '1px' }}
                onClick={handleNameSubmit}
              >
                Vincular y Entrar
              </button>
              <button
                className="glass-btn"
                style={{
                  marginTop: '15px',
                  fontSize: '0.85rem',
                  padding: '8px 15px',
                  opacity: 0.8,
                  width: '100%',
                }}
                onClick={() => {
                  setShowMyBetModal(false);
                  navigate('/', { replace: true, state: {} });
                }}
              >
                Volver al inicio
              </button>
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
              <p
                style={{
                  marginBottom: '30px',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                }}
              >
                Para saber en qué liga estás o rellenar tu porra, ¡debes loguearte con Google!
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => alert('Login Fallido')}
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
                }}
                onClick={() => {
                  setShowMyBetModal(false);
                  navigate('/', { replace: true, state: {} });
                }}
              >
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visor Global de Porras (Portal Inyectado) */}
      {viewerBetId && (
        <Suspense fallback={null}>
          <PredictionViewer />
        </Suspense>
      )}
    </>
  );
}

export default Layout;
