import { useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { normalizeCountryName } from '../utils/constants';
import {
  fetchCustomMatches,
  fetchGroup,
  fetchLeaderboard,
  fetchLeaderboardMatchdays,
  fetchMatchRadar,
  fetchMatches,
  fetchStandings,
  fetchTeamOdds,
  fetchTopScorers,
} from '../services/api';
import { isApiError } from '../services/apiError';
import { queryKeys } from '../services/queryKeys';
import { featuredGroupQuery, leaguePredictionsQuery, myGroupsQuery } from '../services/queries';
import { useAppStore } from '../store/useAppStore';
import type { Group, MatchRadar } from '../types/api';
import { isMatchBasedFormat } from '../utils/poolFormat';
import { forgetLeague, pickMostRecentLeague } from './leagueFallback';

/** Competición del Mundial en el proveedor: solo sus ligas usan grupos, terceros y pichichi oficiales. */
export const WORLD_CUP_EXTERNAL_ID = 'fifa.world';

// Valores vacíos compartidos (referencia estable). Se tipan como mutables para que
// se unan sin fricción con el tipo de cada consulta.
const EMPTY_OBJECT = Object.freeze({}) as Record<string, never>;
const EMPTY_ARRAY = Object.freeze([]) as never[];
const EMPTY_RADAR = Object.freeze({ live: [], last: [], next: [] }) as MatchRadar;
const NO_GROUP_NAME = 'Ninguna liga seleccionada';

// Copia de «todos los partidos» de cuando la app pedía partidos sin liga: mezclaba deportes y
// competiciones y podía tener partidos ya jugados como pendientes. Ya no se pide; se borra.
try {
  localStorage.removeItem('cached_matches_all');
} catch {
  /* almacenamiento bloqueado */
}

/**
 * Copia local de los datos oficiales y públicos (clasificación, cuotas, partidos) para pintar algo
 * al abrir la app sin red. Solo datos públicos: nada de una liga privada se guarda en el dispositivo.
 */
const localCopy = {
  read(key: string): unknown {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(normalizeCountryName(raw)) : undefined;
    } catch {
      return undefined;
    }
  },
  write(key: string, data: unknown) {
    if (!data) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  },
  /** La copia guardada si es un objeto; si no, los datos anteriores de la consulta. */
  objectOr<T>(key: string, previous: T | undefined): T | undefined {
    const cached = localCopy.read(key);
    return cached && typeof cached === 'object' ? (cached as T) : previous;
  },
};

const isObject = (value: unknown): value is object =>
  Boolean(value) && typeof value === 'object' && typeof value !== 'function';

