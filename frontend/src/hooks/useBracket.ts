import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { createPrediction, fetchMyPredictions, getAuthToken } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { solveThirdPlaceMatrix, THIRD_PLACE_RULES } from '../utils/matrix';
import { isGlobalLeagueId } from '../utils/constants';
import {
  defaultBracketState,
  type BracketMatch,
  type BracketState,
  type BracketTeam,
} from '../store/useAppStore';

import type { TeamPair } from '../types/api';

type Side = 'left' | 'right';

const cloneBracket = (state: BracketState): BracketState => JSON.parse(JSON.stringify(state));

const EMPTY_BRACKET_JSON = JSON.stringify(defaultBracketState);
/** El cuadro no tiene nada rellenado (no hay borrador local que conservar). */
const isEmptyBracket = (state: BracketState): boolean =>
  state === defaultBracketState || JSON.stringify(state) === EMPTY_BRACKET_JSON;

/** Nombres de los dos equipos de un cruce, si ya están los dos. */
const matchPair = (m: BracketMatch | null): string[] | undefined => {
  const home = m?.home?.name;
  const away = m?.away?.name;
  return home && away ? [home, away] : undefined;
};
import { errorMessage } from '../utils/errors';
import { readGroupsDraft, readThirdsDraft, removeDraft, writeDraft } from '../utils/drafts';
import {
  extractGroupsFromR32,
  hasValidGroupSelections,
  normalizeGroupsDraft,
  reconstructBracketState,
  type GroupSelection,
  teamName,
} from '../utils/bracketDraft';

