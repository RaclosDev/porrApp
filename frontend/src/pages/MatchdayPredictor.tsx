import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  fetchMatchdayFixtures,
  submitMatchdayPredictions,
  fetchMissingRoundUsers,
} from '../services/api';
import Flag from '../components/Flag';
import MatchFriendsBetsModal from '../components/MatchFriendsBetsModal';

/**
 * Vista de Pronósticos por Jornada (1X2 y Marcador Exacto) - Fase 3
 * Permite a los participantes de ligas por jornadas pronosticar partido a partido,
 * con bloqueo individual por fecha de inicio y visualización de puntos obtenidos.
 */
function MatchdayPredictor() {
  const {
    activeGroupId,
    activeGroupName,
    activeGroupIsLocked,
    activeGroupAdminId,
    activeGroupAdmin,
    userId,
    userName,
    isAuthenticated,
  } = useAppContext();

  const isGroupAdmin =
    activeGroupAdminId?.toString() === userId?.toString() ||
    (activeGroupAdmin && activeGroupAdmin === userName);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRound, setSelectedRound] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'FINISHED'
  const [selectedMatchForFriends, setSelectedMatchForFriends] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localPredictions, setLocalPredictions] = useState({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // Consulta de usuarios que faltan por pronosticar la jornada (Solo visible para el admin)
  const { data: missingData } = useQuery({
    queryKey: ['missingRoundUsers', activeGroupId, selectedRound],
    queryFn: () => fetchMissingRoundUsers(activeGroupId, selectedRound),
    enabled: Boolean(activeGroupId && isGroupAdmin),
  });

  const handleWhatsAppNudge = () => {
    if (!missingData?.missingUsers || missingData.missingUsers.length === 0) return;
    const names = missingData.missingUsers.map((u) => `@${u.participantName}`).join(', ');
    const roundLabel = missingData.round || selectedRound || 'la jornada';
    const text = `⚠️ *¡AVISO PORRA - ${activeGroupName ? activeGroupName.toUpperCase() : 'LIGA'}!* ⚠️\n\nQueda poco tiempo para el inicio de *${roundLabel}*.\n\n🚨 *Faltan por pronosticar:* ${names}\n\n👉 ¡Entrad ya antes de que cierren los partidos!\n${window.location.origin}/jornadas`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Redirigir a mis-ligas si no hay liga seleccionada
  useEffect(() => {
    if (!activeGroupId && isAuthenticated) {
      navigate('/mis-ligas');
    }
  }, [activeGroupId, isAuthenticated, navigate]);

  // Carga de partidos de la jornada
  const { data: fixtures = [], isLoading } = useQuery({
    queryKey: ['matchdayFixtures', activeGroupId, selectedRound],
    queryFn: () => fetchMatchdayFixtures(activeGroupId, selectedRound),
    enabled: Boolean(activeGroupId),
  });

  // Inicializar estado local cuando llegan datos del backend
  useEffect(() => {
    if (fixtures.length > 0) {
      const initial = {};
      // Cargar borrador previo si existe en LocalStorage para esta liga
      let draft = {};
      try {
        const storedDraft = localStorage.getItem(`draft_matchday_${activeGroupId}`);
        if (storedDraft) draft = JSON.parse(storedDraft);
      } catch (e) {
        console.warn('Error reading matchday draft', e);
      }

      fixtures.forEach((f) => {
        const d = draft[f.matchId];
        // Solo usar borrador si el partido sigue abierto y no tiene predicción ya guardada en servidor
        const useDraft = !f.locked && d && (d.homeScore !== '' || d.sign !== '');
        initial[f.matchId] = {
          homeScore: useDraft
            ? d.homeScore
            : f.predHomeScore !== null && f.predHomeScore !== undefined
              ? String(f.predHomeScore)
              : '',
          awayScore: useDraft
            ? d.awayScore
            : f.predAwayScore !== null && f.predAwayScore !== undefined
              ? String(f.predAwayScore)
              : '',
          sign: useDraft ? d.sign : f.predSign || '',
        };
      });
      setLocalPredictions(initial);
    }
  }, [fixtures]);

  // Extraer rondas disponibles para el filtro
  const availableRounds = useMemo(() => {
    const rounds = new Set();
    fixtures.forEach((f) => {
      if (f.round) rounds.add(f.round);
      if (f.groupName) rounds.add(`Grupo ${f.groupName}`);
    });
    return Array.from(rounds);
  }, [fixtures]);

  // Mutación para guardar pronósticos
  const saveMutation = useMutation({
    mutationFn: (items) => submitMatchdayPredictions(activeGroupId, items),
    onSuccess: (data) => {
      setSaveSuccessMsg(data.message || '¡Pronósticos guardados correctamente!');
      setHasUnsavedChanges(false);
      try {
        localStorage.removeItem(`draft_matchday_${activeGroupId}`);
      } catch {
        /* ignore */
      }
      setSaveErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['matchdayFixtures'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setSaveErrorMsg(err.message || 'Error al guardar pronósticos');
      setSaveSuccessMsg('');
    },
  });

  const handleScoreChange = (matchId, side, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setLocalPredictions((prev) => {
      const current = prev[matchId] || { homeScore: '', awayScore: '', sign: '' };
      const updated = {
        ...current,
        [side === 'home' ? 'homeScore' : 'awayScore']: cleanVal,
      };

      // Si ambos campos tienen valor, auto-calcular el signo 1X2
      if (updated.homeScore !== '' && updated.awayScore !== '') {
        const h = parseInt(updated.homeScore, 10);
        const a = parseInt(updated.awayScore, 10);
        updated.sign = h > a ? '1' : h === a ? 'X' : '2';
      }

      const nextState = { ...prev, [matchId]: updated };
      setHasUnsavedChanges(true);
      try {
        localStorage.setItem(`draft_matchday_${activeGroupId}`, JSON.stringify(nextState));
      } catch {
        /* ignore */
      }
      return nextState;
    });
  };

  const handleQuickSign = (matchId, sign) => {
    setLocalPredictions((prev) => {
      const current = prev[matchId] || { homeScore: '', awayScore: '', sign: '' };
      // Asignar marcador por defecto sugerido según el signo
      let h = current.homeScore;
      let a = current.awayScore;
      if (sign === '1' && (h === '' || Number(h) <= Number(a))) {
        h = '2';
        a = '1';
      } else if (sign === 'X') {
        h = '1';
        a = '1';
      } else if (sign === '2' && (a === '' || Number(a) <= Number(h))) {
        h = '1';
        a = '2';
      }
      return {
        ...prev,
        [matchId]: { homeScore: h, awayScore: a, sign },
      };
    });
  };

  const handleSaveAll = () => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión con tu cuenta de Google para guardar tus pronósticos.');
      return;
    }

    const payload = [];
    Object.entries(localPredictions).forEach(([matchIdStr, pred]) => {
      const matchId = Number(matchIdStr);
      const fixture = fixtures.find((f) => f.matchId === matchId);
      // Solo enviar partidos que no estén bloqueados y que tengan pronóstico
      if (fixture && !fixture.locked && (pred.homeScore !== '' || pred.sign !== '')) {
        payload.push({
          matchId,
          homeScore: pred.homeScore !== '' ? parseInt(pred.homeScore, 10) : null,
          awayScore: pred.awayScore !== '' ? parseInt(pred.awayScore, 10) : null,
          sign: pred.sign || null,
        });
      }
    });

    if (payload.length === 0) {
      alert('No hay pronósticos nuevos o modificados para guardar en partidos abiertos.');
      return;
    }

    saveMutation.mutate(payload);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Fecha por confirmar';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Contar partidos pronosticados
  const predictedCount = useMemo(() => {
    return Object.values(localPredictions).filter((p) => p.homeScore !== '' || p.sign !== '')
      .length;
  }, [localPredictions]);

  // Filtrado por estado (Todos / Pendientes / Finalizados)
  const pendingCount = useMemo(() => {
    return fixtures.filter(
      (f) =>
        !f.locked &&
        (!localPredictions[f.matchId]?.homeScore || !localPredictions[f.matchId]?.sign),
    ).length;
  }, [fixtures, localPredictions]);

  const finishedCount = useMemo(() => {
    return fixtures.filter((f) => f.finished).length;
  }, [fixtures]);

  const displayedFixtures = useMemo(() => {
    if (statusFilter === 'PENDING') {
      return fixtures.filter(
        (f) =>
          !f.locked &&
          (!localPredictions[f.matchId]?.homeScore || !localPredictions[f.matchId]?.sign),
      );
    }
    if (statusFilter === 'FINISHED') {
      return fixtures.filter((f) => f.finished);
    }
    return fixtures;
  }, [fixtures, statusFilter, localPredictions]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 12px 60px' }}>
      {/* Cabecera de la jornada */}
      <div
        className="glass-panel"
        style={{
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          borderRadius: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                background: 'rgba(0, 210, 211, 0.15)',
                color: '#00d2d3',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid rgba(0, 210, 211, 0.3)',
              }}
            >
              ⚽ MODO JORNADA · 1X2 Y MARCADOR
            </span>
            {activeGroupIsLocked && (
              <span
                style={{
                  background: 'rgba(231, 76, 60, 0.2)',
                  color: '#e74c3c',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                🔒 Porra Cerrada
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', fontWeight: 800 }}>
            {activeGroupName || 'Liga de Pronósticos'}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Pronostica el marcador exacto y signo (1X2). Cada partido se bloquea individualmente a
            la hora de su inicio.
          </p>
        </div>

        {/* Acciones principales */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSaveAll}
            disabled={saveMutation.isPending || activeGroupIsLocked}
            className="glass-btn primary-btn"
            style={{
              padding: '10px 20px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.95rem',
              cursor: activeGroupIsLocked ? 'not-allowed' : 'pointer',
              opacity: activeGroupIsLocked ? 0.6 : 1,
            }}
          >
            {saveMutation.isPending
              ? '💾 Guardando...'
              : `💾 Guardar (${predictedCount}/${fixtures.length})`}
          </button>
        </div>
      </div>

      {/* Alertas de éxito o error */}
      {saveSuccessMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: 'rgba(0, 184, 148, 0.2)',
            border: '1px solid #00b894',
            color: '#55efc4',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✅</span> {saveSuccessMsg}
        </div>
      )}

      {saveErrorMsg && (
        <div
          role="alert"
          style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            color: '#ff7675',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span> {saveErrorMsg}
        </div>
      )}

      {/* Nudge Banner para el Administrador de la Porra */}
      {isGroupAdmin && missingData && missingData.missingCount > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 18px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: 'rgba(243, 156, 18, 0.12)',
            border: '1px solid rgba(243, 156, 18, 0.35)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                color: '#f39c12',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>📢</span>
              <span>
                Aviso de Organizador: Faltan {missingData.missingCount} por pronosticar{' '}
                {missingData.round || 'la jornada'}
              </span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Rezagados: {missingData.missingUsers.map((u) => u.participantName).join(', ')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleWhatsAppNudge}
            className="glass-btn"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '8px',
              background: '#25D366',
              color: '#000',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
            }}
          >
            <span>📲</span>
            <span>Avisar por WhatsApp</span>
          </button>
        </div>
      )}

      {/* Selector de ronda o jornada */}
      {availableRounds.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '10px',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => setSelectedRound('')}
            className={`glass-btn ${selectedRound === '' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '20px',
              whiteSpace: 'nowrap',
              background: selectedRound === '' ? '#00d2d3' : 'rgba(255,255,255,0.05)',
              color: selectedRound === '' ? '#000' : 'var(--text-light)',
            }}
          >
            Todas las Jornadas
          </button>
          {availableRounds.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRound(r)}
              className={`glass-btn ${selectedRound === r ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                background: selectedRound === r ? '#00d2d3' : 'rgba(255,255,255,0.05)',
                color: selectedRound === r ? '#000' : 'var(--text-light)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Pestañas de filtro rápido: Todos / Pendientes / Finalizados */}
      {fixtures.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`glass-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              fontWeight: 700,
              background: statusFilter === 'ALL' ? '#00d2d3' : 'transparent',
              color: statusFilter === 'ALL' ? '#000' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Todos ({fixtures.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`glass-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              fontWeight: 700,
              background: statusFilter === 'PENDING' ? '#f39c12' : 'transparent',
              color:
                statusFilter === 'PENDING'
                  ? '#000'
                  : pendingCount > 0
                    ? '#f39c12'
                    : 'var(--text-muted)',
              border:
                pendingCount > 0 && statusFilter !== 'PENDING'
                  ? '1px solid rgba(243, 156, 18, 0.4)'
                  : 'none',
              cursor: 'pointer',
            }}
          >
            ⚠️ Por Pronosticar ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('FINISHED')}
            className={`glass-btn ${statusFilter === 'FINISHED' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              fontWeight: 700,
              background: statusFilter === 'FINISHED' ? '#2ecc71' : 'transparent',
              color: statusFilter === 'FINISHED' ? '#000' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            🏁 Finalizados ({finishedCount})
          </button>
        </div>
      )}

      {/* Estado de carga */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Cargando partidos y pronósticos...
        </div>
      )}

      {/* Lista de partidos */}
      {!isLoading && fixtures.length === 0 && (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--text-muted)',
            borderRadius: '12px',
          }}
        >
          No hay partidos programados para esta competición o jornada.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {displayedFixtures.map((fixture) => {
          const pred = localPredictions[fixture.matchId] || {
            homeScore: '',
            awayScore: '',
            sign: '',
          };
          const isMatchLocked = fixture.locked || activeGroupIsLocked;

          return (
            <div
              key={fixture.matchId}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                border: isMatchLocked
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid var(--border-color)',
                opacity: isMatchLocked ? 0.85 : 1,
                position: 'relative',
              }}
            >
              {/* Barra superior de información del partido */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <div>
                  <span>📅 {formatDate(fixture.matchDate)}</span>
                  {fixture.round && (
                    <span style={{ marginLeft: '10px', color: '#a29bfe' }}>• {fixture.round}</span>
                  )}
                </div>

                {/* Badge de estado del partido */}
                <div>
                  {fixture.finished ? (
                    <span
                      style={{
                        background: 'rgba(46, 204, 113, 0.2)',
                        color: '#2ecc71',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        fontWeight: 600,
                      }}
                    >
                      🏁 Finalizado ({fixture.actualHomeScore} - {fixture.actualAwayScore})
                    </span>
                  ) : isMatchLocked ? (
                    <span
                      style={{
                        background: 'rgba(231, 76, 60, 0.15)',
                        color: '#ff7675',
                        padding: '2px 8px',
                        borderRadius: '8px',
                      }}
                      title={fixture.lockReason}
                    >
                      🔒 Bloqueado
                    </span>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(0, 210, 211, 0.15)',
                        color: '#00d2d3',
                        padding: '2px 8px',
                        borderRadius: '8px',
                      }}
                    >
                      ⏱️ Abierto
                    </span>
                  )}
                </div>
              </div>

              {/* Contenido principal: Equipos y controles de pronóstico */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Equipo Local */}
                <div
                  style={{
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                    {fixture.homeTeam}
                  </span>
                  {fixture.homeTeamLogo ? (
                    <img
                      src={fixture.homeTeamLogo}
                      alt={fixture.homeTeam}
                      style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Flag team={fixture.homeTeam} />
                  )}
                </div>

                {/* Zona central de Marcador y 1X2 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '210px',
                  }}
                >
                  {/* Inputs de marcador exacto */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      aria-label={`Goles de ${fixture.homeTeam}`}
                      disabled={isMatchLocked}
                      value={pred.homeScore}
                      onChange={(e) => handleScoreChange(fixture.matchId, 'home', e.target.value)}
                      placeholder="-"
                      className="glass-input"
                      style={{
                        width: '46px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        padding: 0,
                        borderRadius: '8px',
                        background: isMatchLocked ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)',
                        border: isMatchLocked
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid #00d2d3',
                        color: isMatchLocked ? 'var(--text-muted)' : '#00d2d3',
                      }}
                    />

                    <span
                      style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '1.1rem' }}
                    >
                      :
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      aria-label={`Goles de ${fixture.awayTeam}`}
                      disabled={isMatchLocked}
                      value={pred.awayScore}
                      onChange={(e) => handleScoreChange(fixture.matchId, 'away', e.target.value)}
                      placeholder="-"
                      className="glass-input"
                      style={{
                        width: '46px',
                        height: '42px',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        padding: 0,
                        borderRadius: '8px',
                        background: isMatchLocked ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)',
                        border: isMatchLocked
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid #00d2d3',
                        color: isMatchLocked ? 'var(--text-muted)' : '#00d2d3',
                      }}
                    />
                  </div>

                  {/* Selector rápido 1X2 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['1', 'X', '2'].map((s) => {
                      const isSelected = pred.sign === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={isMatchLocked}
                          onClick={() => handleQuickSign(fixture.matchId, s)}
                          className="glass-btn"
                          style={{
                            padding: '3px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            background: isSelected
                              ? 'linear-gradient(135deg, #00d2d3, #00a8ff)'
                              : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#000' : 'var(--text-muted)',
                            border: isSelected
                              ? '1px solid #00d2d3'
                              : '1px solid rgba(255,255,255,0.1)',
                            cursor: isMatchLocked ? 'not-allowed' : 'pointer',
                          }}
                          aria-label={`Pronosticar signo ${s}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Equipo Visitante */}
                <div
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '8px',
                  }}
                >
                  {fixture.awayTeamLogo ? (
                    <img
                      src={fixture.awayTeamLogo}
                      alt={fixture.awayTeam}
                      style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Flag team={fixture.awayTeam} />
                  )}
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                    {fixture.awayTeam}
                  </span>
                </div>
              </div>

              {/* Barra de acción: Ver porras del grupo en este partido */}
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isMatchLocked ? '🔒 Apuestas cerradas' : '⏳ Cierre al inicio del partido'}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMatchForFriends(fixture)}
                  className="glass-btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    background: 'rgba(0, 210, 211, 0.1)',
                    border: '1px solid rgba(0, 210, 211, 0.25)',
                    color: '#00d2d3',
                    cursor: 'pointer',
                  }}
                  aria-label={`Ver porras de amigos para ${fixture.homeTeam} vs ${fixture.awayTeam}`}
                >
                  <span>👥</span>
                  <span>{isMatchLocked ? 'Ver porras del grupo' : 'Ver pronósticos'}</span>
                </button>
              </div>

              {/* Desglose explicable de puntos si el partido ya ha finalizado */}
              {fixture.finished &&
                fixture.pointsAwarded !== null &&
                fixture.pointsAwarded !== undefined && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background:
                        fixture.pointsAwarded > 0
                          ? 'rgba(46, 204, 113, 0.12)'
                          : 'rgba(255,255,255,0.03)',
                      border:
                        fixture.pointsAwarded > 0
                          ? '1px solid rgba(46, 204, 113, 0.3)'
                          : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span
                      style={{ color: fixture.pointsAwarded > 0 ? '#2ecc71' : 'var(--text-muted)' }}
                    >
                      {fixture.scoringDetails ||
                        (fixture.pointsAwarded > 0 ? 'Acierto en pronóstico' : 'Sin puntos')}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: fixture.pointsAwarded > 0 ? '#2ecc71' : 'var(--text-muted)',
                        fontSize: '0.95rem',
                      }}
                    >
                      +{fixture.pointsAwarded} pts
                    </span>
                  </div>
                )}
            </div>
          );
        })}
      </div>
      {/* Botón flotante inferior para guardar en móvil si hay cambios */}
      {hasUnsavedChanges && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9000,
            animation: 'fadeIn 0.2s ease-out',
            boxShadow: '0 10px 25px rgba(0, 210, 211, 0.4)',
            borderRadius: '30px',
          }}
        >
          <button
            onClick={handleSaveAll}
            disabled={saveMutation.isPending}
            className="glass-btn primary-btn"
            style={{
              padding: '12px 24px',
              fontWeight: 800,
              fontSize: '1rem',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #00d2d3, #00a8ff)',
              color: '#000',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span>💾</span>
            <span>
              {saveMutation.isPending
                ? 'Guardando...'
                : `Guardar Cambios (${predictedCount}/${fixtures.length})`}
            </span>
          </button>
        </div>
      )}

      {/* Modal para ver pronósticos de amigos en un partido */}
      <MatchFriendsBetsModal
        groupId={activeGroupId}
        match={selectedMatchForFriends}
        onClose={() => setSelectedMatchForFriends(null)}
      />
    </div>
  );
}

export default MatchdayPredictor;
