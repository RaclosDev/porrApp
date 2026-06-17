import { createContext, useContext, useState, useEffect } from 'react';
import { fetchStandings, fetchMatches, fetchMatchRadar, fetchBets, fetchTeamOdds, fetchTiebreakers, fetchPresence, sendPresenceHeartbeat, getAdminToken } from '../services/api';
import { decodeHash } from '../utils/hash';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [data, setData] = useState({
    officialPoints: {},
    groupOdds: {},
    participantsHashes: [],
    allGames: [],
    manualTiebreakers: {},
    matchRadar: { live: [], last: [], next: [] },
    officialResultsHash: "", // Currently not loaded from API in old code, usually injected or part of standings if implemented
    nameToIdMap: {},
    loading: true,
  });

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

  const [userName, setUserName] = useState(localStorage.getItem('my_bet_name') || '');
  const [bracketState, setBracketState] = useState(defaultBracketState);
  const [topScorer, setTopScorer] = useState('');
  const [viewerHash, setViewerHash] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const fetchData = async () => {
    try {
      const [standings, radar, bets, matches, tiebreakers, odds] = await Promise.all([
        fetchStandings(),
        fetchMatchRadar(),
        fetchBets(),
        fetchMatches(),
        fetchTiebreakers(),
        fetchTeamOdds()
      ]);

      // Calculate nameToIdMap for head to head
      const idMap = {};
      matches.forEach(m => {
        idMap[m.home] = m.home_team_id;
        idMap[m.away] = m.away_team_id;
      });

      // Extract official results hash if it exists (assuming it comes from bets with a specific key or is injected, for now keeping it empty as per old structure)
      
      setData(prev => ({
        ...prev,
        officialPoints: standings || {},
        matchRadar: radar || { live: [], last: [], next: [] },
        participantsHashes: bets || [],
        allGames: matches || [],
        manualTiebreakers: tiebreakers || {},
        groupOdds: odds || {},
        nameToIdMap: idMap,
        loading: false
      }));
    } catch (e) {
      console.error("Error fetching data:", e);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  const checkAdmin = (str) => {
    if (!str) return false;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash === -1854738724 || hash === 1517890930;
  };

  const isRaclos = checkAdmin(userName?.trim());

  const deleteBet = async (key) => {
    if (window.confirm("¿Estás seguro de que quieres borrar esta apuesta?")) {
      try {
        const response = await fetch(`/api/bets/${key}`, { 
          method: 'DELETE',
          headers: { 'X-Admin-Token': getAdminToken() || '' }
        });
        if (response.ok) {
          alert("Apuesta eliminada con éxito.");
          fetchData();
        } else {
          alert("Error al borrar la apuesta.");
        }
      } catch (e) {
        alert("Error al borrar: " + e.message);
      }
    }
  };

  const fixThird = async (key, hash, winner) => {
    if (!window.confirm("¿Asignar a " + winner + " como ganador del 3º Puesto para esta apuesta?")) return;
    const part = decodeHash(hash);
    if (!part) return;
    part.thirdPlaceWinner = winner;
    const jsonString = JSON.stringify(part);
    const newHash = btoa(unescape(encodeURIComponent(jsonString)));

    try {
      const response = await fetch(`/api/bets/${key}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken() || ''
        },
        body: JSON.stringify({ participantName: part.user, hash: newHash })
      });
      if (response.ok) {
        alert("Tercer puesto fijado correctamente.");
        fetchData();
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
        fetchData();
      } else {
        alert("Error al confirmar la apuesta.");
      }
    } catch (e) {
      alert("Error al confirmar: " + e.message);
    }
  };

  const editBetName = async (key, currentHash) => {
    const decoded = decodeHash(currentHash);
    if (!decoded) return alert("No se pudo decodificar la apuesta.");

    const newUserName = window.prompt("Edita el nombre del jugador:", decoded.user || "");
    if (!newUserName || newUserName.trim() === "") return;

    decoded.user = newUserName.trim();
    const jsonString = JSON.stringify(decoded);
    const newHash = btoa(unescape(encodeURIComponent(jsonString)));

    try {
      const response = await fetch(`/api/bets/${key}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': getAdminToken() || ''
        },
        body: JSON.stringify({ participantName: newUserName.trim(), hash: newHash })
      });
      if (response.ok) {
        alert("Nombre y apuesta actualizados.");
        fetchData();
      } else {
        alert("Error al guardar en el servidor.");
      }
    } catch (e) {
      alert("Error de red: " + e.message);
    }
  };

  const bumpTeam = async (groupName, teamName) => {
    try {
      const response = await fetch(`/api/admin/bump-up?teamName=${encodeURIComponent(teamName)}`, {
        method: 'POST'
      });
      if (response.ok) {
        alert("Posición subida con éxito.");
        fetchData();
      } else {
        alert("Error al subir posición.");
      }
    } catch (e) {
      alert("Error de red: " + e.message);
    }
  };

  useEffect(() => {
    fetchData();
    const fetchPres = async () => {
      try {
        const name = userName || localStorage.getItem('my_bet_name') || "Anónimo";
        await sendPresenceHeartbeat(name);
        const pres = await fetchPresence();
        if (pres) setOnlineUsers(pres);
      } catch (e) {}
    };
    fetchPres();
    const interval = setInterval(() => {
      fetchData();
      fetchPres();
    }, 10000);
    return () => clearInterval(interval);
  }, [userName]);

  const value = {
    ...data,
    userName,
    setUserName,
    bracketState,
    setBracketState,
    topScorer,
    setTopScorer,
    fetchData,
    viewerHash,
    setViewerHash,
    onlineUsers,
    isRaclos,
    isAdminAuthenticated,
    setIsAdminAuthenticated,
    deleteBet,
    fixThird,
    acceptBet,
    editBetName,
    bumpTeam
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
