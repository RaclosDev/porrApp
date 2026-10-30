import { useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { normalizeCountryName, isGlobalLeagueId } from '../utils/constants';
import {
  fetchStandings,
  fetchMatches,
  fetchMatchRadar,
  fetchTeamOdds,
  fetchLeaderboard,
  fetchLeaderboardMatchdays,
  fetchGroup,
  fetchTopScorers,
  fetchMe,
  fetchMyGroups,
  updateUserPreferences,
  whenSessionRestored,
} from '../services/api';
import { isApiError } from '../services/apiError';
import { queryKeys } from '../services/queryKeys';
import { leaguePredictionsQuery, myGroupsQuery } from '../services/queries';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  useAppStore,
  defaultBracketState,
  getInitialBracketState,
  readGroupVisits,
  type BracketState,
} from '../store/useAppStore';
import { readJsonDraft, writeDraft } from '../utils/drafts';
import type { Group, MatchRadar } from '../types/api';

// Valores vacíos compartidos (referencia estable). Se tipan como mutables para que
// se unan sin fricción con el tipo de cada consulta.
const EMPTY_OBJECT = Object.freeze({}) as Record<string, never>;
const EMPTY_ARRAY = Object.freeze([]) as never[];
const EMPTY_RADAR = Object.freeze({ live: [], last: [], next: [] }) as MatchRadar;

const loadCachedJson = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(normalizeCountryName(raw));
  } catch {
    return undefined;
  }
};

const saveCachedJson = (key: string, data: unknown) => {
  if (!data) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const userName = useAppStore((state) => state.userName);
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const bracketState = useAppStore((state) => state.bracketState);
  const userId = useAppStore((state) => state.userId);
  const isDemoMode = useAppStore((state) => state.isDemoMode);

  const setUserName = useAppStore((state) => state.setUserName);
  const setUserAvatarUrl = useAppStore((state) => state.setUserAvatarUrl);
  const changeGroup = useAppStore((state) => state.changeGroup);
  const logout = useAppStore((state) => state.logout);
  const setIsAuthenticated = useAppStore((state) => state.setIsAuthenticated);
  const isUserAuthed = useAppStore((state) => state.isAuthenticated);

  useWebSocket(userName, queryClient);

  // api.ts avisa con este evento cuando no ha podido renovar la sesión tras un 401.
  useEffect(() => {
    window.addEventListener('auth-expired', logout);
    return () => window.removeEventListener('auth-expired', logout);
  }, [logout]);

  // El store arranca dando la sesión por buena; si al recuperarla el servidor dice que no hay,
  // se cierra. Sin respuesta del servidor se deja como está y se reintentará en el próximo 401.
  useEffect(() => {
    let active = true;
    whenSessionRestored()?.then((result) => {
      if (!active) return;
      if (result === 'restored') setIsAuthenticated(true);
      else if (result === 'none' && useAppStore.getState().isAuthenticated) logout();
    });
    return () => {
      active = false;
    };
  }, [logout, setIsAuthenticated]);

  useEffect(() => {
    // La demo pública es de solo lectura: no persistir borradores locales.
    if (isDemoMode || !activeGroupId) return;
    // Evitar sobreescribir un draft guardado si bracketState coincide con defaultBracketState vacío
    if (bracketState === defaultBracketState) {
      const existing = readJsonDraft('bracket', activeGroupId, userId) as
        Partial<BracketState> | undefined;
      if (existing?.r32 && !existing.r32.left[0]?.home?.name?.includes('º')) return;
    }
    const timer = setTimeout(() => {
      writeDraft('bracket', activeGroupId, userId, bracketState);
    }, 300);
    return () => clearTimeout(timer);
  }, [bracketState, activeGroupId, userId, isDemoMode]);

  useEffect(() => {
    let isCancelled = false;
    const autoSelectGroup = async () => {
      if (isDemoMode || !userName || !isUserAuthed) return;
      try {
        let dbGroupId = null;
        try {
          const me = await fetchMe();
          dbGroupId = me.lastSelectedGroupId?.toString();
          setUserAvatarUrl(me.avatarUrl || '');
          if (me.participantName && me.participantName !== userName)
            setUserName(me.participantName);
        } catch {
          /* ignore */
        }

        const myGroups = await fetchMyGroups();
        if (isCancelled) return;

        if (!myGroups || myGroups.length === 0) {
          localStorage.removeItem('activeGroupId');
          changeGroup('');
        } else {
          // La fuente de verdad es el store (no localStorage): handleGoogleSuccess
          // puede haber escrito la preferencia del servidor sin actualizar el estado.
          const currentStoreGroup = useAppStore.getState().activeGroupId;
          const belongsToCurrent =
            currentStoreGroup && myGroups.some((g) => g.id.toString() === currentStoreGroup);

          if (belongsToCurrent) {
            // El usuario ya tiene una liga válida seleccionada en esta sesión (respetar en F5)
            const currentBracket = useAppStore.getState().bracketState;
            if (currentBracket === defaultBracketState) {
              const saved = getInitialBracketState(
                currentStoreGroup,
                useAppStore.getState().userId,
              );
              if (saved !== defaultBracketState) useAppStore.getState().setBracketState(saved);
            }
            // Si difiere de la preferencia en BD, sincronizamos la BD sin cambiar la selección local
            if (dbGroupId !== currentStoreGroup) {
              updateUserPreferences({ lastSelectedGroupId: Number(currentStoreGroup) }).catch(
                () => {},
              );
            }
          } else if (dbGroupId && myGroups.some((g) => g.id.toString() === dbGroupId)) {
            // No hay selección local válida en esta sesión, usar la preferencia de BD
            changeGroup(dbGroupId);
          } else {
            // Sin preferencia en BD: la última liga visitada en este dispositivo y,
            // si no hay historial, la más reciente por fecha de creación.
            const visits = readGroupVisits();
            const lastVisitedId = Object.entries(visits)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([id]) => id)
              .find((id) => myGroups.some((g) => g.id.toString() === id));

            if (lastVisitedId) {
              changeGroup(lastVisitedId);
            } else {
              const mostRecent = [...myGroups].sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
              )[0];
              changeGroup(mostRecent.id.toString());
            }
          }
        }
      } catch {
        /* ignore */
      }
    };
    autoSelectGroup();
    return () => {
      isCancelled = true;
    };
  }, [userName, isUserAuthed, changeGroup, isDemoMode, setUserAvatarUrl, setUserName]);

  return children;
}

