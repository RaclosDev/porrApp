import { useState, useEffect } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import {
  fetchSyncStatus,
  overrideMatchResult,
  fetchMatches,
  fetchCompetitions,
  importCompetitionData,
} from '../services/api';

/**
 * Botón genérico para realizar acciones de refresco o llamadas a API del administrador.
 *
 * @param {Object} props
 * @param {string} props.id - ID de la acción.
 * @param {string} props.endpoint - Endpoint de la API a llamar.
 * @param {string} props.label - Texto a mostrar.
 * @param {string} props.status - Estado actual de la llamada ('idle', 'loading', 'ok', 'error').
 * @param {Function} props.onRefresh - Callback que ejecuta la llamada pasando id y endpoint.
 */
const RefreshBtn = ({ id, endpoint, label, status, onRefresh }) => {
  return (
    <button
      onClick={() => onRefresh(id, endpoint)}
      disabled={status === 'loading'}
      style={{
        padding: '8px 18px',
        borderRadius: '8px',
        border: 'none',
        cursor: status === 'loading' ? 'wait' : 'pointer',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        background:
          status === 'ok' ? '#00b894' : status === 'error' ? '#ff4757' : 'rgba(255,255,255,0.1)',
        color: 'white',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          animation: status === 'loading' ? 'spin 1s linear infinite' : 'none',
        }}
      >
        🔄
      </span>
      {status === 'loading'
        ? 'Actualizando...'
        : status === 'ok'
          ? '✅ Actualizado'
          : status === 'error'
            ? '❌ Error'
            : label}
    </button>
  );
};

/**
 * Componente principal del Panel de Administración.
 * Permite ejecutar backups, sincronizar datos y ver las conexiones de los usuarios.
 * Protegido por contraseña y token de administrador.
 *
 * @component
 * @returns {JSX.Element} Panel de administración renderizado.
 */
