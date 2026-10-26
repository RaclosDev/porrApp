import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
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

  // Extraer rondas disponibles y estructurarlas en:
  // - earlierPastRounds: jornadas anteriores (excluyendo la última jornada)
  // - lastRound: la última jornada finalizada justo antes de la actual
  // - currentRound: la jornada actual (en juego o próxima a empezar)
  // - nextRound: la jornada inmediatamente posterior a la actual
  // - futureRounds: jornadas futuras más allá de la próxima
  const { availableRounds, earlierPastRounds, lastRound, currentRound, nextRound, futureRounds } =
    useMemo(() => {
      const rounds = new Set();
      fixtures.forEach((f) => {
        rounds.add(roundLabelFor(f));
      });
      const sorted = Array.from(rounds);

      if (sorted.length === 0) {
        return {
          availableRounds: [],
          earlierPastRounds: [],
          lastRound: null,
          currentRound: null,
          nextRound: null,
          futureRounds: [],
        };
      }

      let activeIndex = sorted.findIndex((r) => {
        const matchesInR = fixtures.filter((f) => roundLabelFor(f) === r);
        return matchesInR.some((m) => !m.finished);
      });

      if (activeIndex === -1) {
        activeIndex = sorted.length - 1;
      }

      const cur = sorted[activeIndex] || null;
      const last = activeIndex > 0 ? sorted[activeIndex - 1] : null;
      const nxt = activeIndex + 1 < sorted.length ? sorted[activeIndex + 1] : null;
      const earlierPast = activeIndex > 1 ? sorted.slice(0, activeIndex - 1) : [];
      const future = activeIndex + 2 < sorted.length ? sorted.slice(activeIndex + 2) : [];

      return {
        availableRounds: sorted,
        earlierPastRounds: earlierPast,
        lastRound: last,
        currentRound: cur,
        nextRound: nxt,
        futureRounds: future,
      };
    }, [fixtures]);

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
          {activeGroupIsLocked && (
            <div style={{ marginBottom: '6px' }}>
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
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', fontWeight: 800 }}>
            {activeGroupName || 'Liga de Pronósticos'}
          </h1>
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
              : `💾 Guardar (${roundPredictedCount}/${roundFixtures.length})`}
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

      {/* Selector de ronda o jornada */}
      {availableRounds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Desplegable para jornadas anteriores (excluyendo la última jornada) */}
          {earlierPastRounds.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                value={earlierPastRounds.includes(selectedRound) ? selectedRound : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedRound(e.target.value);
                  }
                }}
                className="glass-input"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  borderRadius: '20px',
                  background: earlierPastRounds.includes(selectedRound)
                    ? '#00d2d3'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: earlierPastRounds.includes(selectedRound) ? '#000' : 'var(--text-light)',
                  border: earlierPastRounds.includes(selectedRound)
                    ? '1px solid #00d2d3'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  fontWeight: earlierPastRounds.includes(selectedRound) ? 700 : 500,
                  outline: 'none',
                }}
                aria-label="Jornadas anteriores"
              >
                <option
                  value=""
                  disabled={!earlierPastRounds.includes(selectedRound)}
                  style={{ background: '#0f172a', color: '#fff' }}
                >
                  {earlierPastRounds.includes(selectedRound)
                    ? `⏮️ ${selectedRound} (Finalizada)`
                    : '⏮️ Jornadas anteriores...'}
                </option>
                {earlierPastRounds.map((r) => (
                  <option key={r} value={r} style={{ background: '#0f172a', color: '#fff' }}>
                    {r} (Finalizada)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botón para la última jornada por separado */}
          {lastRound && (
            <button
              key={lastRound}
              type="button"
              aria-label={lastRound}
              onClick={() => setSelectedRound(lastRound)}
              className={`glass-btn ${selectedRound === lastRound ? 'active' : ''}`}
              title={`Última jornada: ${lastRound}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                background: selectedRound === lastRound ? '#00d2d3' : 'rgba(255,255,255,0.05)',
                color: selectedRound === lastRound ? '#000' : 'var(--text-light)',
                fontWeight: selectedRound === lastRound ? 700 : 500,
              }}
            >
              ⏮️ Última: {lastRound}
            </button>
          )}

          {/* Botón para la jornada actual por separado */}
          {currentRound && (
            <button
              key={currentRound}
              type="button"
              aria-label={currentRound}
              onClick={() => setSelectedRound(currentRound)}
              className={`glass-btn ${selectedRound === currentRound ? 'active' : ''}`}
              title={`Jornada actual: ${currentRound}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                background: selectedRound === currentRound ? '#00d2d3' : 'rgba(255,255,255,0.05)',
                color: selectedRound === currentRound ? '#000' : 'var(--text-light)',
                fontWeight: selectedRound === currentRound ? 700 : 500,
              }}
            >
              ⚽ Actual: {currentRound}
            </button>
          )}

          {/* Botón para la próxima jornada por separado */}
          {nextRound && (
            <button
              key={nextRound}
              type="button"
              aria-label={nextRound}
              onClick={() => setSelectedRound(nextRound)}
              className={`glass-btn ${selectedRound === nextRound ? 'active' : ''}`}
              title={`Próxima jornada: ${nextRound}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                background: selectedRound === nextRound ? '#00d2d3' : 'rgba(255,255,255,0.05)',
                color: selectedRound === nextRound ? '#000' : 'var(--text-light)',
                fontWeight: selectedRound === nextRound ? 700 : 500,
              }}
            >
              ⏭️ Próxima: {nextRound}
            </button>
          )}

          {/* Desplegable para jornadas futuras posteriores a la próxima */}
          {futureRounds.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                value={futureRounds.includes(selectedRound) ? selectedRound : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedRound(e.target.value);
                  }
                }}
                className="glass-input"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  borderRadius: '20px',
                  background: futureRounds.includes(selectedRound)
                    ? '#00d2d3'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: futureRounds.includes(selectedRound) ? '#000' : 'var(--text-light)',
                  border: futureRounds.includes(selectedRound)
                    ? '1px solid #00d2d3'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  fontWeight: futureRounds.includes(selectedRound) ? 700 : 500,
                  outline: 'none',
                }}
                aria-label="Más jornadas"
              >
                <option
                  value=""
                  disabled={!futureRounds.includes(selectedRound)}
                  style={{ background: '#0f172a', color: '#fff' }}
                >
                  {futureRounds.includes(selectedRound) ? `⏭️ ${selectedRound}` : 'Más jornadas...'}
                </option>
                {futureRounds.map((r) => (
                  <option key={r} value={r} style={{ background: '#0f172a', color: '#fff' }}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            Todos ({roundFixtures.length})
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
        {displayedFixtures.map((fixture, idx) => {
          const prev = idx > 0 ? displayedFixtures[idx - 1] : null;
          const currentLabel = roundLabelFor(fixture);
          const showGroupHeader =
            !selectedRound &&
            currentLabel !== 'Sin jornada' &&
            (!prev || roundLabelFor(prev) !== currentLabel);
          const pred = localPredictions[fixture.matchId] || {
            homeScore: '',
            awayScore: '',
            sign: '',
          };
          const isMatchLocked = fixture.locked || activeGroupIsLocked;

          return (
            <Fragment key={fixture.matchId}>
              {showGroupHeader && (
                <h3
                  style={{
                    color: '#a29bfe',
                    fontSize: '1rem',
                    fontWeight: 800,
                    margin: idx === 0 ? '0 0 10px' : '20px 0 10px',
                    paddingBottom: '6px',
                    borderBottom: '1px solid rgba(162, 155, 254, 0.3)',
                  }}
                >
                  📅 {currentLabel}
                </h3>
              )}
              <div
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
                      <span style={{ marginLeft: '10px', color: '#a29bfe' }}>
                        • {fixture.round}
                      </span>
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
                      gap: '6px',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      title={fixture.homeTeam}
                      style={{
                        fontWeight: 700,
                        fontSize: 'clamp(0.82rem, 2.7vw, 1.05rem)',
                        color: '#fff',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fixture.homeTeam}
                    </span>
                    {fixture.homeTeamLogo ? (
                      <img
                        src={fixture.homeTeamLogo}
                        alt={fixture.homeTeam}
                        width={26}
                        height={26}
                        loading="lazy"
                        style={{
                          width: '26px',
                          height: '26px',
                          objectFit: 'contain',
                          flexShrink: 0,
                        }}
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
                      gap: '6px',
                      minWidth: '150px',
                      flexShrink: 0,
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
                        disabled={isMatchLocked || saveMutation.isPending}
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
                        disabled={isMatchLocked || saveMutation.isPending}
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
                            disabled={isMatchLocked || saveMutation.isPending}
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
                      gap: '6px',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {fixture.awayTeamLogo ? (
                      <img
                        src={fixture.awayTeamLogo}
                        alt={fixture.awayTeam}
                        width={26}
                        height={26}
                        loading="lazy"
                        style={{
                          width: '26px',
                          height: '26px',
                          objectFit: 'contain',
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Flag team={fixture.awayTeam} />
                    )}
                    <span
                      title={fixture.awayTeam}
                      style={{
                        fontWeight: 700,
                        fontSize: 'clamp(0.82rem, 2.7vw, 1.05rem)',
                        color: '#fff',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
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
                    {isMatchLocked ? '🔒 Pronósticos cerrados' : '⏳ Cierre al inicio del partido'}
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
                        }}
                      >
                        +{fixture.pointsAwarded} pts
                      </span>
                    </div>
                  )}
              </div>
            </Fragment>
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