/** Estado de la liga activa, con los datos en bruto que usan los demás hooks de este módulo. */
function useLeagueState() {
  const { activeGroupId, isAuthenticated } = useAppStore(
    useShallow((s) => ({
      activeGroupId: s.activeGroupId,
      isAuthenticated: s.isAuthenticated,
    })),
  );

  const {
    data: userGroups,
    isFetched: userGroupsFetched,
    isError: userGroupsError,
  } = useQuery(myGroupsQuery(isAuthenticated));

  const {
    data: groupInfo,
    isPending: groupPending,
    error: groupError,
  } = useQuery<Partial<Group>>({
    queryKey: queryKeys.group(activeGroupId),
    queryFn: () =>
      activeGroupId ? fetchGroup(activeGroupId) : Promise.resolve({ name: NO_GROUP_NAME }),
    placeholderData: () => {
      if (!activeGroupId) return { name: NO_GROUP_NAME };
      const fromList = Array.isArray(userGroups)
        ? userGroups.find((g) => g.id.toString() === activeGroupId.toString())
        : null;
      if (fromList) {
        return {
          id: fromList.id,
          name: fromList.name,
          competitionId: fromList.competitionId,
          competitionName: fromList.competitionName,
          multiCompetition: fromList.multiCompetition,
          matchSelection: fromList.matchSelection,
          competitionExternalId: fromList.competitionExternalId,
          customCompetition: fromList.customCompetition,
          formatType: fromList.formatType,
          poolFormat: fromList.poolFormat,
          pichichi: fromList.pichichi,
          isLocked: fromList.isLocked,
          lockDate: fromList.lockDate,
          adminParticipantName: fromList.adminParticipantName,
          adminUserId: fromList.adminUserId,
          rules: fromList.rules,
        };
      }
      return undefined;
    },
  });

  // Sin liga no hay competición ni formato: nada se rellena con los del Mundial ni con los de la
  // liga anterior.
  const activeCompetitionId = activeGroupId ? (groupInfo?.competitionId ?? null) : null;
  const activeGroupPoolFormat = (activeGroupId && groupInfo?.poolFormat) || null;
  const worldCup =
    Boolean(activeGroupId) &&
    groupInfo?.competitionExternalId === WORLD_CUP_EXTERNAL_ID &&
    !groupInfo?.multiCompetition;

  return {
    groupInfo,
    /** Hay liga activa y ya se sabe a qué competición pertenece. */
    competitionReady: Boolean(activeGroupId) && activeCompetitionId != null,
    /** La liga activa es del Mundial: la única con grupos, cuotas y pichichi oficiales. */
    activeGroupWorldCup: worldCup,
    loadingGroup: Boolean(activeGroupId && groupPending),
    groupError:
      groupInfo && (!isApiError(groupError) || groupError.status === 0 || groupError.status >= 500)
        ? null
        : groupError,
    activeGroupName: groupInfo?.name || NO_GROUP_NAME,
    activeGroupAdmin: groupInfo?.adminParticipantName || null,
    activeGroupAdminId: groupInfo?.adminUserId || null,
    activeGroupPoolFormat,
    activeGroupCustomCompetition: Boolean(groupInfo?.customCompetition),
    // Se pronostica sobre sus propios cruces: competición personalizada o torneo oficial que no es
    // el Mundial (Worlds de LoL…). Las de jornadas no tienen cuadro.
    activeGroupOwnBracket:
      !isMatchBasedFormat(groupInfo?.poolFormat) &&
      (Boolean(groupInfo?.customCompetition) ||
        (groupInfo?.formatType === 'TOURNAMENT' &&
          Boolean(groupInfo?.competitionExternalId) &&
          groupInfo?.competitionExternalId !== WORLD_CUP_EXTERNAL_ID)),
    // NFL: se predice quién gana, sin empate, así que los votos van en dos columnas.
    activeGroupWinnerOnly:
      groupInfo?.competitionExternalId === 'nfl' && !groupInfo.multiCompetition,
    // Eliminatorias que se sortean ronda a ronda (Champions, Copa del Rey…): se pronostican ronda a ronda.
    activeGroupKnockoutDraw: Boolean(groupInfo?.knockoutDraw),
    // Liga por jornadas que elige sus partidos (de una o de varias competiciones).
    activeGroupPicksMatches: groupInfo?.matchSelection === 'CUSTOM',
    activeGroupMultiCompetition: Boolean(groupInfo?.multiCompetition),
    // El pichichi oficial es del Mundial: sin dato de la liga, solo lo tienen las del Mundial.
    activeGroupPichichi: Boolean(groupInfo?.pichichi ?? worldCup),
    activeGroupIsLocked: Boolean(groupInfo?.isLocked),
    activeGroupLockDate: groupInfo?.lockDate || null,
    activeGroupRules: groupInfo?.rules || '',
    activeCompetitionId,
    // Una liga de varias competiciones no es la porra de una sola (la imagen para compartir lo dice).
    activeCompetitionName: groupInfo?.multiCompetition ? null : groupInfo?.competitionName || null,
    activeCompetitionExternalId: groupInfo?.competitionExternalId || null,
    activeCompetitionFormatType:
      groupInfo?.formatType ||
      (activeGroupPoolFormat
        ? isMatchBasedFormat(activeGroupPoolFormat)
          ? 'LEAGUE'
          : 'TOURNAMENT'
        : null),
    userGroups: Array.isArray(userGroups) ? userGroups : EMPTY_ARRAY,
    userGroupsLoaded: !isAuthenticated || (userGroupsFetched && !userGroupsError),
  };
}

