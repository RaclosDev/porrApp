import toast from 'react-hot-toast';
import { useState, useEffect, useEffectEvent, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { useAppContext } from '../context/AppContext';
import {
  fetchMatchdayFixtures,
  fetchSurvivorStatus,
  submitMatchdayPredictions,
} from '../services/api';
import { leaderboardMatchdaysQuery } from '../services/queries';
import { queryKeys } from '../services/queryKeys';
import type {
  MatchdayFixture,
  MatchdayPredictionInput,
  MatchdaySubmissionResult,
} from '../types/api';
import { errorMessage } from '../utils/errors';
import { draftKey, readDraft } from '../utils/drafts';
import {
  EMPTY_PREDICTION,
  survivorUsedTeams,
  buildSubmission,
  filterFixtures,
  hasLiveMatch,
  hasPrediction,
  isPendingFixture,
  mergeDraftWithServer,
  parseDraft,
  resolveRound,
  roundLabelFor,
  roundsFromFixtures,
  roundsFromMatchdays,
  sortFightCard,
  withSign,
  withoutSaved,
  type Draft,
  type DraftPrediction,
  type MatchSign,
  type StatusFilter,
} from '../utils/matchday';
import { MATCH_KINDS } from '../context/leagueKind';

interface SaveVariables {
  groupId: string;
  items: MatchdayPredictionInput[];
}

/** Estado del guardado automático, para la cabecera de la jornada. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const EMPTY_FIXTURES: MatchdayFixture[] = [];

/**
 * Estado, consultas y acciones de la pantalla de jornadas de una liga.
 *
 * Las jornadas salen del resumen por jornada de la liga y solo se piden los partidos de la
 * jornada elegida. Si el resumen falla o viene vacío, se pide la temporada entera y las
 * jornadas se sacan de los partidos.
 */
export function useMatchdayPredictor(context: ReturnType<typeof useAppContext>) {
  const {
    activeGroupId,
    activeGroupIsLocked,
    activeGroupPoolFormat,
    leagueKind,
    userId,
    userName,
    isAuthenticated,
  } = context;

  const isMatchDay = MATCH_KINDS[leagueKind];

  const isSurvivor = activeGroupPoolFormat === 'SURVIVOR';

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>('UPCOMING');
  // Jornada en la que se pulsó «Por jugar» a mano: ahí se respeta aunque esté vacía.
  const [upcomingPickedRound, setUpcomingPickedRound] = useState<string | null>(null);
  const [selectedMatchForFriends, setSelectedMatchForFriends] = useState<MatchdayFixture | null>(
    null,
  );
  const [localPredictions, setLocalPredictions] = useState<Draft>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const draftRef = useRef<Draft | null>(null);
  // Un solo guardado a la vez: lo que se elija mientras tanto sale en cuanto termine.
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  // El borrador es de cada usuario: en un dispositivo compartido no se ve el de otro.
  const draftUser = userId || userName;
  const storageKey = draftKey('matchday', activeGroupId, draftUser);

  const persistDraft = useCallback(
    (draft: Draft) => {
      draftRef.current = draft;
      try {
        if (Object.keys(draft).length) localStorage.setItem(storageKey, JSON.stringify(draft));
        else localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  // Al cambiar de liga, el borrador en memoria pertenece a la anterior: se relee del almacenamiento.
  useEffect(() => {
    draftRef.current = null;
  }, [storageKey]);

  // Sin liga seleccionada, a Mis ligas. Las demás clases de liga no llegan aquí (MatchdayPredictor).
  useEffect(() => {
    if (!activeGroupId && isAuthenticated) navigate('/mis-ligas');
  }, [activeGroupId, isAuthenticated, navigate]);

  const enabled = Boolean(activeGroupId && isMatchDay);

  // Jornadas de la liga; es la misma consulta que usa el ranking, así que suele estar en caché.
  const matchdaysQuery = useQuery({ ...leaderboardMatchdaysQuery(activeGroupId), enabled });
  const summaryRounds = useMemo(
    () => (matchdaysQuery.data?.length ? roundsFromMatchdays(matchdaysQuery.data) : null),
    [matchdaysQuery.data],
  );
  const wholeSeason =
    matchdaysQuery.isError || (matchdaysQuery.isSuccess && !matchdaysQuery.data.length);
  const requestedRound = summaryRounds ? resolveRound(selectedRound, summaryRounds) : null;

  const fixturesQuery = useQuery({
    queryKey: queryKeys.matchdayFixtures(activeGroupId, draftUser, requestedRound ?? ''),
    queryFn: () => fetchMatchdayFixtures(activeGroupId, requestedRound ?? ''),
    enabled: enabled && (requestedRound !== null || wholeSeason),
    // El WebSocket ya invalida al cambiar un resultado; el sondeo solo cubre los partidos en
    // juego (reloj y marcador en directo) por si se pierde un mensaje.
    refetchInterval: (query) => (hasLiveMatch(query.state.data) ? 30_000 : false),
  });
  const fixtures = fixturesQuery.data ?? EMPTY_FIXTURES;

  // Superviviente: si sigue vivo y qué equipos ya ha gastado en otras jornadas.
  const survivorQuery = useQuery({
    queryKey: queryKeys.survivorStatus(activeGroupId, draftUser),
    queryFn: () => fetchSurvivorStatus(activeGroupId),
    enabled: enabled && isSurvivor && isAuthenticated,
  });

  // Al llegar partidos, el borrador local manda en los abiertos y el servidor en los bloqueados.
  useEffect(() => {
    if (fixtures.length === 0) return;
    let draft = draftRef.current;
    if (draft === null) {
      try {
        draft = parseDraft(readDraft('matchday', activeGroupId, draftUser));
      } catch (e) {
        console.warn('Error reading matchday draft', e);
      }
    }
    const merged = mergeDraftWithServer(fixtures, draft ?? {});
    setLocalPredictions(merged.predictions);
    persistDraft(merged.draft);
  }, [fixtures, storageKey, activeGroupId, draftUser, persistDraft]);

  const roundList = useMemo(
    () => summaryRounds ?? roundsFromFixtures(fixtures),
    [summaryRounds, fixtures],
  );
  const availableRounds = roundList.rounds;
  const activeRound = resolveRound(selectedRound, roundList);
  const roundIndex = selectedRound ? availableRounds.indexOf(selectedRound) : -1;

  // La primera vez (o si la jornada elegida ya no existe) se queda fija la jornada actual.
  useEffect(() => {
    if (activeRound && activeRound !== selectedRound) setSelectedRound(activeRound);
  }, [activeRound, selectedRound]);

  const saveMutation = useMutation<MatchdaySubmissionResult, Error, SaveVariables>({
    mutationFn: ({ groupId, items }) => submitMatchdayPredictions(groupId, items),
    onSuccess: (_data, { groupId, items }) => {
      const rest = withoutSaved(draftRef.current ?? {}, items);
      // Superviviente: los huecos que dejó cambiar de partido ya están en el servidor.
      persistDraft(
        isSurvivor
          ? Object.fromEntries(Object.entries(rest).filter(([, pred]) => hasPrediction(pred)))
          : rest,
      );
      setSaveErrorMsg('');
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.matchdayFixtures(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) });
    },
    onError: (err) => {
      setSaveErrorMsg(errorMessage(err, 'No se pudo guardar la predicción'));
      setSaveStatus('error');
    },
    onSettled: () => {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        saveDraft();
      }
    },
  });

  // «Guardado» se queda 3 s y vuelve a desaparecer.
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timer = setTimeout(() => setSaveStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  const updatePrediction = (matchId: number, prediction: DraftPrediction) => {
    persistDraft({ ...draftRef.current, [matchId]: prediction });
    setLocalPredictions((previous) => ({ ...previous, [matchId]: prediction }));
  };

  const predictionFor = (matchId: number) => localPredictions[matchId] || EMPTY_PREDICTION;

  const roundFixtures = useMemo(
    () =>
      sortFightCard(
        activeRound ? fixtures.filter((f) => roundLabelFor(f) === activeRound) : fixtures,
      ),
    [fixtures, activeRound],
  );

  /** Envía el borrador de la jornada; si ya hay un guardado en curso, sale justo después. */
  function saveDraft() {
    if (activeGroupIsLocked || !isAuthenticated) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const submission = buildSubmission(roundFixtures, draftRef.current || {});
    if (submission.kind !== 'ready') return;
    inFlightRef.current = true;
    setSaveStatus('saving');
    saveMutation.mutate({ groupId: activeGroupId, items: submission.items });
  }

  // Lo que quedó sin guardar (sin conexión, o se cerró la app a medias) se envía al llegar los
  // partidos. Va después del efecto que mezcla el borrador, así que ya lo tiene al día.
  const resumeSave = useEffectEvent(saveDraft);
  useEffect(() => {
    if (fixtures.length > 0 && Object.keys(draftRef.current ?? {}).length > 0) resumeSave();
  }, [fixtures]);

  /** Elegir un signo lo guarda al momento: no hay botón de guardar. */
  /** Tenis: ganador y, si se eligen, sets; se guarda al momento como un signo. */
  const handleTennisPick = (matchId: number, prediction: DraftPrediction) => {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para guardar tus predicciones.');
      return;
    }
    updatePrediction(matchId, prediction);
    saveDraft();
  };

  const handleQuickSign = (matchId: number, sign: MatchSign) => {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para guardar tus predicciones.');
      return;
    }
    updatePrediction(matchId, withSign(sign));
    saveDraft();
  };

  /** Pelea de la UFC: ganador, método y asalto se guardan al momento, como un signo. */
  const handleFightPick = (matchId: number, pick: DraftPrediction) => {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para guardar tus predicciones.');
      return;
    }
    updatePrediction(matchId, pick);
    saveDraft();
  };

  /**
   * Superviviente: elegir un equipo deja vacíos los demás partidos abiertos de la jornada, porque
   * solo vale una elección; el servidor sustituye la anterior al guardar.
   */
  const handleSurvivorPick = (matchId: number, sign: '1' | '2') => {
    if (!isAuthenticated) {
      toast.error('Inicia sesión para guardar tu elección.');
      return;
    }
    const cleared: Draft = {};
    roundFixtures
      .filter(
        (f) => f.matchId !== matchId && !f.locked && hasPrediction(localPredictions[f.matchId]),
      )
      .forEach((f) => {
        cleared[f.matchId] = EMPTY_PREDICTION;
      });
    const picked = withSign(sign);
    persistDraft({ ...draftRef.current, ...cleared, [matchId]: picked });
    setLocalPredictions((previous) => ({ ...previous, ...cleared, [matchId]: picked }));
    saveDraft();
  };

  const usedTeams = useMemo(
    () => survivorUsedTeams(survivorQuery.data, activeRound),
    [survivorQuery.data, activeRound],
  );

  // Superviviente: con un equipo elegido la jornada ya no tiene nada pendiente.
  const survivorPicked =
    isSurvivor && roundFixtures.some((f) => hasPrediction(localPredictions[f.matchId]));

  const counts = useMemo(
    () => ({
      predicted: roundFixtures.filter((f) => hasPrediction(localPredictions[f.matchId])).length,
      pending: survivorPicked
        ? 0
        : roundFixtures.filter((f) => isPendingFixture(f, localPredictions, activeGroupIsLocked))
            .length,
      finished: roundFixtures.filter((f) => f.finished).length,
      upcoming: roundFixtures.filter((f) => !f.finished).length,
      total: roundFixtures.length,
    }),
    [roundFixtures, localPredictions, activeGroupIsLocked, survivorPicked],
  );

  // En una jornada ya jugada, «Por jugar» estaría vacío: se abre en los finalizados. Si se pulsa esa
  // pestaña a mano, se enseña lo que cuenta: ninguno.
  const activeFilter: StatusFilter =
    statusFilter === 'UPCOMING' &&
    counts.upcoming === 0 &&
    counts.finished > 0 &&
    upcomingPickedRound !== activeRound
      ? 'FINISHED'
      : statusFilter;

  const setStatusFilter = (filter: StatusFilter) => {
    setStatusFilterState(filter);
    setUpcomingPickedRound(filter === 'UPCOMING' ? activeRound : null);
  };

  const displayedFixtures = useMemo(
    () =>
      survivorPicked && activeFilter === 'PENDING'
        ? []
        : filterFixtures(roundFixtures, activeFilter, localPredictions, activeGroupIsLocked),
    [roundFixtures, activeFilter, localPredictions, activeGroupIsLocked, survivorPicked],
  );

  return {
    isMatchDay,
    isSurvivor,
    survivor: survivorQuery.data ?? null,
    usedTeams,
    handleSurvivorPick,
    fixtures,
    activeRound,
    roundFixtures,
    isLoading: matchdaysQuery.isLoading || fixturesQuery.isLoading,
    isError: fixturesQuery.isError,
    refetch: fixturesQuery.refetch,
    availableRounds,
    selectedRound,
    setSelectedRound,
    roundIndex,
    statusFilter: activeFilter,
    setStatusFilter,
    counts,
    displayedFixtures,
    predictionFor,
    handleQuickSign,
    handleFightPick,
    handleTennisPick,
    retrySave: saveDraft,
    saveStatus,
    saveErrorMsg,
    selectedMatchForFriends,
    setSelectedMatchForFriends,
  };
}
