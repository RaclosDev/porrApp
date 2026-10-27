import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { fetchMatchdayFixtures, submitMatchdayPredictions } from '../services/api';
import Flag from '../components/Flag';
import MatchFriendsBetsModal from '../components/MatchFriendsBetsModal';

const EMPTY_FIXTURES = [];
const roundLabelFor = (fixture) =>
  fixture.groupName
    ? `Grupo ${fixture.groupName}`
    : fixture.round && fixture.round !== 'group'
      ? fixture.round
      : fixture.matchDate
        ? `Fecha ${fixture.matchDate.slice(0, 10)}`
        : 'Sin jornada';
const hasPrediction = (prediction) =>
  Boolean(
    prediction && ((prediction.homeScore !== '' && prediction.awayScore !== '') || prediction.sign),
  );

function MatchdayPredictor() {
  const context = useAppContext();
  if (context.loadingGroup) return <p role="status">Cargando liga...</p>;
  if (context.groupError) return <p role="alert">No se pudo cargar la liga. Inténtalo de nuevo.</p>;
  return (
    <MatchdayLeague
      key={`${context.userId || context.userName}:${context.activeGroupId}`}
      context={context}
    />
  );
}

/**
 * Vista de Pronósticos por Jornada (1X2 y Marcador Exacto) - Fase 3
 * Permite a los participantes de ligas por jornadas pronosticar partido a partido,
 * con bloqueo individual por fecha de inicio y visualización de puntos obtenidos.
 */