/** La liga activa: sus datos, su competición y la lista de ligas del usuario. */
export function useActiveLeague() {
  const { groupInfo, competitionReady, ...league } = useLeagueState();
  return league;
}

/** Datos oficiales de la competición activa: clasificación, partidos, radar, cuotas y goleadores. */
export function useOfficialData() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const {
    competitionReady,
    loadingGroup,
    activeCompetitionId,
    activeGroupCustomCompetition: isCustomCompetition,
    activeGroupPichichi: leaguePichichi,
    activeGroupWorldCup: worldCup,
  } = useLeagueState();
  // Clasificación de grupos, cuotas y goleadores son datos del Mundial: solo para sus ligas.
  const activeGroupPichichi = worldCup && leaguePichichi;

  const { data: standings, isLoading: loadingStandings } = useQuery({
    queryKey: queryKeys.standings(),
    enabled: worldCup,
    queryFn: async () => {
      const data = await fetchStandings();
      localCopy.write('cached_official_standings', data);
      return data;
    },
    placeholderData: (previous) => localCopy.objectOr('cached_official_standings', previous),
  });

  const { data: radar } = useQuery({
    queryKey: queryKeys.radar(activeCompetitionId),
    queryFn: () => (isCustomCompetition ? EMPTY_RADAR : fetchMatchRadar(activeCompetitionId)),
    enabled: competitionReady && !isCustomCompetition,
  });

  const { data: odds } = useQuery({
    queryKey: queryKeys.odds(),
    enabled: worldCup,
    queryFn: async () => {
      const data = await fetchTeamOdds();
      localCopy.write('cached_official_odds', data);
      return data;
    },
    placeholderData: (previous) => localCopy.objectOr('cached_official_odds', previous),
  });

  const matchesCacheKey = `cached_matches_${activeCompetitionId}`;
  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: isCustomCompetition
      ? queryKeys.customMatches(activeGroupId)
      : queryKeys.matches(activeCompetitionId),
    enabled: isCustomCompetition ? Boolean(activeGroupId) : competitionReady,
    queryFn: async () => {
      if (isCustomCompetition && activeGroupId) {
        return fetchCustomMatches(Number(activeGroupId));
      }
      const data = await fetchMatches(activeCompetitionId);
      localCopy.write(matchesCacheKey, data || []);
      return data || [];
    },
    placeholderData: () => {
      if (isCustomCompetition || !competitionReady) return undefined;
      const cached = localCopy.read(matchesCacheKey);
      return Array.isArray(cached) && cached.length > 0 ? cached : undefined;
    },
  });

  const {
    data: topScorers,
    isLoading: topScorersLoading,
    isError: topScorersError,
    refetch: refreshTopScorers,
  } = useQuery({
    queryKey: queryKeys.topScorers(),
    queryFn: fetchTopScorers,
    enabled: activeGroupPichichi,
    staleTime: 300_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const nameToIdMap = useMemo(() => {
    if (!Array.isArray(matches)) return EMPTY_OBJECT;
    return matches.reduce<Record<string, number>>((acc, m) => {
      if (m?.home && m?.home_team_id != null) acc[m.home] = m.home_team_id;
      if (m?.away && m?.away_team_id != null) acc[m.away] = m.away_team_id;
      return acc;
    }, {});
  }, [matches]);

  return {
    officialPoints: worldCup && isObject(standings) ? standings : EMPTY_OBJECT,
    matchRadar: competitionReady && isObject(radar) ? radar : EMPTY_RADAR,
    allGames: competitionReady && Array.isArray(matches) ? matches : EMPTY_ARRAY,
    groupOdds: worldCup && isObject(odds) ? odds : EMPTY_OBJECT,
    nameToIdMap,
    loading:
      loadingGroup || (worldCup && loadingStandings && !standings) || (loadingMatches && !matches),
    topScorers: activeGroupPichichi && Array.isArray(topScorers) ? topScorers : EMPTY_ARRAY,
    topScorersLoading: activeGroupPichichi && topScorersLoading,
    topScorersError: activeGroupPichichi && topScorersError,
    refreshTopScorers,
  };
}

/** Ranking de la liga activa y pronósticos ya descargados. */
export function useLeagueRanking() {
  const queryClient = useQueryClient();
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const { groupInfo } = useLeagueState();
  const isMatchdayPool =
    isMatchBasedFormat(groupInfo?.poolFormat) || groupInfo?.formatType === 'LEAGUE';

  // Los pronósticos de toda la liga son pesados: aquí solo se leen de la caché. Los piden las
  // pantallas que los usan (useLeaguePredictions); el resto no los descarga.
  const { data: predictions } = useQuery({
    ...leaguePredictionsQuery(activeGroupId),
    enabled: false,
  });

  const {
    data: leaderboard,
    error: leaderboardError,
    isPending: leaderboardPending,
  } = useQuery({
    queryKey: queryKeys.leaderboard(activeGroupId),
    queryFn: () => fetchLeaderboard(activeGroupId),
    enabled: Boolean(activeGroupId),
  });

  const { data: leaderboardMatchdays } = useQuery({
    queryKey: queryKeys.leaderboardMatchdays(activeGroupId),
    queryFn: () => fetchLeaderboardMatchdays(activeGroupId),
    enabled: Boolean(activeGroupId && isMatchdayPool),
    staleTime: 60_000,
  });

  return {
    participantsHashes: Array.isArray(predictions) ? predictions : EMPTY_ARRAY,
    leaderboardData: Array.isArray(leaderboard) ? leaderboard : EMPTY_ARRAY,
    leaderboardMatchdays: Array.isArray(leaderboardMatchdays) ? leaderboardMatchdays : EMPTY_ARRAY,
    /** Ranking aún sin datos: evita mostrar un podio a cero mientras carga. */
    loadingLeaderboard: Boolean(activeGroupId) && leaderboardPending && !leaderboardError,
    /** Recarga los datos de la liga activa (tras guardar, aceptar o borrar un pronóstico). */
    fetchData: () =>
      Promise.all(
        [
          queryKeys.group(activeGroupId),
          queryKeys.groupMembers(activeGroupId),
          queryKeys.customMatches(activeGroupId),
          queryKeys.customTeams(activeGroupId),
          queryKeys.predictions(activeGroupId),
          queryKeys.myPredictions(),
          queryKeys.leaderboard(activeGroupId),
          queryKeys.leaderboardMatchdays(activeGroupId),
          queryKeys.matchdayFixtures(activeGroupId),
          queryKeys.predictionScore(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  };
}

/**
 * Efectos de la liga activa. Van una sola vez en `AppProvider`: dentro de los hooks de datos se
 * repetían en cada componente que los usaba.
 */
export function useLeagueDataEffects() {
  const queryClient = useQueryClient();
  const {
    activeGroupId,
    storeCompetitionId,
    setActiveCompetitionId,
    isDemoMode,
    changeGroup,
    isAuthenticated,
    choosingLeague,
  } = useAppStore(
    useShallow((s) => ({
      activeGroupId: s.activeGroupId,
      storeCompetitionId: s.activeCompetitionId,
      setActiveCompetitionId: s.setActiveCompetitionId,
      isDemoMode: s.isDemoMode,
      changeGroup: s.changeGroup,
      isAuthenticated: s.isAuthenticated,
      choosingLeague: s.choosingLeague,
    })),
  );
  const { groupInfo } = useLeagueState();
  const { data: myGroups, dataUpdatedAt: myGroupsUpdatedAt } = useQuery(
    myGroupsQuery(isAuthenticated),
  );

  // La competición de la liga activa se guarda para el próximo arranque.
  useEffect(() => {
    if (groupInfo?.competitionId != null && groupInfo.competitionId !== storeCompetitionId) {
      setActiveCompetitionId(groupInfo.competitionId);
    }
  }, [groupInfo?.competitionId, storeCompetitionId, setActiveCompetitionId]);

  // Un 403 o 404 en la liga activa (p. ej. tras una expulsión o si la han borrado) refresca la lista
  // de ligas; si ya no está, el efecto de abajo abre otra. El ranking se pide en todas las
  // pantallas; los pronósticos, solo en las que los usan.
  const { error: predictionsError } = useQuery({
    ...leaguePredictionsQuery(activeGroupId),
    enabled: false,
  });
  const { error: leaderboardError } = useQuery({
    queryKey: queryKeys.leaderboard(activeGroupId),
    queryFn: () => fetchLeaderboard(activeGroupId),
    enabled: Boolean(activeGroupId),
  });
  const { error: groupError } = useQuery<Partial<Group>>({
    queryKey: queryKeys.group(activeGroupId),
    enabled: false,
  });
  const forbiddenError = [groupError, predictionsError, leaderboardError].find(
    (error) => isApiError(error, 403) || isApiError(error, 404) || isApiError(error, 410),
  );
  useEffect(() => {
    if (!isDemoMode && forbiddenError && activeGroupId) {
      console.warn('No se pudieron cargar los datos de la liga activa', {
        activeGroupId,
        message: forbiddenError.message,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
    }
  }, [forbiddenError, activeGroupId, queryClient, isDemoMode]);

  // Cuándo se eligió la liga activa: una lista de ligas anterior aún no la incluye (recién creada).
  const selectedAt = useRef({ groupId: activeGroupId, at: 0 });
  useEffect(() => {
    if (selectedAt.current.groupId !== activeGroupId)
      selectedAt.current = { groupId: activeGroupId, at: Date.now() };
  }, [activeGroupId]);

  // La liga abandonada se olvida cuando las pantallas ya piden la nueva: antes, sus consultas
  // aún montadas la volverían a guardar.
  const leftGroupId = useRef<string | null>(null);
  useEffect(() => {
    const left = leftGroupId.current;
    if (!left || left === activeGroupId) return;
    leftGroupId.current = null;
    forgetLeague(queryClient, left);
  }, [activeGroupId, queryClient]);

  // La liga activa ya no es del usuario (se ha salido, la han borrado o le han quitado el acceso) o
  // no hay ninguna elegida teniendo ligas: se abre la más reciente sin recargar y se olvida la
  // anterior. Sin ligas queda vacía y cada pantalla lo explica. Al arrancar elige AppProvider.
  useEffect(() => {
    if (isDemoMode || !isAuthenticated || choosingLeague || !Array.isArray(myGroups)) return;
    if (localStorage.getItem('pendingJoinCode')) return;
    if (activeGroupId && myGroups.some((g) => String(g.id) === activeGroupId)) return;
    if (!activeGroupId && myGroups.length === 0) return;
    if (activeGroupId && myGroupsUpdatedAt < selectedAt.current.at) {
      // Lista anterior a la elección (p. ej. una liga recién creada): se confirma con el servidor.
      void queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
      return;
    }
    const left = activeGroupId;
    leftGroupId.current = left || null;
    changeGroup(pickMostRecentLeague(myGroups.filter((g) => String(g.id) !== left)));
  }, [
    activeGroupId,
    myGroups,
    myGroupsUpdatedAt,
    isAuthenticated,
    isDemoMode,
    choosingLeague,
    changeGroup,
    queryClient,
  ]);

  // La demo sin liga elegida abre la liga pública destacada.
  const needsFeaturedGroup = isDemoMode && !activeGroupId;
  const { data: featuredGroup } = useQuery({
    ...featuredGroupQuery(),
    enabled: needsFeaturedGroup,
  });
  useEffect(() => {
    if (needsFeaturedGroup && featuredGroup?.id != null) changeGroup(featuredGroup.id);
  }, [needsFeaturedGroup, featuredGroup, changeGroup]);
}