export const useAppContext = () => {
  const store = useAppStore();
  const queryClient = useQueryClient();
  const isUserAuthed = store.isAuthenticated;

  const activeGroupId = store.activeGroupId;
  const storeCompetitionId = store.activeCompetitionId;
  const setActiveCompetitionId = store.setActiveCompetitionId;

  const {
    data: userGroups,
    isFetched: userGroupsFetched,
    isError: userGroupsError,
  } = useQuery(myGroupsQuery(isUserAuthed));

  const {
    data: groupInfo,
    isPending: groupPending,
    error: groupError,
  } = useQuery<Partial<Group>>({
    queryKey: queryKeys.group(activeGroupId),
    queryFn: () =>
      activeGroupId
        ? fetchGroup(activeGroupId)
        : Promise.resolve({ name: 'Ninguna Liga Seleccionada' }),
    placeholderData: () => {
      if (!activeGroupId) return { name: 'Ninguna Liga Seleccionada' };
      const fromList = Array.isArray(userGroups)
        ? userGroups.find((g) => g.id.toString() === activeGroupId.toString())
        : null;
      if (fromList) {
        return {
          id: fromList.id,
          name: fromList.name,
          competitionId: fromList.competitionId,
          competitionName: fromList.competitionName,
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

  // A persisted competition belongs to the previous selection until this league resolves.
  const activeCompetitionId = activeGroupId
    ? (groupInfo?.competitionId ?? null)
    : storeCompetitionId;
  const competitionReady = !activeGroupId || activeCompetitionId != null;
  const loadingGroup = Boolean(activeGroupId && groupPending);

  useEffect(() => {
    if (groupInfo?.competitionId != null && groupInfo.competitionId !== storeCompetitionId) {
      setActiveCompetitionId(groupInfo.competitionId);
    }
  }, [groupInfo?.competitionId, storeCompetitionId, setActiveCompetitionId]);

  const { data: standings, isLoading: loadingStandings } = useQuery({
    queryKey: queryKeys.standings(),
    queryFn: async () => {
      const data = await fetchStandings();
      saveCachedJson('cached_official_standings', data);
      return data;
    },
    placeholderData: (previousData) => {
      const cached = loadCachedJson('cached_official_standings');
      return cached && typeof cached === 'object' && typeof cached !== 'function'
        ? cached
        : previousData;
    },
  });

  const { data: radar } = useQuery({
    queryKey: queryKeys.radar(activeCompetitionId),
    queryFn: () => fetchMatchRadar(activeCompetitionId),
    enabled: competitionReady,
  });

  // Los pronósticos de toda la liga son pesados: aquí solo se leen de la caché. Los piden las
  // pantallas que los usan (useLeaguePredictions); el resto no los descarga.
  const { data: predictions, error: predictionsError } = useQuery({
    ...leaguePredictionsQuery(activeGroupId),
    enabled: false,
  });

  const { data: odds } = useQuery({
    queryKey: queryKeys.odds(),
    queryFn: async () => {
      const data = await fetchTeamOdds();
      saveCachedJson('cached_official_odds', data);
      return data;
    },
    placeholderData: (previousData) => {
      const cached = loadCachedJson('cached_official_odds');
      return cached && typeof cached === 'object' && typeof cached !== 'function'
        ? cached
        : previousData;
    },
  });

  const { data: leaderboard, error: leaderboardError } = useQuery({
    queryKey: queryKeys.leaderboard(activeGroupId),
    queryFn: () => fetchLeaderboard(activeGroupId),
    enabled: Boolean(activeGroupId),
  });

  // Un 403 en la liga activa (p. ej. tras una expulsión) refresca la lista de ligas. El ranking se
  // pide en todas las pantallas; los pronósticos, solo en las que los usan.
  const forbiddenError = [predictionsError, leaderboardError].find((error) =>
    isApiError(error, 403),
  );
  useEffect(() => {
    if (!store.isDemoMode && forbiddenError && activeGroupId && !isGlobalLeagueId(activeGroupId)) {
      // No cambiar silenciosamente a la liga global: eso hace que parezca
      // que la liga recién seleccionada se ha sustituido por el Mundial.
      console.warn('No se pudieron cargar los datos de la liga activa', {
        activeGroupId,
        message: forbiddenError.message,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
    }
  }, [forbiddenError, activeGroupId, queryClient, store.isDemoMode]);

  const isMatchdayPool =
    groupInfo?.poolFormat === 'MATCH_DAY' || groupInfo?.formatType === 'LEAGUE';

  const { data: leaderboardMatchdays } = useQuery({
    queryKey: queryKeys.leaderboardMatchdays(activeGroupId),
    queryFn: () => fetchLeaderboardMatchdays(activeGroupId),
    enabled: Boolean(activeGroupId && isMatchdayPool),
    staleTime: 60_000,
  });

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: queryKeys.matches(activeCompetitionId),
    enabled: competitionReady,
    queryFn: async () => {
      const data = await fetchMatches(activeCompetitionId);
      saveCachedJson(`cached_matches_${activeCompetitionId || 'all'}`, data || []);
      return data || [];
    },
    placeholderData: () => {
      if (!competitionReady) return undefined;
      const cached = loadCachedJson(`cached_matches_${activeCompetitionId || 'all'}`);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
      return undefined;
    },
  });
  const activeGroupPichichi =
    groupInfo?.pichichi !== undefined ? Boolean(groupInfo.pichichi) : true;
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

  const activeGroupName = groupInfo?.name || 'Ninguna Liga Seleccionada';
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupPoolFormat = groupInfo?.poolFormat || (activeGroupId ? null : 'FULL_BRACKET');
  const activeGroupIsLocked = Boolean(groupInfo?.isLocked);
  const activeGroupLockDate = groupInfo?.lockDate || null;

  const nameToIdMap = useMemo(() => {
    if (!Array.isArray(matches)) {
      return EMPTY_OBJECT;
    }
    return matches.reduce<Record<string, number>>((acc, m) => {
      if (m?.home && m?.home_team_id != null) acc[m.home] = m.home_team_id;
      if (m?.away && m?.away_team_id != null) acc[m.away] = m.away_team_id;
      return acc;
    }, {});
  }, [matches]);

  const loading = loadingGroup || (loadingStandings && !standings) || (loadingMatches && !matches);

  return {
    ...store,
    isAuthenticated: isUserAuthed,
    officialPoints:
      standings && typeof standings === 'object' && typeof standings !== 'function'
        ? standings
        : EMPTY_OBJECT,
    matchRadar:
      competitionReady && radar && typeof radar === 'object' && typeof radar !== 'function'
        ? radar
        : EMPTY_RADAR,
    participantsHashes: Array.isArray(predictions) ? predictions : EMPTY_ARRAY,
    allGames: competitionReady && Array.isArray(matches) ? matches : EMPTY_ARRAY,
    groupOdds: odds && typeof odds === 'object' && typeof odds !== 'function' ? odds : EMPTY_OBJECT,
    nameToIdMap,
    leaderboardData: Array.isArray(leaderboard) ? leaderboard : EMPTY_ARRAY,
    leaderboardMatchdays: Array.isArray(leaderboardMatchdays) ? leaderboardMatchdays : EMPTY_ARRAY,
    loading,
    loadingGroup,
    groupError,
    /** Recarga los datos de la liga activa (tras guardar, aceptar o borrar un pronóstico). */
    fetchData: () =>
      Promise.all(
        [
          queryKeys.group(activeGroupId),
          queryKeys.groupMembers(activeGroupId),
          queryKeys.predictions(activeGroupId),
          queryKeys.myPredictions(),
          queryKeys.leaderboard(activeGroupId),
          queryKeys.leaderboardMatchdays(activeGroupId),
          queryKeys.matchdayFixtures(activeGroupId),
          queryKeys.predictionScore(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    onlineUsers: EMPTY_ARRAY,
    activeGroupName,
    activeGroupAdmin,
    activeGroupAdminId,
    activeGroupPoolFormat,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    activeGroupRules: groupInfo?.rules || '',
    activeCompetitionId,
    activeCompetitionName: groupInfo?.competitionName || null,
    activeCompetitionFormatType:
      groupInfo?.formatType ||
      (activeGroupPoolFormat
        ? activeGroupPoolFormat === 'MATCH_DAY'
          ? 'LEAGUE'
          : 'TOURNAMENT'
        : null),
    userGroups: Array.isArray(userGroups) ? userGroups : EMPTY_ARRAY,
    userGroupsLoaded: !isUserAuthed || (userGroupsFetched && !userGroupsError),
    topScorers: Array.isArray(topScorers) ? topScorers : EMPTY_ARRAY,
    topScorersLoading: activeGroupPichichi && topScorersLoading,
    topScorersError: activeGroupPichichi && topScorersError,
    refreshTopScorers,
  };
};
