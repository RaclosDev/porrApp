import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getAuthToken, setAuthToken, fetchClaimedNames } from '../services/api';
import { GoogleLogin } from '@react-oauth/google';
import PredictionViewer from './PredictionViewer';

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
    setViewerBetId,
    onlineUsers,
    isRaclos,
    setIsAuthenticated,
    setIsAdminAuthenticated,
    activeGroupPoolFormat,
    loading,
  } = useAppContext();
  const navigate = useNavigate();
  const [showMyBetModal, setShowMyBetModal] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [requiresName, setRequiresName] = useState(false);
  const [claimedNames, setClaimedNames] = useState([]);
  const [newNameInput, setNewNameInput] = useState('');
  const [pendingCredential, setPendingCredential] = useState(null);
  const isAuthenticated = !!getAuthToken();

  /**
   * Determina si el usuario está desde un dispositivo iOS.
   */
  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };

  /**
   * Determina si la app ya está instalada como PWA (standalone).
   */
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
        setShowOnline(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const location = useLocation();

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
      <header className="top-bar">
        <div className="header-left">
          <div
            className="header-title-row"
            style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'nowrap' }}
          >
            {/* Indicador de Usuarios Online (Hover -> Lista) */}
            <div
              id="online-counter"
              className="tooltip-container"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowOnline(!showOnline);
                }
              }}
              onClick={() => setShowOnline(!showOnline)}
              onMouseEnter={() => setShowOnline(true)}
              onMouseLeave={() => setShowOnline(false)}
              style={{
                fontSize: '0.9rem',
                fontWeight: 'bold',
                background: 'rgba(0, 210, 211, 0.1)',
                color: '#00d2d3',
                padding: '5px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 210, 211, 0.3)',
                textShadow: 'none',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <span id="online-counter-text">👁️ {onlineUsers?.length || 0} online</span>
              {showOnline && (
                <div
                  className="tooltip-content"
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    background: '#151525',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    border: '1px solid rgba(0, 210, 211, 0.5)',
                    borderRadius: '8px',
                    padding: '10px',
                    marginTop: '10px',
                    zIndex: 100,
                    minWidth: '150px',
                  }}
                >
                  <ul
                    id="online-users-list"
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      textAlign: 'left',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {onlineUsers?.map((n, i) => (
                      <li
                        key={i}
                        style={{
                          padding: '4px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          color: 'white',
                        }}
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {/* Botón Ver Mi Porra / Completar Mi Porra */}
            {loading ? null : userName &&
              participantsHashes.find((h) => h.participantName === userName) ? (
              <button
                id="btn-view-my-bet-header"
                className="glass-btn primary-btn"
                style={{
                  padding: '6px 14px',
                  minHeight: '40px',
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
                className="glass-btn primary-btn"
                style={{
                  padding: '6px 14px',
                  minHeight: '40px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() =>
                  navigate(activeGroupPoolFormat === 'MATCH_DAY' ? '/jornadas' : '/bracket')
                }
              >
                {activeGroupPoolFormat === 'MATCH_DAY'
                  ? '✍️ Pronosticar Jornada'
                  : '✍️ Completar Mi Porra'}
              </button>
            )}
          </div>
        </div>
        <div className="header-center">
          {/* Navegación */}
          <nav className="nav-links">
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
              to="/grupos"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Grupos
            </NavLink>
            {activeGroupPoolFormat === 'MATCH_DAY' ? (
              <NavLink
                to="/jornadas"
                className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
              >
                ⚽ Jornadas
              </NavLink>
            ) : (
              <NavLink
                to="/cuadro"
                className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
              >
                Cuadro
              </NavLink>
            )}
            <NavLink
              to="/radar"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              Partidos
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) => (isActive ? 'glass-btn active' : 'glass-btn')}
            >
              🔍 Buscador
            </NavLink>
            <NavLink
              to="/stats"
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
          </nav>
        </div>
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
          {/* Menú de Perfil de Usuario */}
          <button
            onClick={() => {
              if (userName || isAuthenticated) {
                setShowProfileMenu(!showProfileMenu);
              } else {
                setShowMyBetModal(true);
              }
            }}
            className="glass-btn"
            style={{
              height: '36px',
              width:
                userName ||
                localStorage.getItem('my_prediction_name') ||
                localStorage.getItem('my_bet_name')
                  ? 'auto'
                  : '36px',
              padding:
                userName ||
                localStorage.getItem('my_prediction_name') ||
                localStorage.getItem('my_bet_name')
                  ? '0 12px'
                  : '0',
              fontSize: '1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            title="Menú de Usuario"
            aria-label="Menú de Usuario"
          >
            <span style={{ fontSize: '1.1rem' }}>👤</span>
            {(userName ||
              localStorage.getItem('my_prediction_name') ||
              localStorage.getItem('my_bet_name')) && (
              <span style={{ fontWeight: 'bold' }}>
                {userName ||
                  localStorage.getItem('my_prediction_name') ||
                  localStorage.getItem('my_bet_name')}
              </span>
            )}
          </button>

          {showProfileMenu && (userName || isAuthenticated) && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                background: '#151525',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px',
                marginTop: '10px',
                zIndex: 100,
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate('/mis-ligas');
                }}
                className="glass-btn"
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                }}
              >
                🏆 Mis Ligas
              </button>
              {isRaclos && (
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/admin');
                  }}
                  className="glass-btn"
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                  }}
                >
                  ⚙️ Panel Admin
                </button>
              )}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    setAuthToken(null);
                    setIsAuthenticated?.(false);
                    setIsAdminAuthenticated?.(false);
                    setUserName('');
                    localStorage.removeItem('my_prediction_name');
                    localStorage.removeItem('my_bet_name');
                    localStorage.removeItem('my_user_id');
                    window.location.reload();
                  }}
                  style={{
                    background: 'rgba(255, 71, 87, 0.1)',
                    border: '1px solid rgba(255, 71, 87, 0.5)',
                    color: '#ff4757',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 'bold',
                    width: '100%',
                    textAlign: 'left',
                    marginTop: '5px',
                  }}
                >
                  🚪 Salir
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="app-container">{children}</main>

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
      <PredictionViewer />
    </>
  );
}

export default Layout;