function MatchdayLeague({ context }) {
  const {
    activeGroupId,
    activeGroupName,
    activeGroupIsLocked,
    activeGroupBetMode,
    activeCompetitionFormatType,
    userId,
    userName,
    isAuthenticated,
    loadingGroup,
    groupError,
  } = context;

  const isMatchDay = activeGroupBetMode === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRound, setSelectedRound] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'FINISHED'
  const [selectedMatchForFriends, setSelectedMatchForFriends] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localPredictions, setLocalPredictions] = useState({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const draftRef = useRef(null);
  const draftKey = `draft_matchday_${activeGroupId}`;

  const persistDraft = (draft) => {
    draftRef.current = draft;
    try {
      if (Object.keys(draft).length) localStorage.setItem(draftKey, JSON.stringify(draft));
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  // Redirigir a mis-ligas si no hay liga seleccionada, o al inicio si no es modalidad por jornadas (ej. Mundial)
  useEffect(() => {
    if (!activeGroupId && isAuthenticated) {
      navigate('/mis-ligas');
      return;
    }
    if (activeGroupBetMode && !isMatchDay) {
      navigate('/');
    }
  }, [activeGroupId, activeGroupBetMode, isMatchDay, isAuthenticated, navigate]);

  // Carga de partidos de la jornada
  const {
    data: fixtures = EMPTY_FIXTURES,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['matchdayFixtures', activeGroupId, userId || userName],
    queryFn: () => fetchMatchdayFixtures(activeGroupId, ''),
    enabled: Boolean(activeGroupId && isMatchDay),
    refetchInterval: 30_000,
  });

  // Inicializar estado local cuando llegan datos del backend
  useEffect(() => {
    if (fixtures.length > 0) {
      const initial = {};
      // Cargar borrador previo si existe en LocalStorage para esta liga
      let draft = draftRef.current || {};
      try {
        const storedDraft = draftRef.current === null ? localStorage.getItem(draftKey) : null;
        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) draft = parsed;
        }
      } catch (e) {
        console.warn('Error reading matchday draft', e);
      }

      const openDraft = {};
      fixtures.forEach((f) => {
        const d = draft[f.matchId];
        // Solo usar borrador si el partido sigue abierto y no tiene predicción ya guardada en servidor
        const useDraft = !f.locked && d && typeof d === 'object';
        if (useDraft) openDraft[f.matchId] = d;
        initial[f.matchId] = {
          homeScore: useDraft
            ? (d.homeScore ?? '')
            : f.predHomeScore !== null && f.predHomeScore !== undefined
              ? String(f.predHomeScore)
              : '',
          awayScore: useDraft
            ? (d.awayScore ?? '')
            : f.predAwayScore !== null && f.predAwayScore !== undefined
              ? String(f.predAwayScore)
              : '',
          sign: useDraft ? d.sign || '' : f.predSign || '',
        };
      });
      setLocalPredictions(initial);
      persistDraft(openDraft);
      setHasUnsavedChanges(Object.keys(openDraft).length > 0);
    }
  }, [fixtures]);

  // Jornadas disponibles en orden y jornada actual (la primera con partidos sin finalizar).
  const { availableRounds, currentRound } = useMemo(() => {
    const rounds = [];
    const seen = new Set();
    fixtures.forEach((f) => {
      const label = roundLabelFor(f);
      if (!seen.has(label)) {
        seen.add(label);
        rounds.push(label);
      }
    });

    if (rounds.length === 0) {
      return { availableRounds: [], currentRound: null };
    }

    let activeIndex = rounds.findIndex((r) =>
      fixtures.some((f) => roundLabelFor(f) === r && !f.finished),
    );
    if (activeIndex === -1) activeIndex = rounds.length - 1;

    return { availableRounds: rounds, currentRound: rounds[activeIndex] };
  }, [fixtures]);

  const roundIndex = availableRounds.indexOf(selectedRound);

  // Seleccionar la jornada actual por defecto al cargar los partidos
  useEffect(() => {
    if (
      (selectedRound === null || (selectedRound && !availableRounds.includes(selectedRound))) &&
      fixtures.length > 0
    ) {
      if (currentRound) {
        setSelectedRound(currentRound);
      } else if (availableRounds.length > 0) {
        setSelectedRound(availableRounds[0]);
      }
    }
  }, [selectedRound, fixtures, currentRound, availableRounds]);

  // Mutación para guardar pronósticos
  const saveMutation = useMutation({
    mutationFn: ({ groupId, items }) => submitMatchdayPredictions(groupId, items),
    onSuccess: (data, { groupId, savedMatchIds }) => {
      setSaveSuccessMsg(data.message || '¡Pronósticos guardados correctamente!');
      try {
        const currentDraft = { ...draftRef.current };
        if (savedMatchIds && Array.isArray(savedMatchIds)) {
          savedMatchIds.forEach((id) => delete currentDraft[id]);
        } else {
          roundFixtures.forEach((f) => delete currentDraft[f.matchId]);
        }
        draftRef.current = currentDraft;
        persistDraft(currentDraft);
        setHasUnsavedChanges(Object.keys(currentDraft).length > 0);
      } catch {
        /* ignore */
      }
      setSaveErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['matchdayFixtures', groupId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', groupId] });
      queryClient.invalidateQueries({ queryKey: ['missingRoundUsers', groupId] });
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setSaveErrorMsg(err.message || 'Error al guardar pronósticos');
      setSaveSuccessMsg('');
    },
  });

  const updatePrediction = (matchId, prediction) => {
    persistDraft({ ...draftRef.current, [matchId]: prediction });
    setHasUnsavedChanges(true);
    setLocalPredictions((previous) => ({ ...previous, [matchId]: prediction }));
  };

  const handleScoreChange = (matchId, side, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(0, 2);
    const current = localPredictions[matchId] || { homeScore: '', awayScore: '', sign: '' };
    const updated = {
      ...current,
      [side === 'home' ? 'homeScore' : 'awayScore']: cleanVal,
    };

    // Si ambos campos tienen valor, auto-calcular el signo 1X2
    if (updated.homeScore !== '' && updated.awayScore !== '') {
      const h = parseInt(updated.homeScore, 10);
      const a = parseInt(updated.awayScore, 10);
      updated.sign = h > a ? '1' : h === a ? 'X' : '2';
    } else {
      updated.sign = '';
    }

    updatePrediction(matchId, updated);
  };

  const handleQuickSign = (matchId, sign) => {
    const current = localPredictions[matchId] || { homeScore: '', awayScore: '', sign: '' };
    let h = current.homeScore;
    let a = current.awayScore;
    if (sign === '1' && (h === '' || a === '' || Number(h) <= Number(a))) {
      h = '2';
      a = '1';
    } else if (sign === 'X') {
      h = '1';
      a = '1';
    } else if (sign === '2' && (a === '' || h === '' || Number(a) <= Number(h))) {
      h = '1';
      a = '2';
    }
    updatePrediction(matchId, { homeScore: h, awayScore: a, sign });
  };

  // Partidos filtrados por jornada seleccionada (o la actual por defecto)
  const roundFixtures = useMemo(() => {
    const effectiveRound =
      selectedRound || currentRound || (availableRounds.length > 0 ? availableRounds[0] : null);
    if (!effectiveRound) return fixtures;
    return fixtures.filter((f) => roundLabelFor(f) === effectiveRound);
  }, [fixtures, selectedRound, currentRound, availableRounds]);

  // Contar partidos pronosticados en la jornada seleccionada
  const roundPredictedCount = useMemo(() => {
    return roundFixtures.filter((f) => hasPrediction(localPredictions[f.matchId])).length;
  }, [roundFixtures, localPredictions]);

  const handleSaveAll = () => {
    if (saveMutation.isPending || activeGroupIsLocked) return;
    if (!isAuthenticated) {
      toast.error('Inicia sesión con Google para guardar tus pronósticos.');
      return;
    }

    const roundMatchIds = new Set(roundFixtures.map((f) => f.matchId));
    const payload = [];
    let incomplete = false;
    Object.entries(draftRef.current || {}).forEach(([matchIdStr, pred]) => {
      const matchId = Number(matchIdStr);
      if (!roundMatchIds.has(matchId)) return;
      const fixture = fixtures.find((f) => f.matchId === matchId);
      // Solo enviar partidos que no estén bloqueados y que tengan pronóstico
      if (fixture && !fixture.locked) {
        if ((pred.homeScore === '') !== (pred.awayScore === '')) {
          incomplete = true;
          return;
        }
        if (!hasPrediction(pred)) return;
        payload.push({
          matchId,
          homeScore: pred.homeScore !== '' ? parseInt(pred.homeScore, 10) : null,
          awayScore: pred.awayScore !== '' ? parseInt(pred.awayScore, 10) : null,
          sign: pred.sign || null,
        });
      }
    });

    if (incomplete) {
      setSaveErrorMsg('Completa los dos marcadores de cada partido antes de guardar.');
      return;
    }
    if (payload.length === 0) {
      toast('No hay pronósticos nuevos o modificados para guardar en esta jornada.');
      return;
    }

    saveMutation.mutate({
      groupId: activeGroupId,
      items: payload,
      savedMatchIds: payload.map((p) => p.matchId),
    });
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

  // Contadores dentro del alcance de la jornada seleccionada
  const pendingCount = useMemo(() => {
    return roundFixtures.filter(
      (f) => !f.locked && !activeGroupIsLocked && !hasPrediction(localPredictions[f.matchId]),
    ).length;
  }, [roundFixtures, localPredictions, activeGroupIsLocked]);

  const finishedCount = useMemo(() => {
    return roundFixtures.filter((f) => f.finished).length;
  }, [roundFixtures]);

  const displayedFixtures = useMemo(() => {
    let list = roundFixtures;
    if (statusFilter === 'PENDING') {
      return list.filter(
        (f) => !f.locked && !activeGroupIsLocked && !hasPrediction(localPredictions[f.matchId]),
      );
    }
    if (statusFilter === 'FINISHED') {
      return list.filter((f) => f.finished);
    }
    return list;
  }, [roundFixtures, statusFilter, localPredictions, activeGroupIsLocked]);

  if (loadingGroup)
    return (
      <p role="status" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando liga...
      </p>
    );
  if (groupError)
    return (
      <p role="alert" style={{ padding: '24px', textAlign: 'center', color: '#ff7675' }}>
        No se pudo cargar la liga. Inténtalo de nuevo.
      </p>
    );
  if (activeGroupBetMode && !isMatchDay) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="md-page">
      {/* Cabecera de la jornada */}
      <div className="md-page-header">
        <div style={{ minWidth: 0 }}>
          <h1>{activeGroupName || 'Jornadas'}</h1>
          <p className="md-page-sub">
            {activeGroupIsLocked
              ? '🔒 Porra cerrada'
              : `${roundPredictedCount}/${roundFixtures.length} pronosticados`}
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saveMutation.isPending || activeGroupIsLocked}
          className="glass-btn primary-btn md-save-btn"
          style={{ cursor: activeGroupIsLocked ? 'not-allowed' : 'pointer' }}
        >
          {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
        </button>
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

      {/* Selector de ronda o jornada */}
      {availableRounds.length > 0 && (
        <div className="md-round-bar">
          <button
            type="button"
            className="glass-btn md-round-step"
            onClick={() => setSelectedRound(availableRounds[roundIndex - 1])}
            disabled={roundIndex <= 0}
            aria-label="Jornada anterior"
          >
            ‹
          </button>

          <select
            className="md-round-select"
            value={selectedRound || ''}
            onChange={(e) => setSelectedRound(e.target.value)}
            aria-label="Seleccionar jornada"
          >
            {availableRounds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="glass-btn md-round-step"
            onClick={() => setSelectedRound(availableRounds[roundIndex + 1])}
            disabled={roundIndex === -1 || roundIndex >= availableRounds.length - 1}
            aria-label="Jornada siguiente"
          >
            ›
          </button>
        </div>
      )}

      {/* Pestañas de filtro rápido: Todos / Pendientes / Finalizados */}
      {fixtures.length > 0 && (
        <div className="md-filters" role="tablist" aria-label="Filtro de partidos">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
            className={`md-filter${statusFilter === 'ALL' ? ' is-active' : ''}`}
          >
            Todos <b>{roundFixtures.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'PENDING'}
            onClick={() => setStatusFilter('PENDING')}
            className={`md-filter is-pending${statusFilter === 'PENDING' ? ' is-active' : ''}`}
          >
            Pendientes <b>{pendingCount}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'FINISHED'}
            onClick={() => setStatusFilter('FINISHED')}
            className={`md-filter is-finished${statusFilter === 'FINISHED' ? ' is-active' : ''}`}
          >
            Finalizados <b>{finishedCount}</b>
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
      {isError && (
        <p role="alert">
          No se pudieron cargar los partidos. <button onClick={() => refetch()}>Reintentar</button>
        </p>
      )}
      {!isLoading && !isError && fixtures.length === 0 && (
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
            <div key={fixture.matchId} className={`md-match${isMatchLocked ? ' is-locked' : ''}`}>
              <div className="md-match-top">
                <span>📅 {formatDate(fixture.matchDate)}</span>
                {fixture.finished ? (
                  <span className="md-badge is-finished">
                    Final {fixture.actualHomeScore} - {fixture.actualAwayScore}
                  </span>
                ) : isMatchLocked ? (
                  <span className="md-badge is-locked" title={fixture.lockReason}>
                    🔒 Bloqueado
                  </span>
                ) : (
                  <span className="md-badge is-open">⏱️ Abierto</span>
                )}
              </div>

              <div className="md-team-rows">
                <div className="md-team-row">
                  <span className="md-crest">
                    <Flag
                      team={fixture.homeTeam}
                      logo={fixture.homeTeamLogo}
                      style={{ width: '24px', height: '24px' }}
                    />
                  </span>
                  <span className="md-team-name">{fixture.homeTeam}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    inputMode="numeric"
                    aria-label={`Goles de ${fixture.homeTeam}`}
                    disabled={isMatchLocked || saveMutation.isPending}
                    value={pred.homeScore}
                    onChange={(e) => handleScoreChange(fixture.matchId, 'home', e.target.value)}
                    placeholder="-"
                    className="md-score-input"
                  />
                </div>

                <div className="md-team-row">
                  <span className="md-crest">
                    <Flag
                      team={fixture.awayTeam}
                      logo={fixture.awayTeamLogo}
                      style={{ width: '24px', height: '24px' }}
                    />
                  </span>
                  <span className="md-team-name">{fixture.awayTeam}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    inputMode="numeric"
                    aria-label={`Goles de ${fixture.awayTeam}`}
                    disabled={isMatchLocked || saveMutation.isPending}
                    value={pred.awayScore}
                    onChange={(e) => handleScoreChange(fixture.matchId, 'away', e.target.value)}
                    placeholder="-"
                    className="md-score-input"
                  />
                </div>
              </div>

              <div className="md-signs">
                {['1', 'X', '2'].map((s) => {
                  const isSelected = pred.sign === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={isMatchLocked || saveMutation.isPending}
                      onClick={() => handleQuickSign(fixture.matchId, s)}
                      className={`md-sign-btn${isSelected ? ' is-active' : ''}`}
                      aria-label={`Pronosticar signo ${s}`}
                      aria-pressed={isSelected}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <div className="md-match-footer">
                <button
                  type="button"
                  onClick={() => setSelectedMatchForFriends(fixture)}
                  className="md-bets-btn"
                  aria-label={`Ver porras de amigos para ${fixture.homeTeam} vs ${fixture.awayTeam}`}
                >
                  <span aria-hidden="true">👥</span>
                  <span>Ver pronósticos</span>
                </button>
              </div>

              {/* Desglose de puntos si el partido ya ha finalizado */}
              {fixture.finished &&
                fixture.pointsAwarded !== null &&
                fixture.pointsAwarded !== undefined && (
                  <div
                    style={{
                      marginTop: '10px',
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
                      gap: '8px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span
                      style={{
                        color: fixture.pointsAwarded > 0 ? '#2ecc71' : 'var(--text-muted)',
                      }}
                    >
                      {fixture.scoringDetails ||
                        (fixture.pointsAwarded > 0 ? 'Acierto en pronóstico' : 'Sin puntos')}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: fixture.pointsAwarded > 0 ? '#2ecc71' : 'var(--text-muted)',
                        fontSize: '0.95rem',
                        flexShrink: 0,
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
          className="floating-bottom-action"
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
            disabled={saveMutation.isPending || activeGroupIsLocked}
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
                : `Guardar Cambios (${roundPredictedCount}/${roundFixtures.length})`}
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
