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
  fetchTournamentGroupOdds,
  fetchTournamentStandings,
  fetchTournamentTopScorers,
} from '../services/api';
import { isApiError } from '../services/apiError';
import { queryKeys } from '../services/queryKeys';
import { featuredGroupQuery, leaguePredictionsQuery, myGroupsQuery } from '../services/queries';
import { useAppStore } from '../store/useAppStore';
import type { Group, LeagueCompetition, MatchRadar } from '../types/api';
import { forgetLeague, pickMostRecentLeague } from './leagueFallback';
import { MATCH_KINDS, leagueKindOf, type LeagueKind } from './leagueKind';
import { isKnockoutOnlyCup } from '../utils/knockoutDrawPending';
import { isNbaRegularSeason } from '../utils/nbaPlayoffs';

/** Competiciones en las que se predice el ganador, sin empate: la NFL, la NBA y el LoL. */
const isWinnerOnlyCompetition = (externalId: string | null | undefined): boolean =>
  externalId === 'nfl' ||
  externalId === 'nba' ||
  isNbaRegularSeason(externalId) ||
  Boolean(externalId?.startsWith('lol.'));

// Valores vacíos compartidos (referencia estable). Se tipan como mutables para que
// se unan sin fricción con el tipo de cada consulta.
const EMPTY_OBJECT = Object.freeze({}) as Record<string, never>;
const EMPTY_ARRAY = Object.freeze([]) as never[];
const EMPTY_COMPETITIONS: LeagueCompetition[] = [];
const EMPTY_RADAR = Object.freeze({ live: [], last: [], next: [] }) as MatchRadar;
const NO_GROUP_NAME = 'Ninguna liga seleccionada';

