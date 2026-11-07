import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useBracketDraft } from '../context/AppContext';
import { createPrediction } from '../services/api';
import { advanceBracketWinner, replaceR32Team } from '../utils/bracketTransitions';
import { getDefaultBracketState, type BracketTeam } from '../store/useAppStore';
import { errorMessage } from '../utils/errors';
import { readGroupsDraft, readThirdsDraft, removeDraft, writeDraft } from '../utils/drafts';
import {
  extractGroupsFromR32,
  hasValidGroupSelections,
  type GroupSelection,
} from '../utils/bracketDraft';
import {
  applyGroupStage,
  buildBracketPrediction,
  fillKnownQualifiers,
  hasAnyRealTeam,
  hasIncompleteR32,
  hasPlaceholderSlots,
  officialGroupStatus,
} from '../utils/bracketEditor';
import { useSavedBracketHydration } from './useSavedBracketHydration';
import { isMatchBasedFormat } from '../utils/poolFormat';

type Side = 'left' | 'right';

/** Estado y acciones del editor del cuadro (grupos, cruces y guardado). */
export function useBracket() {
  const { bracketState, setBracketState, topScorer, setTopScorer } = useBracketDraft();
  const {
    userName,
    setUserName,
    userId,
    isAuthenticated,
    activeGroupId,
    fetchData,
    groupOdds,
    activeGroupPoolFormat,
    officialPoints,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    loadingGroup,
    groupError,
    participantsHashes,
  } = useAppContext();

  const [predictionName, setPredictionName] = useState('');
  const [savedPredictionId, setSavedPredictionId] = useState<string | null>(null);
  const [savedGroupsDraft, setSavedGroupsDraft] = useState<Record<string, GroupSelection>>(() =>
    readGroupsDraft(activeGroupId, userId),
  );
  const [savedThirdsDraft, setSavedThirdsDraft] = useState<string[] | undefined>(() =>
    readThirdsDraft(activeGroupId, userId),
  );
  // Al cambiar de liga o de usuario, el estado local es de la anterior: se relee de su borrador.
  const draftScope = `${userId}:${activeGroupId}`;
  const [loadedDraftScope, setLoadedDraftScope] = useState(draftScope);
  if (loadedDraftScope !== draftScope) {
    setLoadedDraftScope(draftScope);
    setSavedGroupsDraft(readGroupsDraft(activeGroupId, userId));
    setSavedThirdsDraft(readThirdsDraft(activeGroupId, userId));
    setPredictionName('');
    setSavedPredictionId(null);
  }
  const navigate = useNavigate();

  const isKnockoutsOnly = activeGroupPoolFormat === 'KNOCKOUTS_ONLY';
  const isMatchDay = isMatchBasedFormat(activeGroupPoolFormat);
  const allTeams = groupOdds
    ? Object.values(groupOdds)
        .flat()
        .map((t) => t.name)
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!isKnockoutsOnly) return;
    const filled = fillKnownQualifiers(bracketState, officialPoints, groupOdds);
    if (filled) setBracketState(filled);
  }, [officialPoints, groupOdds, bracketState, setBracketState, isKnockoutsOnly]);

  useEffect(() => {
    if (!activeGroupId && !isAuthenticated) {
      toast.error('Debes seleccionar o crear una liga antes de rellenar tu porra.');
      navigate('/mis-ligas');
    }
  }, [activeGroupId, navigate, isAuthenticated]);

  useSavedBracketHydration({
    isAuthenticated,
    activeGroupId,
    userId,
    userName,
    topScorer,
    bracketState,
    groupOdds,
    participantsHashes,
    setBracketState,
    setTopScorer,
    setUserName,
    setPredictionName,
    setSavedPredictionId,
    setSavedGroupsDraft,
    setSavedThirdsDraft,
  });

  /** Si el cuadro tiene equipos pero no hay borrador de grupos, lo deduce del cuadro y lo guarda. */
  const storeGroupsFromBracket = useCallback(() => {
    const extracted = extractGroupsFromR32(
      bracketState.r32,
      groupOdds,
      bracketState.topologyVersion,
    );
    if (!hasValidGroupSelections(extracted.groups)) return;
    setSavedGroupsDraft(extracted.groups);
    writeDraft('groups', activeGroupId, userId, extracted.groups);
    if (extracted.thirds.length > 0 && readThirdsDraft(activeGroupId, userId) === undefined) {
      setSavedThirdsDraft(extracted.thirds);
      writeDraft('advancing', activeGroupId, userId, extracted.thirds);
    }
  }, [bracketState, groupOdds, activeGroupId, userId]);

  useEffect(() => {
    if (hasValidGroupSelections(savedGroupsDraft) || !hasAnyRealTeam(bracketState)) return;
    storeGroupsFromBracket();
  }, [bracketState, savedGroupsDraft, storeGroupsFromBracket]);

  const setR32Team = (teamName: string, side: Side, matchIndex: number, isHome: boolean) => {
    setBracketState(replaceR32Team(bracketState, teamName, side, matchIndex, isHome));
  };

  const advanceTeam = (
    team: BracketTeam | null | undefined,
    side: Side | 'center',
    roundIndex: number,
    matchIndex: number,
  ) => {
    setBracketState(advanceBracketWinner(bracketState, team, side, roundIndex, matchIndex));
  };

  const handleGroupStageComplete = (
    selections: Record<string, GroupSelection>,
    advancingThirds: string[],
  ) => {
    setBracketState(applyGroupStage(bracketState, selections, advancingThirds));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generatePredictionData = async () => {
    if (!predictionName.trim()) {
      toast.error('Ponle nombre a tu porra.');
      return;
    }
    if (!isAuthenticated && (!userName || !bracketState.champion)) {
      toast.error('Pon tu nombre y completa el cuadro hasta el campeón.');
      return;
    }
    if (activeGroupPichichi && !topScorer) {
      toast.error('Falta el pichichi.');
      return;
    }
    if (isKnockoutsOnly && hasIncompleteR32(bracketState)) {
      toast.error('Rellena todos los equipos de dieciseisavos.');
      return;
    }
    const predictionData = buildBracketPrediction({
      state: bracketState,
      userName,
      predictionName,
      topScorer,
      groups: readGroupsDraft(activeGroupId, userId),
      thirds: readThirdsDraft(activeGroupId, userId) ?? [],
      knockoutsOnly: isKnockoutsOnly,
    });
    if (activeGroupIsLocked) {
      toast.error('El plazo para enviar o modificar porras en esta liga ha finalizado.');
      return;
    }
    try {
      await createPrediction(predictionData, activeGroupId);
      toast.success('Porra guardada.');
      fetchData();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar la porra. Inténtalo de nuevo.'));
    }
  };

  const getTeamStatus = (team: string | null | undefined) =>
    officialGroupStatus(team, officialPoints, groupOdds);

  const hasPlaceholders = useMemo(() => hasPlaceholderSlots(bracketState), [bracketState]);

  const isInitialState =
    !isKnockoutsOnly && hasPlaceholders && groupOdds && Object.keys(groupOdds).length > 0;

  const handleResetToGroupStage = () => {
    // Antes de vaciar el cuadro se guardan los grupos que se deducen de él.
    if (!hasValidGroupSelections(savedGroupsDraft)) storeGroupsFromBracket();
    setBracketState(getDefaultBracketState(bracketState.topologyVersion));
    removeDraft('bracket', activeGroupId, userId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    bracketState,
    setBracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    predictionName,
    setPredictionName,
    isKnockoutsOnly,
    isMatchDay,
    allTeams,
    isInitialState,
    isAuthenticated,
    activeGroupId,
    userId,
    groupOdds,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    setR32Team,
    advanceTeam,
    handleGroupStageComplete,
    generatePredictionData,
    getTeamStatus,
    handleResetToGroupStage,
    savedGroupsDraft,
    savedThirdsDraft,
    savedPredictionId,
    loadingGroup,
    groupError,
  };
}
