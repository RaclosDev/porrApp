import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStandings, fetchMatches, fetchMatchRadar, fetchBets, fetchTeamOdds, fetchPresence, getAdminToken, fetchLeaderboard, fetchGroup, updateBet, fetchMyGroups, fetchMe, updateUserPreferences } from '../services/api';

const AppContext = createContext();

const defaultBracketState = {
  r32: {
    left: [
      { home: { name: "1º Grupo E" }, away: { name: "3º A/B/C/D/F" }, id: 'L1' },
      { home: { name: "1º Grupo I" }, away: { name: "3º C/D/F/G/H" }, id: 'L2' },
      { home: { name: "2º Grupo A" }, away: { name: "2º Grupo B" }, id: 'L3' },
      { home: { name: "1º Grupo F" }, away: { name: "2º Grupo C" }, id: 'L4' },
      { home: { name: "2º Grupo K" }, away: { name: "2º Grupo L" }, id: 'L5' },
      { home: { name: "1º Grupo H" }, away: { name: "2º Grupo J" }, id: 'L6' },
      { home: { name: "1º Grupo D" }, away: { name: "3º B/E/F/I/J" }, id: 'L7' },
      { home: { name: "1º Grupo G" }, away: { name: "3º A/E/H/I/J" }, id: 'L8' }
    ],
    right: [
      { home: { name: "1º Grupo C" }, away: { name: "2º Grupo F" }, id: 'R1' },
      { home: { name: "2º Grupo E" }, away: { name: "2º Grupo I" }, id: 'R2' },
      { home: { name: "1º Grupo A" }, away: { name: "3º C/E/F/H/I" }, id: 'R3' },
      { home: { name: "1º Grupo L" }, away: { name: "3º E/H/I/J/K" }, id: 'R4' },
      { home: { name: "1º Grupo J" }, away: { name: "2º Grupo H" }, id: 'R5' },
      { home: { name: "2º Grupo D" }, away: { name: "2º Grupo G" }, id: 'R6' },
      { home: { name: "1º Grupo B" }, away: { name: "3º E/F/G/I/J" }, id: 'R7' },
      { home: { name: "1º Grupo K" }, away: { name: "3º D/E/I/J/L" }, id: 'R8' }
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
    const saved = localStorage.getItem('draft_bracket_' + activeGroupId);
    return saved ? JSON.parse(saved) : defaultBracketState;
  });
  const [topScorer, setTopScorer] = useState('');
  const [viewerBetId, setViewerBetId] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!getAdminToken());

  // REACT QUERY: Fetch data efficiently with caching
  const { data: standings } = useQuery({ queryKey: ['standings'], queryFn: fetchStandings });
  const { data: radar } = useQuery({ queryKey: ['radar'], queryFn: fetchMatchRadar });
  const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
  const { data: bets } = useQuery({ queryKey: ['bets', activeGroupId], queryFn: () => fetchBets(activeGroupId) });
  const tiebreakers = {};
  const { data: odds } = useQuery({ queryKey: ['odds'], queryFn: fetchTeamOdds });
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard', activeGroupId], queryFn: () => fetchLeaderboard(activeGroupId) });
  const { data: groupInfo } = useQuery({ 
      queryKey: ['group', activeGroupId], 
      queryFn: () => activeGroupId ? fetchGroup(activeGroupId).catch(() => ({ name: "Porra Global" })) : Promise.resolve({ name: "Ninguna Liga Seleccionada" }) 
  });
  const { data: onlineUsers } = useQuery({ queryKey: ['presence'], queryFn: fetchPresence });

  const activeGroupName = groupInfo?.name || "Ninguna Liga Seleccionada";
  const activeGroupAdmin = groupInfo?.adminParticipantName || null;
  const activeGroupAdminId = groupInfo?.adminUserId || null;
  const activeGroupBetMode = groupInfo?.betMode || 'FULL_BRACKET';
  const activeGroupPichichi = groupInfo?.pichichi !== undefined ? groupInfo.pichichi : true;

  // Calculate nameToIdMap for head to head
  const nameToIdMap = {};
  if (matches) {
    matches.forEach(m => {
      nameToIdMap[m.home] = m.home_team_id;
      nameToIdMap[m.away] = m.away_team_id;
    });
  }

  const loading = !standings || !matches || !bets;

  useEffect(() => {
    localStorage.setItem('draft_bracket_' + activeGroupId, JSON.stringify(bracketState));
  }, [bracketState, activeGroupId]);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      setUserName('');
      setUserId('');
      localStorage.removeItem('my_bet_name');
      localStorage.removeItem('my_user_id');
    }
  }, [isAdminAuthenticated]);

  // Auto-seleccionar liga al cargar: si solo tiene 1, esa; si no, la que haya guardado en base de datos.
  useEffect(() => {
    const autoSelectGroup = async () => {
      if (!userName) return;
      try {
        let dbGroupId = null;
        if (isAdminAuthenticated) {
           try {
               const me = await fetchMe();
               dbGroupId = me.lastSelectedGroupId?.toString();
           } catch (e) {}
        }
        
        const myGroups = await fetchMyGroups();
        if (myGroups.length === 1) {
          const onlyGroupId = myGroups[0].id.toString();
          const currentActiveId = localStorage.getItem('activeGroupId');
          if (currentActiveId !== onlyGroupId) {
            changeGroup(onlyGroupId);
          }
        } else if (dbGroupId && activeGroupId !== dbGroupId) {
          changeGroup(dbGroupId);
        }
      } catch (e) {
        // No autenticado o error de red - ignorar
      }
    };
    autoSelectGroup();
  }, [userName, isAdminAuthenticated]);

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

  // Admin actions
  const refreshAll = () => queryClient.invalidateQueries();

  const deleteBet = async (key) => {
    if (window.confirm("¿Estás seguro de que quieres borrar esta apuesta?")) {
      try {
        const response = await fetch(`/api/bets/${key}`, { 
          method: 'DELETE',
          headers: { 'X-Admin-Token': getAdminToken() || '' }
        });
        if (response.ok) {
          alert("Apuesta eliminada con éxito.");
          refreshAll();
        } else {
          alert("Error al borrar la apuesta.");
        }
      } catch (e) {
        alert("Error al borrar: " + e.message);
      }
    }
  };

  const fixThird = async (key, id, winner) => {
    if (!window.confirm("¿Asignar a " + winner + " como ganador del 3º Puesto para esta apuesta?")) return;
    try {
      const res = await fetch(`/api/bets/${key}`);
      if (!res.ok) throw new Error("Error fetching bet");
      const part = await res.json();
      
      part.thirdPlaceWinner = winner;
      
      const response = await updateBet(key, part);
      if (response.ok) {
        alert("Tercer puesto fijado correctamente.");
        refreshAll();
      } else {
        alert("Error al fijar el tercer puesto.");
      }
    } catch (e) {
      alert("Error de red: " + e.message);
    }
  };

  const acceptBet = async (key) => {
    try {
      const response = await fetch(`/api/bets/${key}/pay`, { 
        method: 'PUT',
        headers: { 'X-Admin-Token': getAdminToken() || '' }
      });
      if (response.ok) {
        alert("¡Apuesta confirmada! Ahora contará en la clasificación.");
        refreshAll();
      } else {
        alert("Error al confirmar la apuesta.");
      }
    } catch (e) {
      alert("Error al confirmar: " + e.message);
    }
  };

  const editBetName = async (key, currentId) => {
    try {
      const res = await fetch(`/api/bets/${key}`);
      if (!res.ok) throw new Error("Error fetching bet");
      const decoded = await res.json();
      
      const newUserName = window.prompt("Edita el nombre del jugador:", decoded.user || "");
      if (!newUserName || newUserName.trim() === "") return;

      decoded.user = newUserName.trim();
      
      const response = await updateBet(key, decoded);
      if (response.ok) {
        alert("Nombre y apuesta actualizados.");
        refreshAll();
      } else {
        alert("Error al guardar en el servidor.");
      }
    } catch (e) {
      alert("Error de red: " + e.message);
    }
  };

  useEffect(() => {
    // Setup WebSocket for real-time data and presence
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/api/ws';
    let ws = null;
    let wsPingInterval = null;

    const connectWebSocket = () => {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            const name = userName || localStorage.getItem('my_bet_name') || "Anónimo";
            ws.send(JSON.stringify({ type: 'HEARTBEAT', name }));
            
            wsPingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }));
                    queryClient.invalidateQueries({ queryKey: ['presence'] });
                }
            }, 10000);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'DATA_UPDATED') {
                    console.log('Real-time update received. Invalidate queries...');
                    queryClient.invalidateQueries(); // React Query re-fetches everything automatically
                } else if (msg.type === 'PRESENCE_UPDATED') {
                    console.log('Presence update received.');
                    queryClient.invalidateQueries({ queryKey: ['presence'] });
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 5s...');
            clearInterval(wsPingInterval);
            setTimeout(connectWebSocket, 5000);
        };
    };

    connectWebSocket();

    return () => {
        if (ws) {
            ws.onclose = null;
            ws.close();
        }
        clearInterval(wsPingInterval);
    };
  }, [userName, activeGroupId, queryClient]);

  const changeGroup = (groupId) => {
    localStorage.setItem('activeGroupId', groupId);
    setActiveGroupId(groupId);
    const saved = localStorage.getItem('draft_bracket_' + groupId);
    setBracketState(saved ? JSON.parse(saved) : defaultBracketState);
    if (isAdminAuthenticated) {
        updateUserPreferences({ lastSelectedGroupId: parseInt(groupId) }).catch(console.error);
    }
  };

  // Provide exactly the same API for legacy components
  const value = {
    officialPoints: standings || {},
    matchRadar: radar || { live: [], last: [], next: [] },
    participantsHashes: bets || [],
    allGames: matches || [],
    groupOdds: odds || {},
    nameToIdMap: nameToIdMap,
    leaderboardData: leaderboard || [],
    loading,
    userName,
    setUserName,
    userId,
    setUserId,
    bracketState,
    setBracketState,
    topScorer,
    setTopScorer,
    fetchData: refreshAll,
    viewerBetId,
    setViewerBetId,
    onlineUsers: onlineUsers || [],
    isRaclos,
    isAdminAuthenticated,
    setIsAdminAuthenticated,
    deleteBet,
    fixThird,
    acceptBet,
    editBetName,
    activeGroupId,
    activeGroupName,
    activeGroupAdmin,
    activeGroupAdminId,
    activeGroupBetMode,
    activeGroupPichichi,
    changeGroup
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