// Copia de «todos los partidos» de cuando la app pedía partidos sin liga: mezclaba deportes y
// competiciones y podía tener partidos ya jugados como pendientes. Ya no se pide; se borra. Las
// copias del Mundial con nombre genérico se guardan ahora con el suyo.
try {
  localStorage.removeItem('cached_matches_all');
  localStorage.removeItem('cached_official_standings');
  localStorage.removeItem('cached_official_odds');
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
  const { activeGroupId, isAuthenticated, choosingLeague } = useAppStore(
    useShallow((s) => ({
      activeGroupId: s.activeGroupId,
      isAuthenticated: s.isAuthenticated,
      choosingLeague: s.choosingLeague,
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
          tennisScope: fromList.tennisScope,
          tennisTour: fromList.tennisTour,
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

  // Sin liga no hay competición ni formato: nada se rellena con los de la liga anterior.
  const activeCompetitionId = activeGroupId ? (groupInfo?.competitionId ?? null) : null;
  const activeGroupPoolFormat = (activeGroupId && groupInfo?.poolFormat) || null;
  const loadingGroup = Boolean(activeGroupId && groupPending);
  const visibleGroupError =
    groupInfo && (!isApiError(groupError) || groupError.status === 0 || groupError.status >= 500)
      ? null
      : groupError;
  const leagueKind: LeagueKind = leagueKindOf({
    hasLeague: Boolean(activeGroupId),
    loading: loadingGroup || choosingLeague,
    error: Boolean(visibleGroupError),
    league: groupInfo,
  });

  return {
    groupInfo,
    /** Hay liga activa y ya se sabe a qué competición pertenece. */
    competitionReady: Boolean(activeGroupId) && activeCompetitionId != null,
    /** Clase de la liga activa: decide qué enseña cada pantalla (ver `leagueKind.ts`). */
    leagueKind,
    loadingGroup,
    groupError: visibleGroupError,
    activeGroupName: groupInfo?.name || NO_GROUP_NAME,
    activeGroupAdmin: groupInfo?.adminParticipantName || null,
    activeGroupAdminId: groupInfo?.adminUserId || null,
    activeGroupPoolFormat,
    activeGroupCustomCompetition: Boolean(groupInfo?.customCompetition),
    // NFL, NBA y LoL: se predice quién gana, sin empate, así que los votos van en dos columnas.
    activeGroupWinnerOnly:
      isWinnerOnlyCompetition(groupInfo?.competitionExternalId) && !groupInfo?.multiCompetition,
    // Copa por eliminatorias (Copa del Rey…): el servidor no devuelve tabla. Los playoffs de la NBA
    // sí tienen la de la temporada regular.
    activeCompetitionKnockoutCup:
      groupInfo?.formatType === 'TOURNAMENT' &&
      groupInfo?.competitionExternalId !== 'nba' &&
      (Boolean(groupInfo?.knockoutDraw) || isKnockoutOnlyCup(groupInfo?.competitionExternalId)),
    // Liga por jornadas que elige sus partidos (de una o de varias competiciones).
    activeGroupPicksMatches: groupInfo?.matchSelection === 'CUSTOM',
    activeGroupMultiCompetition: Boolean(groupInfo?.multiCompetition),
    // Las competiciones de una liga que junta varias, para elegir cuál se ve en la Tabla.
    activeGroupCompetitions:
      (groupInfo?.multiCompetition && groupInfo.competitions) || EMPTY_COMPETITIONS,
    // El pichichi se juega con los goleadores oficiales del Mundial: solo en sus cuadros.
    activeGroupPichichi: leagueKind === 'worldCup' && Boolean(groupInfo?.pichichi),
    activeGroupIsLocked: Boolean(groupInfo?.isLocked),
    activeGroupLockDate: groupInfo?.lockDate || null,
    activeGroupRules: groupInfo?.rules || '',
    activeCompetitionId,
    // Una liga de varias competiciones no es la porra de una sola (la imagen para compartir lo dice).
    activeCompetitionName: groupInfo?.multiCompetition ? null : groupInfo?.competitionName || null,
    activeCompetitionExternalId: groupInfo?.competitionExternalId || null,
    userGroups: Array.isArray(userGroups) ? userGroups : EMPTY_ARRAY,
    userGroupsLoaded: !isAuthenticated || (userGroupsFetched && !userGroupsError),
  };
}

/** La liga activa: sus datos, su competición y la lista de ligas del usuario. */
export function useActiveLeague() {
  const { groupInfo, competitionReady, ...league } = useLeagueState();
  return league;
}

/** Datos oficiales de la competición activa: partidos y radar. */
export function useOfficialData() {
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const {
    competitionReady,
    loadingGroup,
    activeCompetitionId,
    activeGroupCustomCompetition: isCustomCompetition,
  } = useLeagueState();

  const { data: radar } = useQuery({
    queryKey: queryKeys.radar(activeCompetitionId),
    queryFn: () => (isCustomCompetition ? EMPTY_RADAR : fetchMatchRadar(activeCompetitionId!)),
    enabled: competitionReady && !isCustomCompetition,
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
      const data = await fetchMatches(activeCompetitionId!);
      localCopy.write(matchesCacheKey, data || []);
      return data || [];
    },
    placeholderData: () => {
      if (isCustomCompetition || !competitionReady) return undefined;
      const cached = localCopy.read(matchesCacheKey);
      return Array.isArray(cached) && cached.length > 0 ? cached : undefined;
    },
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
    matchRadar: competitionReady && isObject(radar) ? radar : EMPTY_RADAR,
    allGames: competitionReady && Array.isArray(matches) ? matches : EMPTY_ARRAY,
    nameToIdMap,
    loading: loadingGroup || (loadingMatches && !matches),
  };
}

/**
 * Datos oficiales del torneo con fase de grupos de la liga activa: clasificación de grupos, cuotas
 * por grupo y goleadores. Solo se piden en una liga de esa clase (`worldCup`); en cualquier otra
 * quedan vacíos.
 */
export function useTournamentData() {
  const { leagueKind, activeCompetitionId, activeGroupPichichi: pichichi } = useLeagueState();
  const tournamentId = leagueKind === 'worldCup' ? activeCompetitionId : null;
  const worldCup = tournamentId != null;

  const { data: standings, isLoading: loadingStandings } = useQuery({
    queryKey: queryKeys.tournamentStandings(tournamentId),
    enabled: worldCup,
    queryFn: async () => {
      const data = await fetchTournamentStandings(tournamentId as number);
      localCopy.write(`cached_tournament_standings_${tournamentId}`, data);
      return data;
    },
    placeholderData: (previous) =>
      localCopy.objectOr(`cached_tournament_standings_${tournamentId}`, previous),
  });

  const { data: odds } = useQuery({
    queryKey: queryKeys.tournamentGroupOdds(tournamentId),
    enabled: worldCup,
    queryFn: async () => {
      const data = await fetchTournamentGroupOdds(tournamentId as number);
      localCopy.write(`cached_tournament_group_odds_${tournamentId}`, data);
      return data;
    },
    placeholderData: (previous) =>
      localCopy.objectOr(`cached_tournament_group_odds_${tournamentId}`, previous),
  });

  const {
    data: topScorers,
    isLoading: topScorersLoading,
    isError: topScorersError,
    refetch: refreshTopScorers,
  } = useQuery({
    queryKey: queryKeys.tournamentTopScorers(tournamentId),
    queryFn: () => fetchTournamentTopScorers(tournamentId as number),
    enabled: pichichi && worldCup,
    staleTime: 300_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  return {
    /** Competición del torneo con grupos de la liga activa, o `null` si la liga no es de esa clase. */
    tournamentId,
    /** Puntos de cada selección por grupo: grupo → equipo → estadística. */
    groupStandings: worldCup && isObject(standings) ? standings : EMPTY_OBJECT,
    /** Selecciones de cada grupo con sus cuotas, para ordenar el cuadro antes del torneo. */
    groupOdds: worldCup && isObject(odds) ? odds : EMPTY_OBJECT,
    loading: worldCup && loadingStandings && !standings,
    /** La liga juega el pichichi (y se piden los goleadores). */
    pichichi,
    topScorers: pichichi && Array.isArray(topScorers) ? topScorers : EMPTY_ARRAY,
    topScorersLoading: pichichi && topScorersLoading,
    topScorersError: pichichi && topScorersError,
    refreshTopScorers,
  };
}

/** Ranking de la liga activa y pronósticos ya descargados. */
export function useLeagueRanking() {
  const queryClient = useQueryClient();
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const { leagueKind } = useLeagueState();
  const isMatchdayPool = MATCH_KINDS[leagueKind];

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
