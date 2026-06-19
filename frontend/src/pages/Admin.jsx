import { useState, useEffect, useMemo } from 'react';
import { fetchConnectionHistory, setAdminToken, getAdminToken, deleteConnectionLog, fetchRegisteredUsers } from '../services/api';
import { useAppContext } from '../context/AppContext';

const API_BASE = '/api';

async function callRefresh(endpoint) {
  const res = await fetch(`${API_BASE}/${endpoint}/refresh`, { method: 'POST' });
  return res.ok ? res.json() : null;
}

function Admin() {
  const { isRaclos, isAdminAuthenticated, setIsAdminAuthenticated } = useAppContext();
  const [history, setHistory] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState({});
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    setLoading(true);
    fetchConnectionHistory().then(data => {
      if (data) setHistory(data);
    });
    fetchRegisteredUsers().then(data => {
      if (data) setRegisteredUsers(data);
      setLoading(false);
    });
  }, [isAdminAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            const data = await res.json();
            setAdminToken(data.token);
            setIsAdminAuthenticated(true);
        } else {
            setLoginError('Contraseña incorrecta');
        }
    } catch (err) {
        setLoginError('Error de red');
    }
  };

  const handleRefresh = async (key, endpoint) => {
    setRefreshStatus(s => ({ ...s, [key]: 'loading' }));
    try {
      const result = await callRefresh(endpoint);
      setRefreshStatus(s => ({ ...s, [key]: result ? 'ok' : 'error' }));
    } catch {
      setRefreshStatus(s => ({ ...s, [key]: 'error' }));
    }
    setTimeout(() => setRefreshStatus(s => ({ ...s, [key]: null })), 3000);
  };

  const handleSnapshot = async () => {
    setRefreshStatus(s => ({ ...s, snapshot: 'loading' }));
    try {
      const res = await fetch(`${API_BASE}/admin/backups/snapshot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAdminToken() || ''}` }
      });
      setRefreshStatus(s => ({ ...s, snapshot: res.ok ? 'ok' : 'error' }));
    } catch {
      setRefreshStatus(s => ({ ...s, snapshot: 'error' }));
    }
    setTimeout(() => setRefreshStatus(s => ({ ...s, snapshot: null })), 3000);
  };

  const handleLogout = () => {
    setAdminToken(null);
    setIsAdminAuthenticated(false);
  };

  const unifiedUsers = useMemo(() => {
    const usersMap = {};

    registeredUsers.forEach(u => {
      usersMap[u.participantName] = {
        name: u.participantName,
        googleEmail: u.googleEmail,
        googleName: u.googleName,
        allConnections: [],
        lastConnection: null
      };
    });

    history.forEach(log => {
      if (!usersMap[log.participantName]) {
        usersMap[log.participantName] = {
          name: log.participantName,
          googleEmail: null,
          googleName: null,
          allConnections: [],
          lastConnection: null
        };
      }
      usersMap[log.participantName].allConnections.push(log);
    });

    return Object.values(usersMap).map(user => {
      user.allConnections.sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt));
      if (user.allConnections.length > 0) {
        user.lastConnection = user.allConnections[0].connectedAt;
      }
      return user;
    }).sort((a, b) => {
      if (!a.lastConnection && !b.lastConnection) return a.name.localeCompare(b.name);
      if (!a.lastConnection) return 1;
      if (!b.lastConnection) return -1;
      return new Date(b.lastConnection) - new Date(a.lastConnection);
    });
  }, [history, registeredUsers]);

  const handleDeleteLog = async (id) => {
    try {
      const res = await deleteConnectionLog(id);
      if (res.ok) {
        setHistory(prev => prev.filter(log => log.id !== id));
      }
    } catch (e) {
      console.error('Error al borrar registro', e);
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const RefreshBtn = ({ id, endpoint, label }) => {
    const status = refreshStatus[id];
    return (
      <button
        onClick={() => handleRefresh(id, endpoint)}
        disabled={status === 'loading'}
        style={{
          padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: status === 'loading' ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
          background: status === 'ok' ? '#00b894' : status === 'error' ? '#ff4757' : 'rgba(255,255,255,0.1)',
          color: 'white', transition: 'background 0.3s', display: 'flex', alignItems: 'center', gap: '6px'
        }}
      >
        <span style={{ display: 'inline-block', animation: status === 'loading' ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
        {status === 'loading' ? 'Actualizando...' : status === 'ok' ? '✅ Actualizado' : status === 'error' ? '❌ Error' : label}
      </button>
    );
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando panel de administración...</div>;

  if (!isRaclos) {
    return (
      <section id="view-admin" className="view-section" style={{ display: 'block', opacity: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div className="section-header">
          <h2 style={{ color: '#ff4757' }}>🚫 Acceso Denegado</h2>
          <p>No tienes permisos para ver esta página.</p>
        </div>
      </section>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <section id="view-admin" className="view-section" style={{ display: 'block', opacity: 1, padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <div className="section-header">
          <h2 style={{ color: '#fbc531' }}>🔐 Identificación Requerida</h2>
          <p>Introduce la contraseña para acceder al panel de administración.</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="password" 
            className="glass-input" 
            placeholder="Contraseña" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ padding: '10px', fontSize: '1.1rem' }}
          />
          {loginError && <div style={{ color: '#ff4757' }}>{loginError}</div>}
          <button type="submit" className="glass-btn primary-btn" style={{ padding: '10px' }}>Entrar</button>
        </form>
      </section>
    );
  }

  return (
    <section id="view-admin" className="view-section" style={{ display: 'block', opacity: 1, padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="section-header" style={{ position: 'relative' }}>
        <h2 style={{ color: '#ff4757' }}>👑 Panel de Administración</h2>
        <p>Historial de conexiones de todos los usuarios.</p>
        <button 
          onClick={handleLogout}
          style={{ position: 'absolute', top: 0, right: 0, background: 'transparent', border: '1px solid #ff4757', color: '#ff4757', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Botones de Refresco y Backups */}
      <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '18px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: '100%', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>🛠️ Herramientas de Administrador</div>
        <RefreshBtn id="scorers" endpoint="scorers" label="⚽ Refrescar Pichichi" />
        <RefreshBtn id="sync" endpoint="admin/sync" label="🔄 Sincronizar Resultados" />
        
        {/* Botón de Snapshot */}
        <button
          onClick={handleSnapshot}
          disabled={refreshStatus['snapshot'] === 'loading'}
          style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: refreshStatus['snapshot'] === 'loading' ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            background: refreshStatus['snapshot'] === 'ok' ? '#00b894' : refreshStatus['snapshot'] === 'error' ? '#ff4757' : '#0984e3',
            color: 'white', transition: 'background 0.3s', display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <span style={{ display: 'inline-block', animation: refreshStatus['snapshot'] === 'loading' ? 'spin 1s linear infinite' : 'none' }}>🛡️</span>
          {refreshStatus['snapshot'] === 'loading' ? 'Guardando...' : refreshStatus['snapshot'] === 'ok' ? '✅ Guardado' : refreshStatus['snapshot'] === 'error' ? '❌ Error' : 'Guardar Backup de Apuestas'}
        </button>
      </div>

      {/* Directorio Unificado de Usuarios */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ color: '#00cec9', marginBottom: '15px', borderBottom: '1px solid rgba(0, 206, 201, 0.3)', paddingBottom: '10px' }}>
          👥 Directorio de Usuarios ({unifiedUsers.length})
        </h3>
        {unifiedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay usuarios ni conexiones registradas todavía.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {unifiedUsers.map(user => {
              const isExpanded = expandedUser === user.name;
              return (
                <div key={user.name} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: user.googleEmail ? '1px solid rgba(0, 206, 201, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ background: user.googleEmail ? '#00cec9' : '#ff4757', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                  {user.name.charAt(0).toUpperCase()}
                              </span>
                              {user.name}
                          </div>
                      </div>
                      
                      {user.googleEmail ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" style={{ width: '14px', height: '14px' }} />
                          {user.googleEmail}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          👁️ Perfil de Visitante
                        </div>
                      )}
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Última conexión: <span style={{ color: 'white' }}>{user.lastConnection ? formatDate(user.lastConnection) : 'Nunca'}</span>
                      </div>

                      <button onClick={() => setExpandedUser(isExpanded ? null : user.name)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-color)', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '12px', transition: 'background 0.2s' }}>
                          {isExpanded ? 'Ocultar Accesos ▲' : `Ver Accesos (${user.allConnections.length}) ▼`}
                      </button>
                  </div>

                  {isExpanded && (
                       <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                         {user.allConnections.length === 0 ? (
                             <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>No hay registros de conexión.</div>
                         ) : (
                             <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                               {user.allConnections.slice(0, 12).map((conn) => (
                                 <li key={conn.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                   <span>{formatDate(conn.connectedAt)}</span>
                                   <button onClick={() => handleDeleteLog(conn.id)} style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: '0', fontSize: '1rem' }} title="Borrar registro">🗑️</button>
                                 </li>
                               ))}
                             </ul>
                         )}
                       </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default Admin;
