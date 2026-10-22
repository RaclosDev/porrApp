import React, { useEffect, createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStandings,
  fetchMatches,
  fetchMatchRadar,
  fetchBets,
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
  const isAdminAuthenticated = useAppStore((state) => state.isAdminAuthenticated);

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
    if (!isAdminAuthenticated) {
      setTimeout(() => {
        setUserName('');
        setUserId('');
      }, 0);
      localStorage.removeItem('my_bet_name');
      localStorage.removeItem('my_user_id');
    }
  }, [isAdminAuthenticated, setUserName, setUserId]);

  useEffect(() => {
    const autoSelectGroup = async () => {
      if (!userName) return;
      try {
        let dbGroupId = null;
        if (isAdminAuthenticated) {
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
  }, [userName, isAdminAuthenticated, activeGroupId, changeGroup, setActiveGroupId]);

  return (
    <GlobalEffectsContext.Provider value={adminActions}>{children}</GlobalEffectsContext.Provider>
  );
}

export const useAppContext = () => {
  const store = useAppStore();
  const adminActions = useContext(GlobalEffectsContext) || useAdminActions();

  const activeGroupId = store.activeGroupId;
  const userName = store.userName;

  const { data: standings } = useQuery({ queryKey: ['standings'], queryFn: fetchStandings });
  const { data: radar } = useQuery({ queryKey: ['radar'], queryFn: fetchMatchRadar });
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
  const { data: bets } = useQuery({
    queryKey: ['bets', activeGroupId],
    queryFn: () => fetchBets(activeGroupId),
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
  const { data: onlineUsers } = useQuery({ queryKey: ['presence'], queryFn: fetchPresence });
  const { data: topScorers } = useQuery({
    queryKey: ['topScorers'],
    queryFn: fetchTopScorers,
    staleTime: 300_000,
  });

  const activeGroupName = groupInfo?.name || 'Ninguna Liga Seleccionada';
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupBetMode = groupInfo?.betMode || 'FULL_BRACKET';
  const activeGroupPichichi = groupInfo?.pichichi !== undefined ? groupInfo.pichichi : true;

  const nameToIdMap =
    matches?.reduce((acc, m) => {
      acc[m.home] = m.home_team_id;
      acc[m.away] = m.away_team_id;
      return acc;
    }, {}) || {};

  const loading = !standings || !matches || !bets;

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
    officialPoints: standings || {},
    matchRadar: radar || { live: [], last: [], next: [] },
    participantsHashes: bets || [],
    allGames: matches || [],
    groupOdds: odds || {},
    nameToIdMap,
    leaderboardData: leaderboard || [],
    loading,
    fetchData: adminActions.refreshAll,
    onlineUsers: onlineUsers || [],
    isRaclos,
    deleteBet: adminActions.deleteBet,
    fixThird: adminActions.fixThird,
    acceptBet: adminActions.acceptBet,
    editBetName: adminActions.editBetName,
    activeGroupName,
    activeGroupAdmin,
    activeGroupAdminId,
    activeGroupBetMode,
    activeGroupPichichi,
    topScorers: topScorers || [],
  };
};
