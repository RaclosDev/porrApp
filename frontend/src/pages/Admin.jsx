import { useState, useEffect, useMemo } from 'react';
import { fetchConnectionHistory, setAdminToken } from '../services/api';
import { useAppContext } from '../context/AppContext';

const API_BASE = '/api';

async function callRefresh(endpoint) {
  const res = await fetch(`${API_BASE}/${endpoint}/refresh`, { method: 'POST' });
  return res.ok ? res.json() : null;
}

function Admin() {
  const { isRaclos, isAdminAuthenticated, setIsAdminAuthenticated } = useAppContext();
  const [history, setHistory] = useState([]);
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

  const groupedHistory = useMemo(() => {
    const groups = {};
    history.forEach(log => {
      if (!groups[log.participantName]) groups[log.participantName] = [];
      groups[log.participantName].push(log.connectedAt);
    });
    return Object.entries(groups).map(([name, dates]) => {
      dates.sort((a, b) => new Date(b) - new Date(a));
      return { name, lastConnection: dates[0], allConnections: dates };
    }).sort((a, b) => new Date(b.lastConnection) - new Date(a.lastConnection));
  }, [history]);

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
      <div className="section-header">
        <h2 style={{ color: '#ff4757' }}>👑 Panel de Administración</h2>
        <p>Historial de conexiones de todos los usuarios.</p>
      </div>

      {/* Botones de Refresco */}
      <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '18px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: '100%', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>🛠️ Refrescos Manuales</div>
        <RefreshBtn id="scorers" endpoint="scorers" label="⚽ Refrescar Pichichi" />
        <RefreshBtn id="sync" endpoint="admin/sync" label="🔄 Sincronizar Resultados" />
      </div>

      {/* Historial de Conexiones */}
      <div style={{ marginTop: '24px' }}>
        {groupedHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay conexiones registradas todavía.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groupedHistory.map((user) => {
              const isExpanded = expandedUser === user.name;
              return (
                <div key={user.name} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid rgba(255, 71, 87, 0.3)', overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpandedUser(isExpanded ? null : user.name)}
                    style={{ padding: '15px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? 'rgba(255, 71, 87, 0.1)' : 'transparent', transition: 'background 0.3s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ background: '#ff4757', color: 'white', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{user.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Última conexión: {formatDate(user.lastConnection)}</div>
                      </div>
                    </div>
                    <div style={{ color: '#ff4757', fontWeight: 'bold', fontSize: '1.2rem' }}>{isExpanded ? '▲' : '▼'}</div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '15px 20px', borderTop: '1px solid rgba(255, 71, 87, 0.2)', background: 'rgba(0,0,0,0.1)' }}>
                      <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-color)', fontSize: '0.95rem' }}>Registro de accesos ({user.allConnections.length})</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                        {user.allConnections.map((conn, idx) => (
                          <li key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {formatDate(conn)}
                          </li>
                        ))}
                      </ul>
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
