import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStandings, fetchMatches, fetchMatchRadar, fetchBets, fetchTeamOdds, fetchPresence, getAdminToken, fetchLeaderboard, fetchGroup, fetchMyGroups, fetchMe, updateUserPreferences, fetchTopScorers } from '../services/api';
import { useAdminActions } from '../hooks/useAdminActions';
import { useWebSocket } from '../hooks/useWebSocket';

const AppContext = createContext();

const defaultBracketState = {
  r32: {
    left: [
      { home: { name: "1º Grupo E" }, away: { name: "3º A/B/C/D/F" },  id: 'L1' },
      { home: { name: "1º Grupo I" }, away: { name: "3º C/D/F/G/H" },  id: 'L2' },
      { home: { name: "1º Grupo F" }, away: { name: "2º Grupo C" },    id: 'L4' },
      { home: { name: "1º Grupo C" }, away: { name: "2º Grupo F" },    id: 'R1' },
      { home: { name: "2º Grupo A" }, away: { name: "2º Grupo B" },    id: 'L3' },
      { home: { name: "2º Grupo E" }, away: { name: "2º Grupo I" },    id: 'R2' },
      { home: { name: "1º Grupo A" }, away: { name: "3º C/E/F/H/I" },  id: 'R3' },
      { home: { name: "1º Grupo L" }, away: { name: "3º E/H/I/J/K" },  id: 'R4' },
    ],
    right: [
      { home: { name: "2º Grupo K" }, away: { name: "2º Grupo L" },      id: 'L5' },
      { home: { name: "1º Grupo H" }, away: { name: "2º Grupo J" },      id: 'L6' },
      { home: { name: "1º Grupo D" }, away: { name: "3º B/E/F/I/J" },    id: 'L7' },
      { home: { name: "1º Grupo G" }, away: { name: "3º A/E/H/I/J" },    id: 'L8' },
      { home: { name: "1º Grupo J" }, away: { name: "2º Grupo H" },      id: 'R5' },
      { home: { name: "2º Grupo D" }, away: { name: "2º Grupo G" },      id: 'R6' },
      { home: { name: "1º Grupo B" }, away: { name: "3º E/F/G/I/J" },    id: 'R7' },
      { home: { name: "1º Grupo K" }, away: { name: "3º D/E/I/J/L" },    id: 'R8' },
    ]
  },
  r16: { left: Array(4).fill(null).map((_, i) => ({ home: null, away: null, id: `L8_${i}` })), right: Array(4).fill(null).map((_, i) => ({ home: null, away: null, id: `R8_${i}` })) },
  qf: { left: Array(2).fill(null).map((_, i) => ({ home: null, away: null, id: `L4_${i}` })), right: Array(2).fill(null).map((_, i) => ({ home: null, away: null, id: `R4_${i}` })) },
  sf: { left: [{ home: null, away: null, id: 'L2_0' }], right: [{ home: null, away: null, id: 'R2_0' }] },
  final: null,
  champion: null,
  thirdPlaceMatch: null,
  thirdPlaceWinner: null
};

export function AppProvider({ children }) {
  const queryClient = useQueryClient();

  const [userName, setUserName] = useState(localStorage.getItem('my_bet_name') || '');
  const [userId, setUserId] = useState(localStorage.getItem('my_user_id') || '');
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem('activeGroupId') || '1');
  const [bracketState, setBracketState] = useState(() => {
    const saved = localStorage.getItem(`draft_bracket_${activeGroupId}`);
    return saved ? JSON.parse(saved) : defaultBracketState;
  });
  const [topScorer, setTopScorer] = useState('');
  const [viewerBetId, setViewerBetId] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!getAdminToken());

  // Custom Hooks
  useWebSocket(userName, queryClient);
  const { deleteBet, fixThird, acceptBet, editBetName, refreshAll } = useAdminActions();

  // React Query
  const { data: standings } = useQuery({ queryKey: ['standings'], queryFn: fetchStandings });
  const { data: radar } = useQuery({ queryKey: ['radar'], queryFn: fetchMatchRadar });
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
  const { data: bets } = useQuery({ queryKey: ['bets', activeGroupId], queryFn: () => fetchBets(activeGroupId) });
  const { data: odds } = useQuery({ queryKey: ['odds'], queryFn: fetchTeamOdds });
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard', activeGroupId], queryFn: () => fetchLeaderboard(activeGroupId) });
  const { data: groupInfo } = useQuery({ 
      queryKey: ['group', activeGroupId], 
      queryFn: () => activeGroupId ? fetchGroup(activeGroupId).catch(() => ({ name: "Porra Global" })) : Promise.resolve({ name: "Ninguna Liga Seleccionada" }) 
  });
  const { data: onlineUsers } = useQuery({ queryKey: ['presence'], queryFn: fetchPresence });
  const { data: topScorers } = useQuery({ queryKey: ['topScorers'], queryFn: fetchTopScorers, staleTime: 300_000 }); // 5 min

  const activeGroupName = groupInfo?.name || "Ninguna Liga Seleccionada";
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupBetMode = groupInfo?.betMode || 'FULL_BRACKET';
  const activeGroupPichichi = groupInfo?.pichichi !== undefined ? groupInfo.pichichi : true;

  const nameToIdMap = matches?.reduce((acc, m) => {
    acc[m.home] = m.home_team_id;
    acc[m.away] = m.away_team_id;
    return acc;
  }, {}) || {};

  const loading = !standings || !matches || !bets;

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
  }, [isAdminAuthenticated]);

  const changeGroup = useCallback((groupId) => {
    localStorage.setItem('activeGroupId', groupId);
    setActiveGroupId(groupId);
    const saved = localStorage.getItem(`draft_bracket_${groupId}`);
    setBracketState(saved ? JSON.parse(saved) : defaultBracketState);
    if (isAdminAuthenticated) {
        updateUserPreferences({ lastSelectedGroupId: parseInt(groupId) }).catch(console.error);
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    const autoSelectGroup = async () => {
      if (!userName) return;
      try {
        let dbGroupId = null;
        if (isAdminAuthenticated) {
           try {
               const me = await fetchMe();
               dbGroupId = me.lastSelectedGroupId?.toString();
           } catch { /* ignore */ }
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
      } catch { /* ignore */ }
    };
    autoSelectGroup();
  }, [userName, isAdminAuthenticated, activeGroupId, changeGroup]);

  const checkAdmin = (str) => {
    if (!str) return false;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash === 576654803 || hash === -1061661165;
  };

  const isRaclos = checkAdmin(userName?.trim());

  const value = {
    officialPoints: standings || {},
    matchRadar: radar || { live: [], last: [], next: [] },
    participantsHashes: bets || [],
    allGames: matches || [],
    groupOdds: odds || {},
    nameToIdMap,
    leaderboardData: leaderboard || [],
    loading,
    userName, setUserName,
    userId, setUserId,
    bracketState, setBracketState,
    topScorer, setTopScorer,
    fetchData: refreshAll,
    viewerBetId, setViewerBetId,
    onlineUsers: onlineUsers || [],
    isRaclos,
    isAdminAuthenticated, setIsAdminAuthenticated,
    deleteBet, fixThird, acceptBet, editBetName,
    activeGroupId, activeGroupName, activeGroupAdmin,
    activeGroupAdminId, activeGroupBetMode, activeGroupPichichi,
    changeGroup,
    topScorers: topScorers || []
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => useContext(AppContext);
