import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { decodeHash } from '../utils/hash';
import BetViewer from './BetViewer';

function Layout({ children }) {
  const { participantsHashes, userName, setUserName, setViewerHash, onlineUsers, isRaclos } = useAppContext();
  const navigate = useNavigate();
  const [showMyBetModal, setShowMyBetModal] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [selectedUserHash, setSelectedUserHash] = useState(localStorage.getItem('my_bet_hash') || '');
  
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };
  
  const isStandalone = () => {
    return ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
  };

  useEffect(() => {
    if (!localStorage.getItem('my_bet_hash')) {
        setShowMyBetModal(true);
    }

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

  const handleSaveMyBet = () => {
    if (selectedUserHash) {
        localStorage.setItem('my_bet_hash', selectedUserHash);
        const selectedPart = participantsHashes.find(h => h.hash === selectedUserHash);
        if (selectedPart) {
            const decoded = decodeHash(selectedPart.hash);
            if (decoded) {
                localStorage.setItem('my_bet_name', decoded.user);
                setUserName(decoded.user);
            }
        }
        setShowMyBetModal(false);
    }
  };

  const decodedParticipants = participantsHashes.map(h => ({
    hash: h.hash,
    name: decodeHash(h.hash)?.user || 'Anónimo'
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
                {userName && participantsHashes.find(h => decodeHash(h.hash)?.user === userName) && (
                    <button id="btn-view-my-bet-header" style={{ background: 'linear-gradient(135deg, #f368e0, #ff9ff3)', border: 'none', color: 'black', padding: '5px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setViewerHash(participantsHashes.find(h => decodeHash(h.hash)?.user === userName)?.hash)}>
                        👀 Ver Mi Porra
                    </button>
                )}
            </div>
        </div>
        <div className="header-center">
            <nav className="nav-links">
                <NavLink to="/" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Inicio</NavLink>
                <NavLink to="/clasificacion" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Clasificación</NavLink>
                <NavLink to="/radar" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Partidos</NavLink>
                <NavLink to="/search" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>🔍 Buscador</NavLink>
                <NavLink to="/stats" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Más Elegidos</NavLink>
                <NavLink to="/reglas" className={({isActive}) => isActive ? "glass-btn active" : "glass-btn"}>Reglas</NavLink>
            </nav>
        </div>
        <div className="header-right" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
            <button 
                onClick={() => {
                    if (isRaclos) {
                        navigate('/admin');
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
                title="Identifícate"
            >
                <span style={{ fontSize: '1.1rem' }}>👤</span>
                {(userName || localStorage.getItem('my_bet_name')) && (
                    <span style={{ fontWeight: 'bold' }}>{userName || localStorage.getItem('my_bet_name')}</span>
                )}
            </button>
        </div>
      </header>

      <div id="news-ticker" style={{ background: 'rgba(20, 20, 30, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', width: '100%', padding: '8px 20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap', height: '35px', boxSizing: 'border-box' }}>
          <div id="news-ticker-marquee" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              <div id="news-ticker-text" style={{ color: 'var(--accent-color)', fontWeight: 600, letterSpacing: '0.5px', transition: 'opacity 0.5s, transform 0.5s', display: 'inline-block' }}>
                  🌍 Dato: 9 personas han elegido a Kylian Mbappe como Máximo Goleador.
              </div>
          </div>
      </div>

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
          <div className="modal-content" style={{ maxWidth: '400px' }}>
              <h3 style={{ color: 'var(--accent-color)', marginBottom: '15px' }}>¿Quién eres?</h3>
              <p style={{ marginBottom: '20px' }}>Elige tu nombre en la lista para que guardemos tu apuesta en este dispositivo.</p>
              <select 
                  id="my-bet-input" 
                  className="glass-select" 
                  style={{ width: '100%', marginBottom: '20px', fontSize: '1.1em', padding: '10px', cursor: localStorage.getItem('my_bet_hash') ? 'not-allowed' : 'pointer' }}
                  value={selectedUserHash}
                  onChange={(e) => setSelectedUserHash(e.target.value)}
                  disabled={!!localStorage.getItem('my_bet_hash')}
              >
                  <option value="" disabled hidden>Selecciona tu nombre</option>
                  {decodedParticipants.map(p => (
                      <option key={p.hash} value={p.hash}>{p.name}</option>
                  ))}
              </select>
              <div className="action-buttons">
                  <button id="btn-save-my-bet" className="glass-btn primary-btn" style={{ width: '100%' }} onClick={handleSaveMyBet}>
                      Guardar y Continuar
                  </button>
              </div>
          </div>
      </div>
      
      <div id="rtve-modal" className="modal" style={{ display: 'none', zIndex: 9999999 }}>
          <div className="modal-content" style={{ maxWidth: '1100px', width: '95%', padding: '15px', background: 'black', border: '2px solid #ff4757', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px', position: 'relative' }}>
                  <button onClick={() => {
                      document.getElementById('rtve-modal').style.display = 'none';
                      const r = document.getElementById('rtve-iframe'); if(r) r.src = '';
                      const s = document.getElementById('stream-iframe'); if(s) s.src = '';
                  }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', position: 'absolute', right: 0, top: '-5px' }}>❌</button>
              </div>

              <div id="player-container-rtve" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '8px' }}>
                  <iframe id="rtve-iframe" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} src="" frameBorder="0" allow="autoplay; fullscreen; encrypted-media" allowFullScreen></iframe>
              </div>

              <div id="player-container-stream" style={{ display: 'none', position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '8px' }}>
                  <iframe id="stream-iframe" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} src="" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen></iframe>
              </div>
          </div>
      </div>
      
      <BetViewer />
    </>
  );
}

export default Layout;
