import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { useAppContext } from '../context/AppContext';
import { fetchMatchdayFixtures, submitMatchdayPredictions } from '../services/api';
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
  withScore,
  withSign,
  withoutSaved,
  type Draft,
  type DraftPrediction,
  type MatchSign,
  type StatusFilter,
} from '../utils/matchday';

interface SaveVariables {
  groupId: string;
  items: MatchdayPredictionInput[];
  savedMatchIds: number[];
}

const EMPTY_FIXTURES: MatchdayFixture[] = [];

/** Estado, consultas y acciones de la pantalla de jornadas de una liga. */
export function useMatchdayPredictor(context: ReturnType<typeof useAppContext>) {
  const {
    activeGroupId,
    activeGroupIsLocked,
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    userId,
    userName,
    isAuthenticated,
  } = context;

  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedMatchForFriends, setSelectedMatchForFriends] = useState<MatchdayFixture | null>(
    null,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localPredictions, setLocalPredictions] = useState<Draft>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const draftRef = useRef<Draft | null>(null);
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

  // Redirigir a mis-ligas si no hay liga seleccionada, o al inicio si no es modalidad por jornadas (ej. Mundial)
  useEffect(() => {
    if (!activeGroupId && isAuthenticated) {
      navigate('/mis-ligas');
      return;
    }
    if (activeGroupPoolFormat && !isMatchDay) {
      navigate('/');
    }
  }, [activeGroupId, activeGroupPoolFormat, isMatchDay, isAuthenticated, navigate]);

  const fixturesQuery = useQuery({
    queryKey: queryKeys.matchdayFixtures(activeGroupId, draftUser),
    queryFn: () => fetchMatchdayFixtures(activeGroupId, ''),
    enabled: Boolean(activeGroupId && isMatchDay),
    // El WebSocket ya invalida al cambiar un resultado; el sondeo solo cubre los partidos en
    // juego (reloj y marcador en directo) por si se pierde un mensaje.
    refetchInterval: (query) => (hasLiveMatch(query.state.data) ? 30_000 : false),
  });
  const fixtures = fixturesQuery.data ?? EMPTY_FIXTURES;

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
    setHasUnsavedChanges(Object.keys(merged.draft).length > 0);
  }, [fixtures, storageKey, activeGroupId, draftUser, persistDraft]);

  const roundList = useMemo(() => roundsFromFixtures(fixtures), [fixtures]);
  const availableRounds = roundList.rounds;
  const activeRound = resolveRound(selectedRound, roundList);
  const roundIndex = selectedRound ? availableRounds.indexOf(selectedRound) : -1;

  // La primera vez (o si la jornada elegida ya no existe) se queda fija la jornada actual.
  useEffect(() => {
    if (activeRound && activeRound !== selectedRound) setSelectedRound(activeRound);
  }, [activeRound, selectedRound]);

  const saveMutation = useMutation<MatchdaySubmissionResult, Error, SaveVariables>({
    mutationFn: ({ groupId, items }) => submitMatchdayPredictions(groupId, items),
    onSuccess: (data, { groupId, savedMatchIds }) => {
      setSaveSuccessMsg(data.message || '¡Pronósticos guardados correctamente!');
      const rest = withoutSaved(draftRef.current ?? {}, savedMatchIds);
      persistDraft(rest);
      setHasUnsavedChanges(Object.keys(rest).length > 0);
      setSaveErrorMsg('');
      queryClient.invalidateQueries({ queryKey: queryKeys.matchdayFixtures(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) });
    },
    onError: (err) => {
      setSaveErrorMsg(errorMessage(err, 'Error al guardar pronósticos'));
      setSaveSuccessMsg('');
    },
  });

  // El aviso de guardado desaparece a los 4 s; el temporizador se limpia al desmontar o si
  // llega otro aviso antes.
  useEffect(() => {
    if (!saveSuccessMsg) return;
    const timer = setTimeout(() => setSaveSuccessMsg(''), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccessMsg]);

  const updatePrediction = (matchId: number, prediction: DraftPrediction) => {
    persistDraft({ ...draftRef.current, [matchId]: prediction });
    setHasUnsavedChanges(true);
    setLocalPredictions((previous) => ({ ...previous, [matchId]: prediction }));
  };

  const predictionFor = (matchId: number) => localPredictions[matchId] || EMPTY_PREDICTION;

  const handleScoreChange = (matchId: number, side: 'home' | 'away', value: string) =>
    updatePrediction(matchId, withScore(predictionFor(matchId), side, value));

  const handleQuickSign = (matchId: number, sign: MatchSign) =>
    updatePrediction(matchId, withSign(predictionFor(matchId), sign));

  const roundFixtures = useMemo(
    () => (activeRound ? fixtures.filter((f) => roundLabelFor(f) === activeRound) : fixtures),
    [fixtures, activeRound],
  );

  const handleSaveAll = () => {
    if (saveMutation.isPending || activeGroupIsLocked) return;
    if (!isAuthenticated) {
      toast.error('Inicia sesión con Google para guardar tus pronósticos.');
      return;
    }
    const submission = buildSubmission(roundFixtures, draftRef.current || {});
    if (submission.kind === 'incomplete') {
      setSaveErrorMsg('Completa los dos marcadores de cada partido antes de guardar.');
      return;
    }
    if (submission.kind === 'empty') {
      toast('No hay pronósticos nuevos o modificados para guardar en esta jornada.');
      return;
    }
    saveMutation.mutate({
      groupId: activeGroupId,
      items: submission.items,
      savedMatchIds: submission.items.map((p) => p.matchId),
    });
  };

  const counts = useMemo(
    () => ({
      predicted: roundFixtures.filter((f) => hasPrediction(localPredictions[f.matchId])).length,
      pending: roundFixtures.filter((f) =>
        isPendingFixture(f, localPredictions, activeGroupIsLocked),
      ).length,
      finished: roundFixtures.filter((f) => f.finished).length,
      total: roundFixtures.length,
    }),
    [roundFixtures, localPredictions, activeGroupIsLocked],
  );

  const displayedFixtures = useMemo(
    () => filterFixtures(roundFixtures, statusFilter, localPredictions, activeGroupIsLocked),
    [roundFixtures, statusFilter, localPredictions, activeGroupIsLocked],
  );

  return {
    isMatchDay,
    fixtures,
    isLoading: fixturesQuery.isLoading,
    isError: fixturesQuery.isError,
    refetch: fixturesQuery.refetch,
    availableRounds,
    selectedRound,
    setSelectedRound,
    roundIndex,
    statusFilter,
    setStatusFilter,
    counts,
    displayedFixtures,
    predictionFor,
    handleScoreChange,
    handleQuickSign,
    handleSaveAll,
    isSaving: saveMutation.isPending,
    hasUnsavedChanges,
    saveSuccessMsg,
    saveErrorMsg,
    selectedMatchForFriends,
    setSelectedMatchForFriends,
  };
}