/** Estado y acciones del editor del cuadro (grupos, cruces y guardado). */
export function useBracket() {
  const {
    bracketState,
    setBracketState,
    userName,
    setUserName,
    userId,
    topScorer,
    setTopScorer,
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
  const [savedThirdsDraft, setSavedThirdsDraft] = useState<string[]>(() =>
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
  const isMatchDay = activeGroupPoolFormat === 'MATCH_DAY';
  const allTeams = groupOdds
    ? Object.values(groupOdds)
        .flat()
        .map((t) => t.name)
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!isKnockoutsOnly) return;
    if (!officialPoints || Object.keys(officialPoints).length === 0) return;
    const hasAnyPlaceholder = [...bracketState.r32.left, ...bracketState.r32.right].some(
      (m) => m.home?.name?.includes('º') || m.away?.name?.includes('º'),
    );
    if (!hasAnyPlaceholder) return;

    const firstPlace: Record<string, string> = {};
    const secondPlace: Record<string, string> = {};
    Object.entries(officialPoints).forEach(([g, teams]) => {
      Object.entries(teams).forEach(([name, s]) => {
        if (s.status === 1) firstPlace[g] = name;
        if (s.status === 2) secondPlace[g] = name;
      });
    });
    Object.keys(firstPlace).forEach((g) => {
      const orig = (groupOdds?.[g] || []).find(
        (t) => t.name.replace(/[.#$[\]]/g, '') === firstPlace[g],
      );
      if (orig) firstPlace[g] = orig.name;
    });
    Object.keys(secondPlace).forEach((g) => {
      const orig = (groupOdds?.[g] || []).find(
        (t) => t.name.replace(/[.#$[\]]/g, '') === secondPlace[g],
      );
      if (orig) secondPlace[g] = orig.name;
    });
    if (!Object.keys(firstPlace).length && !Object.keys(secondPlace).length) return;

    const ns = cloneBracket(bracketState);
    let changed = false;
    const updateSlot = (slot: BracketTeam | null) => {
      if (slot?.name?.startsWith('1º Grupo ')) {
        const g = slot.name.replace('1º Grupo ', '');
        if (firstPlace[g]) {
          slot.name = firstPlace[g];
          changed = true;
        }
      } else if (slot?.name?.startsWith('2º Grupo ')) {
        const g = slot.name.replace('2º Grupo ', '');
        if (secondPlace[g]) {
          slot.name = secondPlace[g];
          changed = true;
        }
      }
    };

    [...ns.r32.left, ...ns.r32.right].forEach((m) => {
      updateSlot(m.home);
      updateSlot(m.away);
    });
    if (changed) setBracketState(ns);
  }, [officialPoints, groupOdds, bracketState, setBracketState, isKnockoutsOnly]);

  useEffect(() => {
    if (!activeGroupId && !isAuthenticated) {
      toast.error('Debes seleccionar o crear una liga antes de rellenar tu porra.');
      navigate('/mis-ligas');
    }
  }, [activeGroupId, navigate, isAuthenticated]);

  // Valores que la hidratación consulta al llegar la respuesta, sin volver a lanzarla.
  const latestRef = useRef({ participantsHashes, groupOdds, userName, topScorer, bracketState });
  useEffect(() => {
    latestRef.current = { participantsHashes, groupOdds, userName, topScorer, bracketState };
  });

  // Liga (y usuario) cuya porra guardada ya se ha volcado al editor.
  const hydratedScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!(isAuthenticated || Boolean(getAuthToken())) || !activeGroupId) return;
    const scope = `${userId}:${activeGroupId}`;
    // Una sola vez por liga: volver a hidratar pisaría lo que el usuario lleva editado.
    if (hydratedScopeRef.current === scope) return;
    hydratedScopeRef.current = scope;
    const groupId = activeGroupId;
    let cancelled = false;
    let settled = false;

    fetchMyPredictions()
      .then((predictions) => {
        settled = true;
        // Si ha cambiado la liga mientras llegaba la respuesta, no es de esta liga.
        if (cancelled || !Array.isArray(predictions)) return;
        const latest = latestRef.current;
        let current = predictions.find((b) => b.groupId?.toString() === groupId);
        if (!current && isGlobalLeagueId(groupId)) {
          current = predictions.find((b) => !b.groupId || isGlobalLeagueId(b.groupId));
        }
        if (!current && predictions.length === 1) {
          current = predictions[0];
        }
        if (!current && latest.participantsHashes.length > 0) {
          current = latest.participantsHashes.find(
            (p) =>
              (userId && p.userId?.toString() === userId) ||
              (latest.userName &&
                p.participantName?.toLowerCase() === latest.userName.toLowerCase()),
          );
        }
        if (!current) return;

        setSavedPredictionId(current.key || null);
        if (current.participantName && !latest.userName) setUserName(current.participantName);
        const predictionTitle = current.predictionName;
        if (predictionTitle) setPredictionName((prev) => prev || predictionTitle);
        const currentData = current.data;
        if (!currentData) return;
        if (currentData.scorer && !latest.topScorer) setTopScorer(currentData.scorer);

        let norm = normalizeGroupsDraft(currentData.groups);
        let normThirds = Array.isArray(currentData.thirds) ? currentData.thirds : [];
        if (!hasValidGroupSelections(norm) && (currentData.r32 || currentData.r1)) {
          const extracted = extractGroupsFromR32(
            currentData.r32 || currentData.r1,
            latest.groupOdds,
          );
          norm = extracted.groups;
          if (normThirds.length === 0) normThirds = extracted.thirds;
        }

        // Un borrador local sin guardar manda sobre lo que hay en el servidor.
        if (
          hasValidGroupSelections(norm) &&
          !hasValidGroupSelections(readGroupsDraft(groupId, userId))
        ) {
          setSavedGroupsDraft(norm);
          writeDraft('groups', groupId, userId, norm);
        }
        if (normThirds.length > 0 && readThirdsDraft(groupId, userId).length === 0) {
          setSavedThirdsDraft(normThirds);
          writeDraft('advancing', groupId, userId, normThirds);
        }
        const hydrated = reconstructBracketState(currentData);
        if (hydrated && isEmptyBracket(latest.bracketState)) {
          setBracketState(hydrated);
        }
      })
      .catch((err) => {
        settled = true;
        // Sin respuesta no se ha hidratado nada: se reintentará la próxima vez.
        if (hydratedScopeRef.current === scope) hydratedScopeRef.current = null;
        console.error(err);
      });

    return () => {
      cancelled = true;
      // Una petición cortada a medias no cuenta como hidratada.
      if (!settled && hydratedScopeRef.current === scope) hydratedScopeRef.current = null;
    };
  }, [userId, activeGroupId, isAuthenticated, setBracketState, setTopScorer, setUserName]);

  // Si aún no hay borrador de grupos válido pero el bracket ya tiene equipos en R32, extraer automáticamente
  useEffect(() => {
    if (hasValidGroupSelections(savedGroupsDraft)) return;
    const leftMatches = bracketState.r32?.left || [];
    const rightMatches = bracketState.r32?.right || [];
    const hasAnyRealTeam = [...leftMatches, ...rightMatches].some(
      (m) =>
        (m.home?.name &&
          !m.home.name.includes('º') &&
          m.home.name !== 'Por definir' &&
          m.home.name !== '???') ||
        (m.away?.name &&
          !m.away.name.includes('º') &&
          m.away.name !== 'Por definir' &&
          m.away.name !== '???'),
    );
    if (!hasAnyRealTeam) return;

    const extracted = extractGroupsFromR32(bracketState.r32, groupOdds);
    if (hasValidGroupSelections(extracted.groups)) {
      setSavedGroupsDraft(extracted.groups);
      writeDraft('groups', activeGroupId, userId, extracted.groups);
      if (extracted.thirds && extracted.thirds.length > 0) {
        setSavedThirdsDraft(extracted.thirds);
        writeDraft('advancing', activeGroupId, userId, extracted.thirds);
      }
    }
  }, [bracketState, savedGroupsDraft, groupOdds, activeGroupId, userId]);

  const setR32Team = (teamName: string, side: Side, matchIndex: number, isHome: boolean) => {
    const ns = cloneBracket(bracketState);
    const m = side === 'left' ? ns.r32.left[matchIndex] : ns.r32.right[matchIndex];
    if (isHome) m.home = { name: teamName, id: `${side}_${matchIndex}_home` };
    else m.away = { name: teamName, id: `${side}_${matchIndex}_away` };
    setBracketState(ns);
  };

  const advanceTeam = (
    team: BracketTeam | null | undefined,
    side: Side | 'center',
    roundIndex: number,
    matchIndex: number,
  ) => {
    if (!team || team.name.includes('º')) return;
    const ns = cloneBracket(bracketState);

    if (roundIndex < 3) {
      const arr = [ns.r16, ns.qf, ns.sf][roundIndex][side as Side];
      const next = Math.floor(matchIndex / 2);
      if (matchIndex % 2 === 0) arr[next].home = team;
      else arr[next].away = team;
    } else if (roundIndex === 3) {
      if (!ns.final) ns.final = { home: null, away: null, id: 'FINAL' };
      if (!ns.thirdPlaceMatch) ns.thirdPlaceMatch = { home: null, away: null, id: 'THIRD' };
      const sf = bracketState.sf[side as Side][0];
      const loser = sf.home?.name === team.name ? sf.away : sf.home;
      if (side === 'left') {
        ns.final.home = team;
        ns.thirdPlaceMatch.home = loser;
      } else {
        ns.final.away = team;
        ns.thirdPlaceMatch.away = loser;
      }
      ns.champion = null;
      ns.thirdPlaceWinner = null;
    } else if (roundIndex === 4) {
      ns.champion = team;
    } else if (roundIndex === 5) {
      ns.thirdPlaceWinner = team;
    }
    setBracketState(ns);
  };

  const getTeamPairs = (matches: BracketMatch[]): TeamPair[] =>
    matches.map((m): TeamPair => [
      m.home?.name && !m.home.name.includes('º') ? m.home.name : null,
      m.away?.name && !m.away.name.includes('º') ? m.away.name : null,
    ]);

  const handleGroupStageComplete = (
    selections: Record<string, GroupSelection>,
    advancingThirds: string[],
  ) => {
    const ns = cloneBracket(bracketState);
    const applySlot = (slot: BracketTeam | null) => {
      if (!slot?.name?.includes('º Grupo')) return;
      const [pos, , group] = slot.name.split(' ');
      const sel = selections[group];
      if (sel) slot.name = pos === '1º' ? sel.first : sel.second;
    };

    [...ns.r32.left, ...ns.r32.right].forEach((m) => {
      applySlot(m.home);
      applySlot(m.away);
    });

    const teamToGroup: Record<string, string> = {};
    Object.keys(selections).forEach((g) => {
      if (selections[g].third) teamToGroup[selections[g].third] = g;
    });

    const thirdTeams = advancingThirds.map((t) => ({ team: t, group: teamToGroup[t] }));
    const solvedMatrix = solveThirdPlaceMatrix(thirdTeams);

    if (solvedMatrix) {
      THIRD_PLACE_RULES.forEach((rule, idx) => {
        const match = ns.r32[rule.side][rule.matchIndex];
        const slot = rule.isHome ? match.home : match.away;
        if (slot?.name?.startsWith('3º ')) {
          slot.name = solvedMatrix[idx].team;
        }
      });
    } else {
      const sorted3rds = [...advancingThirds].sort((a, b) =>
        teamToGroup[a].localeCompare(teamToGroup[b]),
      );
      let ti = 0;
      const apply3rdFallback = (slot: BracketTeam | null) => {
        if (slot?.name?.startsWith('3º ') && ti < sorted3rds.length) slot.name = sorted3rds[ti++];
      };
      [...ns.r32.left, ...ns.r32.right].forEach((m) => {
        apply3rdFallback(m.home);
        apply3rdFallback(m.away);
      });
    }

    setBracketState(ns);
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
    if (isKnockoutsOnly) {
      const all = [...bracketState.r32.left, ...bracketState.r32.right];
      if (
        all.some(
          (m) =>
            !m.home?.name ||
            m.home.name.includes('º') ||
            !m.away?.name ||
            m.away.name.includes('º'),
        )
      ) {
        toast.error('Rellena todos los equipos de dieciseisavos.');
        return;
      }
    }
    const r32 = [...getTeamPairs(bracketState.r32.left), ...getTeamPairs(bracketState.r32.right)];
    const r16 = [...getTeamPairs(bracketState.r16.left), ...getTeamPairs(bracketState.r16.right)];
    const qf = [...getTeamPairs(bracketState.qf.left), ...getTeamPairs(bracketState.qf.right)];
    const sf = [...getTeamPairs(bracketState.sf.left), ...getTeamPairs(bracketState.sf.right)];

    const groupsRaw = readGroupsDraft(activeGroupId, userId);
    const advancingThirds = readThirdsDraft(activeGroupId, userId);

    const formattedGroups: Record<string, string[]> = {};
    Object.keys(groupsRaw).forEach((g) => {
      formattedGroups[g] = [groupsRaw[g].first, groupsRaw[g].second];
      if (groupsRaw[g].third) formattedGroups[g].push(groupsRaw[g].third);
    });

    const predictionData = {
      user: userName,
      prediction: predictionName,
      r1: r32,
      r32,
      r16,
      qf,
      sf,
      final: matchPair(bracketState.final),
      champion: teamName(bracketState.champion),
      thirdPlaceMatch: matchPair(bracketState.thirdPlaceMatch),
      thirdPlaceWinner: teamName(bracketState.thirdPlaceWinner),
      scorer: topScorer,
      groups: isKnockoutsOnly ? {} : formattedGroups,
      thirds: isKnockoutsOnly ? [] : advancingThirds,
    };
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

  const getTeamStatus = (teamName: string | null | undefined) => {
    if (!teamName || !officialPoints || !groupOdds) return 0;
    for (const groupName of Object.keys(officialPoints)) {
      if (!groupOdds[groupName]) continue;
      const isInGroup = groupOdds[groupName].some((t) => t.name === teamName);
      if (!isInGroup) continue;
      const safeKey = teamName.replace(/[.#$[\]]/g, '');
      const officialData = officialPoints[groupName][safeKey];
      if (typeof officialData === 'object' && officialData !== null) {
        return officialData.status || 0;
      }
    }
    return 0;
  };

  const hasPlaceholders = useMemo(() => {
    const leftMatches = bracketState.r32?.left || [];
    const rightMatches = bracketState.r32?.right || [];
    const allMatches = [...leftMatches, ...rightMatches];
    if (allMatches.length === 0) return true;
    return allMatches.some(
      (m) =>
        !m.home?.name ||
        m.home.name.includes('º') ||
        m.home.name.startsWith('3º') ||
        !m.away?.name ||
        m.away.name.includes('º') ||
        m.away.name.startsWith('3º'),
    );
  }, [bracketState]);

  const isInitialState =
    !isKnockoutsOnly && hasPlaceholders && groupOdds && Object.keys(groupOdds).length > 0;

  const handleResetToGroupStage = () => {
    // Si aún no tenemos selecciones válidas pero el cuadro actual tiene equipos, extraer antes de resetear
    if (!hasValidGroupSelections(savedGroupsDraft)) {
      const extracted = extractGroupsFromR32(bracketState.r32, groupOdds);
      if (hasValidGroupSelections(extracted.groups)) {
        setSavedGroupsDraft(extracted.groups);
        writeDraft('groups', activeGroupId, userId, extracted.groups);
        if (extracted.thirds && extracted.thirds.length > 0) {
          setSavedThirdsDraft(extracted.thirds);
          writeDraft('advancing', activeGroupId, userId, extracted.thirds);
        }
      }
    }
    setBracketState(defaultBracketState);
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