function Admin() {
  const {
    isRaclos,
    isAdminAuthenticated,
    loading,
    expandedUser,
    setExpandedUser,
    refreshStatus,
    password,
    setPassword,
    loginError,
    handleLogin,
    handleRefresh,
    handleSnapshot,
    handleLogout,
    unifiedUsers,
    handleDeleteLog,
  } = useAdminData();

  const [syncOverview, setSyncOverview] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [matchesList, setMatchesList] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [manualHomeScore, setManualHomeScore] = useState('');
  const [manualAwayScore, setManualAwayScore] = useState('');
  const [manualStatus, setManualStatus] = useState('FINISHED');
  const [manualSubmitStatus, setManualSubmitStatus] = useState(null);
  const [manualMessage, setManualMessage] = useState('');
  const [competitionsList, setCompetitionsList] = useState([]);
  const [selectedCompToImport, setSelectedCompToImport] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState('');

  const loadSyncData = async () => {
    try {
      setSyncLoading(true);
      const data = await fetchSyncStatus();
      setSyncOverview(data);
    } catch (err) {
      console.error('Error fetching sync overview', err);
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadSyncData();
      fetchMatches()
        .then((m) => {
          if (Array.isArray(m)) setMatchesList(m);
        })
        .catch(() => {});
      fetchCompetitions()
        .then((c) => {
          if (Array.isArray(c)) {
            setCompetitionsList(c);
            if (c.length > 0 && !selectedCompToImport) {
              setSelectedCompToImport(String(c[0].id));
            }
          }
        })
        .catch(() => {});
    }
  }, [isAdminAuthenticated]);

  const handleImportCompetition = async () => {
    if (!selectedCompToImport) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const res = await importCompetitionData(selectedCompToImport);
      setImportResult(
        `✅ Éxito: Importados ${res.importedTeams || 0} equipos y ${res.importedMatches || 0} partidos para ${res.competition || 'la competición'}.`,
      );
      loadSyncData();
      const m = await fetchMatches();
      if (Array.isArray(m)) setMatchesList(m);
    } catch (err) {
      setImportResult(`❌ Error al importar: ${err.message || err}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleManualOverride = async (e) => {
    e.preventDefault();
    if (!selectedMatchId || manualHomeScore === '' || manualAwayScore === '') {
      setManualMessage('Por favor completa todos los campos requeridos');
      setManualSubmitStatus('error');
      return;
    }
    setManualSubmitStatus('loading');
    setManualMessage('');
    try {
      await overrideMatchResult(
        Number(selectedMatchId),
        Number(manualHomeScore),
        Number(manualAwayScore),
        manualStatus,
      );
      setManualSubmitStatus('ok');
      setManualMessage('Resultado actualizado y puntuaciones recalculadas exitosamente');
      loadSyncData();
      const m = await fetchMatches();
      if (Array.isArray(m)) setMatchesList(m);
      setTimeout(() => {
        setManualSubmitStatus(null);
        setManualMessage('');
      }, 4000);
    } catch (err) {
      setManualSubmitStatus('error');
      setManualMessage(err.message || 'Error al actualizar el partido');
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading)
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        Cargando panel de administración...
      </div>
    );

  if (!isRaclos) {
    return (
      <section
        id="view-admin"
        className="view-section"
        style={{
          display: 'block',
          opacity: 1,
          padding: '20px',
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div className="section-header">
          <h2 style={{ color: '#ff4757' }}>🚫 Acceso Denegado</h2>
          <p>No tienes permisos para ver esta página.</p>
        </div>
      </section>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <section
        id="view-admin"
        className="view-section"
        style={{
          display: 'block',
          opacity: 1,
          padding: '20px',
          maxWidth: '400px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div className="section-header">
          <h2 style={{ color: '#fbc531' }}>🔐 Identificación Requerida</h2>
          <p>Introduce la contraseña para acceder al panel de administración.</p>
        </div>
        <form
          onSubmit={handleLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          <input
            type="password"
            className="glass-input"
            placeholder="Contraseña"
            aria-label="Contraseña de Administrador"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', fontSize: '1.1rem' }}
          />
          {loginError && <div style={{ color: '#ff4757' }}>{loginError}</div>}
          <button type="submit" className="glass-btn primary-btn" style={{ padding: '10px' }}>
            Entrar
          </button>
        </form>
      </section>
    );
  }

  return (
    <section
      id="view-admin"
      className="view-section"
      style={{ display: 'block', opacity: 1, padding: '20px', maxWidth: '800px', margin: '0 auto' }}
    >
      <div className="section-header" style={{ position: 'relative' }}>
        <h2 style={{ color: '#ff4757' }}>👑 Panel de Administración</h2>
        <p>Historial de conexiones de todos los usuarios.</p>
        <button
          onClick={handleLogout}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'transparent',
            border: '1px solid #ff4757',
            color: '#ff4757',
            padding: '5px 10px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Botones de Refresco y Backups */}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '18px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            width: '100%',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          🛠️ Herramientas de Administrador
        </div>
        <RefreshBtn
          id="scorers"
          endpoint="scorers"
          label="⚽ Refrescar Pichichi"
          status={refreshStatus['scorers']}
          onRefresh={handleRefresh}
        />
        <RefreshBtn
          id="sync"
          endpoint="admin/sync"
          label="🔄 Sincronizar Resultados"
          status={refreshStatus['sync']}
          onRefresh={handleRefresh}
        />

        {/* Botón de Snapshot */}
        <button
          onClick={handleSnapshot}
          disabled={refreshStatus['snapshot'] === 'loading'}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            cursor: refreshStatus['snapshot'] === 'loading' ? 'wait' : 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            background:
              refreshStatus['snapshot'] === 'ok'
                ? '#00b894'
                : refreshStatus['snapshot'] === 'error'
                  ? '#ff4757'
                  : '#0984e3',
            color: 'white',
            transition: 'background 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              animation:
                refreshStatus['snapshot'] === 'loading' ? 'spin 1s linear infinite' : 'none',
            }}
          >
            🛡️
          </span>
          {refreshStatus['snapshot'] === 'loading'
            ? 'Guardando...'
            : refreshStatus['snapshot'] === 'ok'
              ? '✅ Guardado'
              : refreshStatus['snapshot'] === 'error'
                ? '❌ Error'
                : 'Guardar Backup de Porras'}
        </button>
      </div>

      {/* Panel de Sincronización y Observabilidad Deportiva (Fase 4) */}
      <div
        style={{
          marginTop: '20px',
          padding: '18px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#00cec9' }}>
            📡 Sincronización Deportiva y Proveedores
          </div>
          <button
            onClick={loadSyncData}
            disabled={syncLoading}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              cursor: syncLoading ? 'wait' : 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {syncLoading ? 'Actualizando...' : '🔄 Actualizar Estado'}
          </button>
        </div>

        {/* Importador Multi-Competición ESPN */}
        <div
          style={{
            background: 'rgba(0, 206, 201, 0.08)',
            border: '1px solid rgba(0, 206, 201, 0.25)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '0.9rem',
              color: '#00cec9',
              marginBottom: '8px',
            }}
          >
            📥 Importador Automático de Competición (ESPN API)
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Descarga directamente de ESPN todos los equipos con sus escudos oficiales y los partidos
            del calendario de la competición seleccionada.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={selectedCompToImport}
              onChange={(e) => setSelectedCompToImport(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '0.85rem',
              }}
            >
              {competitionsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.externalId || 'sin slug'}) [{c.formatType || 'LEAGUE'}]
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleImportCompetition}
              disabled={importLoading || !selectedCompToImport}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#00cec9',
                color: '#1a1a1a',
                fontWeight: 'bold',
                cursor: importLoading ? 'wait' : 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {importLoading ? 'Importando...' : '⚡ Descargar Equipos y Partidos'}
            </button>
          </div>
          {importResult && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '0.85rem',
                color: importResult.startsWith('✅') ? '#00b894' : '#ff7675',
              }}
            >
              {importResult}
            </div>
          )}
        </div>

        {syncOverview ? (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estado Sync</div>
                <div
                  style={{
                    fontWeight: 'bold',
                    color:
                      syncOverview.status === 'SUCCESS' || syncOverview.status === 'HEALTHY'
                        ? '#00b894'
                        : syncOverview.status === 'circuit_breaker_open'
                          ? '#ff4757'
                          : '#fbc531',
                  }}
                >
                  {syncOverview.status || 'N/A'}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Proveedor Activo
                </div>
                <div style={{ fontWeight: 'bold', color: 'white' }}>
                  {syncOverview.defaultProvider || 'ESPN'}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Último Refresco
                </div>
                <div style={{ fontWeight: 'bold', color: 'white', fontSize: '0.85rem' }}>
                  {syncOverview.lastSyncTime ? formatDate(syncOverview.lastSyncTime) : 'Pendiente'}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Partidos Actualizados
                </div>
                <div style={{ fontWeight: 'bold', color: '#00cec9' }}>
                  {syncOverview.matchesUpdated ?? 0}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Proveedores registrados:{' '}
              <span style={{ color: 'white' }}>
                {Array.isArray(syncOverview.availableProviders)
                  ? syncOverview.availableProviders.join(', ')
                  : 'ESPN'}
              </span>
            </div>

            {Array.isArray(syncOverview.recentLogs) && syncOverview.recentLogs.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                  }}
                >
                  📋 Últimas Sincronizaciones Auditadas:
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      fontSize: '0.8rem',
                      borderCollapse: 'collapse',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <th style={{ padding: '6px' }}>Fecha</th>
                        <th style={{ padding: '6px' }}>Proveedor</th>
                        <th style={{ padding: '6px' }}>Competición</th>
                        <th style={{ padding: '6px' }}>Estado</th>
                        <th style={{ padding: '6px' }}>Partidos</th>
                        <th style={{ padding: '6px' }}>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncOverview.recentLogs.slice(0, 5).map((log) => (
                        <tr
                          key={log.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <td style={{ padding: '6px' }}>{formatDate(log.syncedAt)}</td>
                          <td style={{ padding: '6px', color: '#00cec9' }}>{log.providerName}</td>
                          <td style={{ padding: '6px' }}>{log.competitionCode || 'General'}</td>
                          <td
                            style={{
                              padding: '6px',
                              color: log.status === 'SUCCESS' ? '#00b894' : '#ff4757',
                            }}
                          >
                            {log.status}
                          </td>
                          <td style={{ padding: '6px' }}>{log.matchesUpdated}</td>
                          <td style={{ padding: '6px' }}>{log.durationMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Cargando estado del servicio de datos...
          </div>
        )}
      </div>

      {/* Formulario de Corrección Manual de Resultados (Fase 4) */}
      <div
        style={{
          marginTop: '20px',
          padding: '18px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fbc531', marginBottom: '10px' }}
        >
          ⚖️ Corrección Manual de Resultados de Partidos
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Permite corregir o forzar el resultado de cualquier partido. Al guardar se recalcularán
          inmediatamente las puntuaciones de todos los participantes y se notificará en tiempo real.
        </p>

        <form onSubmit={handleManualOverride}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                Seleccionar Partido:
              </label>
              <select
                value={selectedMatchId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedMatchId(id);
                  const found = matchesList.find((m) => String(m.id) === String(id));
                  if (found) {
                    setManualHomeScore(
                      found.homeScore !== null && found.homeScore !== undefined
                        ? String(found.homeScore)
                        : '0',
                    );
                    setManualAwayScore(
                      found.awayScore !== null && found.awayScore !== undefined
                        ? String(found.awayScore)
                        : '0',
                    );
                    setManualStatus(found.status || 'FINISHED');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  fontSize: '0.9rem',
                }}
              >
                <option value="">-- Elige un partido para corregir --</option>
                {matchesList.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} - {m.homeTeam?.name || 'Local'} ({m.homeScore ?? '-'}) vs (
                    {m.awayScore ?? '-'}) {m.awayTeam?.name || 'Visitante'} [
                    {m.status || (m.finished ? 'FINISHED' : 'SCHEDULED')}]
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Goles Local:
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualHomeScore}
                  onChange={(e) => setManualHomeScore(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 120px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Goles Visitante:
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualAwayScore}
                  onChange={(e) => setManualAwayScore(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 160px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Estado Canónico:
                </label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                >
                  <option value="FINISHED">FINALIZADO (FINISHED)</option>
                  <option value="LIVE">EN DIRECTO (LIVE)</option>
                  <option value="PAUSED">EN DESCANSO (PAUSED)</option>
                  <option value="SCHEDULED">PROGRAMADO (SCHEDULED)</option>
                  <option value="POSTPONED">APLAZADO (POSTPONED)</option>
                  <option value="CANCELLED">CANCELADO (CANCELLED)</option>
                </select>
              </div>
            </div>

            {manualMessage && (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: manualSubmitStatus === 'ok' ? '#00b894' : '#ff4757',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                {manualMessage}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={manualSubmitStatus === 'loading' || !selectedMatchId}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#fbc531',
                  color: '#1e272e',
                  fontWeight: 'bold',
                  cursor:
                    !selectedMatchId || manualSubmitStatus === 'loading'
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: !selectedMatchId ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {manualSubmitStatus === 'loading'
                  ? 'Guardando...'
                  : '💾 Guardar y Recalcular Puntuaciones'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Directorio Unificado de Usuarios */}
      <div style={{ marginTop: '24px' }}>
        <h3
          style={{
            color: '#00cec9',
            marginBottom: '15px',
            borderBottom: '1px solid rgba(0, 206, 201, 0.3)',
            paddingBottom: '10px',
          }}
        >
          👥 Directorio de Usuarios ({unifiedUsers.length})
        </h3>
        {unifiedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay usuarios ni conexiones registradas todavía.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '15px',
            }}
          >
            {unifiedUsers.map((user) => {
              const isExpanded = expandedUser === user.name;
              return (
                <div
                  key={user.name}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: user.googleEmail
                      ? '1px solid rgba(0, 206, 201, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  <div
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            background: user.googleEmail ? '#00cec9' : '#ff4757',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                          }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                        {user.name}
                      </div>
                    </div>

                    {user.googleEmail ? (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '10px',
                        }}
                      >
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                          alt="Google"
                          style={{ width: '14px', height: '14px' }}
                        />
                        {user.googleEmail}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '10px',
                        }}
                      >
                        👁️ Perfil de Visitante
                      </div>
                    )}

                    <div
                      style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}
                    >
                      Última conexión:{' '}
                      <span style={{ color: 'white' }}>
                        {user.lastConnection ? formatDate(user.lastConnection) : 'Nunca'}
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : user.name)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-color)',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        marginTop: '12px',
                        transition: 'background 0.2s',
                      }}
                    >
                      {isExpanded
                        ? 'Ocultar Accesos ▲'
                        : `Ver Accesos (${user.allConnections.length}) ▼`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.2)',
                      }}
                    >
                      {user.allConnections.length === 0 ? (
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                          }}
                        >
                          No hay registros de conexión.
                        </div>
                      ) : (
                        <ul
                          style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {user.allConnections.slice(0, 12).map((conn) => (
                            <li
                              key={conn.id}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.05)',
                              }}
                            >
                              <span>{formatDate(conn.connectedAt)}</span>
                              <button
                                onClick={() => handleDeleteLog(conn.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ff4757',
                                  cursor: 'pointer',
                                  padding: '0',
                                  fontSize: '1rem',
                                }}
                                title="Borrar registro"
                                aria-label="Borrar registro de conexión"
                              >
                                🗑️
                              </button>
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
