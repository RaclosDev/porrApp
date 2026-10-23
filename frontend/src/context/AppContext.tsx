import React, { useEffect, createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStandings,
  fetchMatches,
  fetchMatchRadar,
  fetchPredictions,
  fetchTeamOdds,
  fetchLeaderboard,
  fetchGroup,
  fetchPresence,
  fetchTopScorers,
  fetchMe,
  fetchMyGroups,
} from '../services/api';
import { useAdminActions } from '../hooks/useAdminActions';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../store/useAppStore';

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
  const setActiveGroupId = useAppStore((state) => state.setActiveGroupId);

  const adminActions = useAdminActions();

  useWebSocket(userName, queryClient);

  useEffect(() => {
    localStorage.setItem(`draft_bracket_${activeGroupId}`, JSON.stringify(bracketState));
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
    const autoSelectGroup = async () => {
      if (!userName) return;
      try {
        let dbGroupId = null;
        if (isUserAuthed) {
          try {
            const me = await fetchMe();
            dbGroupId = me.lastSelectedGroupId?.toString();
          } catch {
            /* ignore */
          }
        }

        const myGroups = await fetchMyGroups();
        if (myGroups.length === 1) {
          const onlyGroupId = myGroups[0].id.toString();
          if (localStorage.getItem('activeGroupId') !== onlyGroupId) {
            changeGroup(onlyGroupId);
          }
        } else if (dbGroupId) {
          const currentLocal = localStorage.getItem('activeGroupId');
          if (currentLocal !== dbGroupId) changeGroup(dbGroupId);
          else if (activeGroupId !== dbGroupId) setActiveGroupId(dbGroupId);
        }
      } catch {
        /* ignore */
      }
    };
    autoSelectGroup();
  }, [userName, isUserAuthed, activeGroupId, changeGroup, setActiveGroupId]);

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

  const { data: standings } = useQuery({ queryKey: ['standings'], queryFn: fetchStandings });
  const { data: radar } = useQuery({ queryKey: ['radar'], queryFn: fetchMatchRadar });
  const { data: predictions } = useQuery({
    queryKey: ['predictions', activeGroupId],
    queryFn: () => fetchPredictions(activeGroupId),
  });
  const { data: odds } = useQuery({ queryKey: ['odds'], queryFn: fetchTeamOdds });
  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () => fetchLeaderboard(activeGroupId),
  });
  const { data: groupInfo } = useQuery({
    queryKey: ['group', activeGroupId],
    queryFn: () =>
      activeGroupId
        ? fetchGroup(activeGroupId).catch(() => ({ name: 'Porra Global' }))
        : Promise.resolve({ name: 'Ninguna Liga Seleccionada' }),
  });
  const activeCompetitionId = groupInfo?.competitionId || null;
  const { data: matches } = useQuery({
    queryKey: ['matches', activeCompetitionId],
    queryFn: async () => {
      const data = await fetchMatches(activeCompetitionId);
      if (!data || data.length === 0) {
        return fetchMatches(null);
      }
      return data;
    },
  });
  const activeGroupPichichi =
    groupInfo?.pichichi !== undefined ? Boolean(groupInfo.pichichi) : false;
  const { data: onlineUsers } = useQuery({ queryKey: ['presence'], queryFn: fetchPresence });
  const { data: topScorers } = useQuery({
    queryKey: ['topScorers'],
    queryFn: fetchTopScorers,
    enabled: activeGroupPichichi,
    staleTime: 300_000,
  });

  const activeGroupName = groupInfo?.name || 'Ninguna Liga Seleccionada';
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupBetMode = groupInfo?.betMode || 'FULL_BRACKET';
  const activeGroupIsLocked = Boolean(groupInfo?.isLocked);
  const activeGroupLockDate = groupInfo?.lockDate || null;

  const nameToIdMap =
    matches?.reduce((acc, m) => {
      acc[m.home] = m.home_team_id;
      acc[m.away] = m.away_team_id;
      return acc;
    }, {}) || {};

  const loading = !standings || !matches || !predictions;

  const checkAdmin = (str) => {
    if (!str) return false;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash === 576654803 || hash === -1061661165;
  };

  const isRaclos = checkAdmin(userName?.trim());

  return {
    ...store,
    isAuthenticated: isUserAuthed,
    officialPoints: standings || {},
    matchRadar: radar || { live: [], last: [], next: [] },
    participantsHashes: predictions || [],
    allGames: matches || [],
    groupOdds: odds || {},
    nameToIdMap,
    leaderboardData: leaderboard || [],
    loading,
    fetchData: adminActions.refreshAll,
    onlineUsers: onlineUsers || [],
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
    topScorers: topScorers || [],
  };
};
