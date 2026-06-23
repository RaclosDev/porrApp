import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getAdminToken, setAdminToken, fetchClaimedNames } from '../services/api';
import { GoogleLogin } from '@react-oauth/google';
import BetViewer from './BetViewer';

function Layout({ children }) {
  const { participantsHashes, userName, setUserName, setViewerBetId, onlineUsers, isRaclos, setIsAdminAuthenticated, loading } = useAppContext();
  const navigate = useNavigate();
  const [showMyBetModal, setShowMyBetModal] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [requiresName, setRequiresName] = useState(false);
  const [claimedNames, setClaimedNames] = useState([]);
  const [newNameInput, setNewNameInput] = useState('');
  const [pendingCredential, setPendingCredential] = useState(null);
  const isAuthenticated = !!getAdminToken();

  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };
  
  const isStandalone = () => {
    return ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
  };

  const location = useLocation();

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
      deferredPrompt.userChoice.then((choiceResult) => {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      });
    }
  };

  const handleDismissBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await res.json();
      if (data.status === 'requires_name') {
        setGoogleEmail(data.googleEmail);
        setGoogleName(data.googleName);
        setPendingCredential(credentialResponse.credential);
        setRequiresName(true);
        fetchClaimedNames().then(names => setClaimedNames(names));
      } else if (data.token) {
        setAdminToken(data.token);
        setIsAdminAuthenticated(true);
        setUserName(data.participantName);
        localStorage.setItem('my_bet_name', data.participantName);
        if (data.userId) localStorage.setItem('my_user_id', data.userId);
        if (data.lastSelectedGroupId) {
            localStorage.setItem('activeGroupId', data.lastSelectedGroupId.toString());
        }
        setShowMyBetModal(false);
      }
    } catch (e) {
      alert("Error conectando con Google: " + e.message);
    }
  };

  const handleNameSubmit = async () => {
    if (!newNameInput.trim()) return alert("El nombre no puede estar vacío");
    try {
      const res = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: pendingCredential, participantName: newNameInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAdminToken(data.token);
        setIsAdminAuthenticated(true);
        setUserName(data.participantName);
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
        alert(data.error || "Error al vincular cuenta");
      }
    } catch (e) {
        alert("Error de red");
    }
  };



  const decodedParticipants = participantsHashes.map(h => ({
    hash: h.hash,
    name: h.participantName || 'Anónimo'
  })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <header className="top-bar">
        <div className="header-left">
            <div className="header-title-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'nowrap' }}>
                <h1 id="site-title" style={{ margin: 0, whiteSpace: 'nowrap', userSelect: 'none' }}>
                    MUNDIAL 2026 - PORRA
                </h1>
                <div id="online-counter" className="tooltip-container" onClick={() => setShowOnline(!showOnline)} onMouseEnter={() => setShowOnline(true)} onMouseLeave={() => setShowOnline(false)} style={{ fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(0, 210, 211, 0.3)', textShadow: 'none', whiteSpace: 'nowrap', cursor: 'pointer', position: 'relative' }}>
                    <span id="online-counter-text">👁️ {onlineUsers?.length || 0} online</span>
                    {showOnline && (
                        <div className="tooltip-content" style={{ display: 'block', position: 'absolute', top: '100%', left: '0', background: '#151525', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '1px solid rgba(0, 210, 211, 0.5)', borderRadius: '8px', padding: '10px', marginTop: '10px', zIndex: 100, minWidth: '150px' }}>
                            <ul id="online-users-list" style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>
                                {onlineUsers?.map((n, i) => <li key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'white' }}>{n}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
                {loading ? null : userName && participantsHashes.find(h => h.participantName === userName) ? (
                    <button id="btn-view-my-bet-header" style={{ background: 'linear-gradient(135deg, #f368e0, #ff9ff3)', border: 'none', color: 'black', padding: '5px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setViewerBetId(Number(participantsHashes.find(h => h.participantName === userName)?.key))}>
                        👁️ Ver Mi Porra
                    </button>
                ) : (
                    <button id="btn-complete-my-bet-header" style={{ background: 'linear-gradient(135deg, #f368e0, #ff9ff3)', border: 'none', color: 'black', padding: '5px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => navigate('/bracket')}>
                        ✍️ Completar Mi Porra
                    </button>
                )}
            </div>
        </div>
        <div className="header-center">
            <nav className="nav-links">
                <NavLink to="/" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Inicio</NavLink>
                <NavLink to="/clasificacion" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Clasificación</NavLink>
                <NavLink to="/cuadro" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Cuadro</NavLink>
                <NavLink to="/radar" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Partidos</NavLink>
                <NavLink to="/search" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>🔍 Buscador</NavLink>
                <NavLink to="/stats" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Más Elegidos</NavLink>
                <NavLink to="/reglas" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Reglas</NavLink>
            </nav>
        </div>
        <div className="header-right" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', position: 'relative' }}>
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
                    width: (userName || localStorage.getItem('my_bet_name')) ? 'auto' : '36px',
                    padding: (userName || localStorage.getItem('my_bet_name')) ? '0 12px' : '0', 
                    fontSize: '1rem', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '8px'
                }}
                title="Menú de Usuario"
            >
                <span style={{ fontSize: '1.1rem' }}>👤</span>
                {(userName || localStorage.getItem('my_bet_name')) && (
                    <span style={{ fontWeight: 'bold' }}>{userName || localStorage.getItem('my_bet_name')}</span>
                )}
            </button>

            {showProfileMenu && (userName || isAuthenticated) && (
                <div style={{ position: 'absolute', top: '100%', right: '0', background: '#151525', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px', marginTop: '10px', zIndex: 100, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                        onClick={() => { setShowProfileMenu(false); navigate('/mis-ligas'); }} 
                        className="glass-btn"
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'transparent' }}
                    >
                        🏆 Mis Ligas
                    </button>
                    {isRaclos && (
                        <button 
                            onClick={() => { setShowProfileMenu(false); navigate('/admin'); }} 
                            className="glass-btn"
                            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'transparent' }}
                        >
                            ⚙️ Panel Admin
                        </button>
                    )}
                    {isAuthenticated && (
                        <button 
                            onClick={() => { setAdminToken(null); setUserName(''); localStorage.removeItem('my_bet_name'); localStorage.removeItem('my_user_id'); window.location.reload(); }} 
                            style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.5)', color: '#ff4757', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', width: '100%', textAlign: 'left', marginTop: '5px' }}
                        >
                            🚪 Salir
                        </button>
                    )}
                </div>
            )}
        </div>
      </header>



      <main className="app-container">
        {children}
      </main>

      {showInstallBanner && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--accent-color)', borderRadius: '12px', padding: '15px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', boxShadow: '0 10px 30px rgba(0,210,211,0.3)', zIndex: 999999, backdropFilter: 'blur(10px)', width: '90%', maxWidth: '350px' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
            {isIos() ? 'Para instalar la app, pulsa Compartir y luego "Añadir a la pantalla de inicio".' : 'Para instalar la app, toca los 3 puntos de tu navegador y selecciona "Instalar aplicación", o pulsa abajo.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            {!isIos() && <button onClick={handleInstallClick} className="glass-btn" style={{ background: 'var(--accent-color)', color: 'black', fontWeight: 'bold', padding: '8px 15px' }}>Sí, Instalar</button>}
            <button onClick={handleDismissBanner} className="glass-btn" style={{ padding: '8px 15px' }}>{isIos() ? 'Entendido' : 'No, gracias'}</button>
          </div>
        </div>
      )}

      <div id="my-bet-modal" className="modal" style={{ display: showMyBetModal ? 'flex' : 'none', zIndex: 999999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '420px', textAlign: 'center', padding: '35px 25px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <h3 style={{ color: 'var(--accent-color)', marginBottom: '20px', fontFamily: "'Outfit', sans-serif", fontSize: '1.8rem', letterSpacing: '1px' }}>¿Quién eres?</h3>
              {requiresName ? (
                  <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
                      <p style={{ marginBottom: '25px', fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          ¡Hola! Vemos que es tu primera vez con Google. Si ya habías hecho una porra, <strong>búscate en la lista</strong>. Si no, <strong>escribe un nombre nuevo</strong>.
                      </p>
                      
                      <select 
                          className="glass-select" 
                          style={{ width: '100%', marginBottom: '15px', fontSize: '1rem', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
                          value={decodedParticipants.some(p => p.name === newNameInput) ? newNameInput : ""}
                          onChange={(e) => setNewNameInput(e.target.value)}
                      >
                          <option value="" disabled hidden>Elige tu nombre en la lista...</option>
                          {decodedParticipants
                              .filter(p => !claimedNames.includes(p.name))
                              .map(p => (
                              <option key={p.hash} value={p.name}>{p.name}</option>
                          ))}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                          <div style={{ margin: '0 15px', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>O crea uno</div>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                      </div>

                      <input 
                        type="text" 
                        placeholder="Nombre nuevo (ej: MiPrimo)" 
                        value={newNameInput}
                        onChange={(e) => setNewNameInput(e.target.value)}
                        className="glass-input" 
                        style={{ width: '100%', marginBottom: '25px', padding: '12px', fontSize: '1rem', borderRadius: '8px', textAlign: 'center' }}
                      />
                      <button className="glass-btn primary-btn" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', letterSpacing: '1px' }} onClick={handleNameSubmit}>
                          Vincular y Entrar
                      </button>
                      <button className="glass-btn" style={{ marginTop: '15px', fontSize: '0.85rem', padding: '8px 15px', opacity: 0.8, width: '100%' }} onClick={() => { setShowMyBetModal(false); navigate('/', { replace: true, state: {} }); }}>
                          Volver al inicio
                      </button>
                  </div>
              ) : (
                  <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
                      <p style={{ marginBottom: '30px', fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
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
                      <button className="glass-btn" style={{ marginTop: '10px', fontSize: '0.85rem', padding: '8px 15px', opacity: 0.8 }} onClick={() => { setShowMyBetModal(false); navigate('/', { replace: true, state: {} }); }}>
                          Volver al inicio
                      </button>
                  </div>
              )}
          </div>
      </div>

      
      <BetViewer />
    </>
  );
}

export default Layout;
