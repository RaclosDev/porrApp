import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { normalizeCountryName } from '../utils/constants';
import {
  getAuthToken,
  fetchStandings,
  fetchMatches,
  fetchMatchRadar,
  fetchPredictions,
  fetchTeamOdds,
  fetchLeaderboard,
  fetchGroup,
  fetchTopScorers,
  fetchMe,
  fetchMyGroups,
  updateUserPreferences,
} from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore, defaultBracketState } from '../store/useAppStore';

const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_RADAR = Object.freeze({ live: [], last: [], next: [] });

const loadCachedJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(normalizeCountryName(raw));
  } catch {
    return undefined;
  }
};

const saveCachedJson = (key, data) => {
  if (!data) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

export function AppProvider({ children }) {
  const queryClient = useQueryClient();

  const userName = useAppStore((state) => state.userName);
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const bracketState = useAppStore((state) => state.bracketState);

  const setUserName = useAppStore((state) => state.setUserName);
  const setUserId = useAppStore((state) => state.setUserId);
  const changeGroup = useAppStore((state) => state.changeGroup);
  const setIsAuthenticated = useAppStore((state) => state.setIsAuthenticated);
  const isUserAuthed = useAppStore((state) => state.isAuthenticated);

  useWebSocket(userName, queryClient);

  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setUserName('');
      setUserId('');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [setIsAuthenticated, setUserName, setUserId]);

  useEffect(() => {
    if (!activeGroupId) return;
    // Evitar sobreescribir un draft guardado si bracketState coincide con defaultBracketState vacío
    if (bracketState === defaultBracketState) {
      try {
        const existing = localStorage.getItem(`draft_bracket_${activeGroupId}`);
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed?.r32 && !parsed.r32.left[0]?.home?.name?.includes('º')) {
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`draft_bracket_${activeGroupId}`, JSON.stringify(bracketState));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [bracketState, activeGroupId]);

  useEffect(() => {
    if (!isUserAuthed) {
      setTimeout(() => {
        setUserName('');
        setUserId('');
      }, 0);
      localStorage.removeItem('my_prediction_name');
      localStorage.removeItem('my_bet_name');
      localStorage.removeItem('my_user_id');
    }
  }, [isUserAuthed, setUserName, setUserId]);

  useEffect(() => {
    let isCancelled = false;
    const autoSelectGroup = async () => {
      if (!userName || !isUserAuthed) return;
      try {
        let dbGroupId = null;
        try {
          const me = await fetchMe();
          dbGroupId = me.lastSelectedGroupId?.toString();
        } catch {
          /* ignore */
        }

        const myGroups = await fetchMyGroups();
        if (isCancelled) return;

        if (!myGroups || myGroups.length === 0) {
          localStorage.removeItem('activeGroupId');
          changeGroup('');
        } else {
          const currentLocal = localStorage.getItem('activeGroupId');
          const belongsToCurrent = myGroups.some((g) => g.id.toString() === currentLocal);

          if (belongsToCurrent && currentLocal) {
            // El usuario ya tiene una liga válida seleccionada en este navegador (respetar en F5)
            const currentBracket = useAppStore.getState().bracketState;
            if (currentBracket === defaultBracketState) {
              const savedDraft = localStorage.getItem(`draft_bracket_${currentLocal}`);
              if (savedDraft) {
                try {
                  const parsed = JSON.parse(savedDraft);
                  if (parsed && parsed.r32) {
                    useAppStore.getState().setBracketState(parsed);
                  }
                } catch {
                  /* ignore */
                }
              }
            }
            // Si difiere de la preferencia en BD, sincronizamos la BD sin cambiar la selección local
            if (dbGroupId !== currentLocal) {
              updateUserPreferences({ lastSelectedGroupId: Number(currentLocal) }).catch(() => {});
            }
          } else if (dbGroupId && myGroups.some((g) => g.id.toString() === dbGroupId)) {
            // No hay selección local válida en este navegador, usar la preferencia de BD
            changeGroup(dbGroupId);
          } else {
            // Sin preferencia local ni en BD: usar la liga más reciente
            const mostRecent = [...myGroups].sort(
              (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
            )[0];
            changeGroup(mostRecent.id.toString());
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
  }, [userName, isUserAuthed, changeGroup]);

  return children;
}

export const useAppContext = () => {
  const store = useAppStore();
  const queryClient = useQueryClient();
  const isUserAuthed = store.isAuthenticated;

  const activeGroupId = store.activeGroupId;
  const storeCompetitionId = store.activeCompetitionId;
  const setActiveCompetitionId = store.setActiveCompetitionId;
  const changeGroup = store.changeGroup;

  const {
    data: userGroups,
    isFetched: userGroupsFetched,
    isError: userGroupsError,
  } = useQuery({
    queryKey: ['myGroups', isUserAuthed],
    queryFn: () => (isUserAuthed ? fetchMyGroups() : Promise.resolve([])),
    staleTime: 60_000,
  });

  const {
    data: groupInfo,
    isPending: groupPending,
    error: groupError,
  } = useQuery({
    queryKey: ['group', activeGroupId],
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
          betMode: fromList.poolFormat || fromList.betMode,
          poolFormat: fromList.poolFormat,
          pichichi: fromList.pichichi,
          isLocked: fromList.isLocked,
          lockDate: fromList.lockDate,
          adminParticipantName: fromList.adminParticipantName,
          adminUserId: fromList.adminUserId,
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
    queryKey: ['standings'],
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
    queryKey: ['radar', activeCompetitionId],
    queryFn: () => fetchMatchRadar(activeCompetitionId),
    enabled: competitionReady,
  });

  const { data: predictions, error: predictionsError } = useQuery({
    queryKey: ['predictions', activeGroupId],
    queryFn: () => fetchPredictions(activeGroupId),
    enabled: Boolean(activeGroupId),
    retry: 1,
  });

  useEffect(() => {
    if (predictionsError && activeGroupId && String(activeGroupId) !== '1') {
      const msg = predictionsError.message || '';
      if (msg.includes('403') || msg.includes('No perteneces')) {
        console.warn('Acceso denegado a la liga privada, regresando a la liga global');
        changeGroup('1');
      }
    }
  }, [predictionsError, activeGroupId, changeGroup]);

  const { data: odds } = useQuery({
    queryKey: ['odds'],
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

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () => fetchLeaderboard(activeGroupId),
    enabled: Boolean(activeGroupId),
  });

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['matches', activeCompetitionId],
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
  const { data: topScorers } = useQuery({
    queryKey: ['topScorers'],
    queryFn: fetchTopScorers,
    enabled: activeGroupPichichi,
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });

  const activeGroupName = groupInfo?.name || 'Ninguna Liga Seleccionada';
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupBetMode =
    groupInfo?.poolFormat || groupInfo?.betMode || (activeGroupId ? null : 'FULL_BRACKET');
  const activeGroupIsLocked = Boolean(groupInfo?.isLocked);
  const activeGroupLockDate = groupInfo?.lockDate || null;

  const nameToIdMap = useMemo(() => {
    if (!Array.isArray(matches)) {
      return EMPTY_OBJECT;
    }
    return (
      matches.reduce((acc, m) => {
        if (m?.home && m?.home_team_id != null) acc[m.home] = m.home_team_id;
        if (m?.away && m?.away_team_id != null) acc[m.away] = m.away_team_id;
        return acc;
      }, {}) || EMPTY_OBJECT
    );
  }, [matches]);

  const loading = loadingGroup || (loadingStandings && !standings) || (loadingMatches && !matches);

  const isRaclos = useMemo(() => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      if (
        payload.email &&
        ['raclosdev@gmail.com', 'raclosnegocios@gmail.com'].includes(payload.email.toLowerCase())
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [store.isAuthenticated]);

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
    loading,
    loadingGroup,
    groupError,
    fetchData: () => queryClient.invalidateQueries(),
    onlineUsers: EMPTY_ARRAY,
    isRaclos,
    activeGroupName,
    activeGroupAdmin,
    activeGroupAdminId,
    activeGroupPoolFormat: activeGroupBetMode,
    activeGroupBetMode,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    activeCompetitionId,
    activeCompetitionName: groupInfo?.competitionName || null,
    activeCompetitionFormatType:
      groupInfo?.formatType ||
      (activeGroupBetMode ? (activeGroupBetMode === 'MATCH_DAY' ? 'LEAGUE' : 'TOURNAMENT') : null),
    userGroups: Array.isArray(userGroups) ? userGroups : EMPTY_ARRAY,
    userGroupsLoaded: !isUserAuthed || (userGroupsFetched && !userGroupsError),
    topScorers: Array.isArray(topScorers) ? topScorers : EMPTY_ARRAY,
  };
};
