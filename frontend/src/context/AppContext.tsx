import React, { useEffect, createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
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
} from '../services/api';
import { useAdminActions } from '../hooks/useAdminActions';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../store/useAppStore';

const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_RADAR = Object.freeze({ live: [], last: [], next: [] });

const loadCachedJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
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

const GlobalEffectsContext = createContext(null);

export function AppProvider({ children }) {
  const queryClient = useQueryClient();

  const userName = useAppStore((state) => state.userName);
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const bracketState = useAppStore((state) => state.bracketState);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const isAdminAuthenticated = useAppStore((state) => state.isAdminAuthenticated);
  const isUserAuthed = isAuthenticated || isAdminAuthenticated;

  const setUserName = useAppStore((state) => state.setUserName);
  const setUserId = useAppStore((state) => state.setUserId);
  const changeGroup = useAppStore((state) => state.changeGroup);
  const setIsAuthenticated = useAppStore((state) => state.setIsAuthenticated);
  const setIsAdminAuthenticated = useAppStore((state) => state.setIsAdminAuthenticated);

  const adminActions = useAdminActions();

  useWebSocket(userName, queryClient);

  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setIsAdminAuthenticated(false);
      setUserName('');
      setUserId('');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [setIsAuthenticated, setIsAdminAuthenticated, setUserName, setUserId]);

  useEffect(() => {
    if (!activeGroupId) return;
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
          if (myGroups.length === 1) {
            const onlyGroupId = myGroups[0].id.toString();
            if (currentLocal !== onlyGroupId) {
              changeGroup(onlyGroupId);
            }
          } else if (dbGroupId && myGroups.some((g) => g.id.toString() === dbGroupId)) {
            if (currentLocal !== dbGroupId) {
              changeGroup(dbGroupId);
            }
          } else if (!belongsToCurrent) {
            changeGroup(myGroups[0].id.toString());
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

  return (
    <GlobalEffectsContext.Provider value={adminActions}>{children}</GlobalEffectsContext.Provider>
  );
}

export const useAppContext = () => {
  const store = useAppStore();
  const isUserAuthed = store.isAuthenticated || store.isAdminAuthenticated;
  const adminActions = useContext(GlobalEffectsContext) || useAdminActions();

  const activeGroupId = store.activeGroupId;
  const userName = store.userName;
  const storeCompetitionId = store.activeCompetitionId;
  const setActiveCompetitionId = store.setActiveCompetitionId;

  const { data: groupInfo } = useQuery({
    queryKey: ['group', activeGroupId],
    queryFn: () =>
      activeGroupId
        ? fetchGroup(activeGroupId).catch(() => ({ name: 'Porra Global' }))
        : Promise.resolve({ name: 'Ninguna Liga Seleccionada' }),
    placeholderData: keepPreviousData,
  });

  const activeCompetitionId = groupInfo?.competitionId ?? storeCompetitionId;

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
    initialData: () => loadCachedJson('cached_official_standings'),
    placeholderData: keepPreviousData,
  });

  const { data: radar } = useQuery({
    queryKey: ['radar', activeCompetitionId],
    queryFn: () => fetchMatchRadar(activeCompetitionId),
    placeholderData: keepPreviousData,
  });

  const { data: predictions } = useQuery({
    queryKey: ['predictions', activeGroupId],
    queryFn: () => fetchPredictions(activeGroupId),
    placeholderData: keepPreviousData,
  });

  const { data: odds } = useQuery({
    queryKey: ['odds'],
    queryFn: async () => {
      const data = await fetchTeamOdds();
      saveCachedJson('cached_official_odds', data);
      return data;
    },
    initialData: () => loadCachedJson('cached_official_odds'),
    placeholderData: keepPreviousData,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () => fetchLeaderboard(activeGroupId),
    placeholderData: keepPreviousData,
  });

  const { data: userGroups } = useQuery({
    queryKey: ['myGroups', isUserAuthed],
    queryFn: () => (isUserAuthed ? fetchMyGroups() : Promise.resolve([])),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['matches', activeCompetitionId],
    queryFn: async () => {
      let data = await fetchMatches(activeCompetitionId);
      if (!data || data.length === 0) {
        data = await fetchMatches(null);
      }
      saveCachedJson(`cached_matches_${activeCompetitionId || 'all'}`, data);
      return data;
    },
    initialData: () => loadCachedJson(`cached_matches_${activeCompetitionId || 'all'}`),
    placeholderData: keepPreviousData,
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
  const activeGroupBetMode = groupInfo?.betMode || 'FULL_BRACKET';
  const activeGroupIsLocked = Boolean(groupInfo?.isLocked);
  const activeGroupLockDate = groupInfo?.lockDate || null;

  const nameToIdMap = useMemo(() => {
    return (
      matches?.reduce((acc, m) => {
        acc[m.home] = m.home_team_id;
        acc[m.away] = m.away_team_id;
        return acc;
      }, {}) || EMPTY_OBJECT
    );
  }, [matches]);

  const loading = (loadingStandings && !standings) || (loadingMatches && !matches);

  const checkAdmin = (str) => {
    if (!str) return false;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash === 576654803 || hash === -1061661165;
  };

  const isRaclos = useMemo(() => checkAdmin(userName?.trim()), [userName]);

  return {
    ...store,
    isAuthenticated: isUserAuthed,
    officialPoints: standings || EMPTY_OBJECT,
    matchRadar: radar || EMPTY_RADAR,
    participantsHashes: predictions || EMPTY_ARRAY,
    allGames: matches || EMPTY_ARRAY,
    groupOdds: odds || EMPTY_OBJECT,
    nameToIdMap,
    leaderboardData: leaderboard || EMPTY_ARRAY,
    loading,
    fetchData: adminActions.refreshAll,
    onlineUsers: EMPTY_ARRAY,
    isRaclos,
    deletePrediction: adminActions.deletePrediction || adminActions.deleteBet,
    deleteBet: adminActions.deletePrediction || adminActions.deleteBet,
    fixThird: adminActions.fixThird,
    acceptPrediction: adminActions.acceptPrediction || adminActions.acceptBet,
    acceptBet: adminActions.acceptPrediction || adminActions.acceptBet,
    editPredictionName: adminActions.editPredictionName || adminActions.editBetName,
    editBetName: adminActions.editPredictionName || adminActions.editBetName,
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
      groupInfo?.formatType || (activeGroupBetMode === 'MATCH_DAY' ? 'LEAGUE' : 'TOURNAMENT'),
    userGroups: userGroups || EMPTY_ARRAY,
    topScorers: topScorers || EMPTY_ARRAY,
  };
};
