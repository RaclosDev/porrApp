import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { createBet, fetchMyBets } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { solveThirdPlaceMatrix, THIRD_PLACE_RULES } from '../utils/matrix';

/**
 * Hook personalizado que gestiona toda la lógica de creación y edición de una porra (Bracket).
 * Coordina la fase de grupos, el avance de equipos por eliminatorias, y la generación final del JSON
 * para enviar al servidor.
 *
 * @returns {Object} Todo el estado y funciones necesarias para manejar el componente Bracket.
 */
export function useBracket() {
  const {
    bracketState,
    setBracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    isAuthenticated,
    isAdminAuthenticated,
    activeGroupId,
    fetchData,
    groupOdds,
    activeGroupBetMode,
    officialPoints,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
  } = useAppContext();

  const [betName, setBetName] = useState('');
  const [myPreviousBets, setMyPreviousBets] = useState([]);
  const navigate = useNavigate();

  const isKnockoutsOnly = activeGroupBetMode === 'KNOCKOUTS_ONLY';
  const isMatchDay = activeGroupBetMode === 'MATCH_DAY';
  const allTeams = groupOdds
    ? Object.values(groupOdds)
        .flat()
        .map((t) => t.name)
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!officialPoints || Object.keys(officialPoints).length === 0) return;
    if (!bracketState.r32.left[0]?.home?.name?.includes('º')) return;

    const firstPlace = {};
    Object.entries(officialPoints).forEach(([g, teams]) => {
      Object.entries(teams).forEach(([name, s]) => {
        if (s.status === 1) firstPlace[g] = name;
      });
    });
    Object.keys(firstPlace).forEach((g) => {
      const orig = (groupOdds?.[g] || []).find(
        (t) => t.name.replace(/[.#$[\]]/g, '') === firstPlace[g],
      );
      if (orig) firstPlace[g] = orig.name;
    });
    if (!Object.keys(firstPlace).length) return;

    const ns = JSON.parse(JSON.stringify(bracketState));
    let changed = false;
    [...ns.r32.left, ...ns.r32.right].forEach((m) => {
      if (m.home?.name?.startsWith('1º Grupo ')) {
        const g = m.home.name.replace('1º Grupo ', '');
        if (firstPlace[g]) {
          m.home = { name: firstPlace[g], id: m.home.id };
          changed = true;
        }
      }
    });
    if (changed) setBracketState(ns);
  }, [officialPoints, groupOdds, bracketState, setBracketState]);

  useEffect(() => {
    if (!activeGroupId && !isAuthenticated) {
      alert('Debes seleccionar o crear una liga antes de rellenar tu porra.');
      navigate('/mis-ligas');
    }
  }, [activeGroupId, navigate, isAuthenticated]);

  useEffect(() => {
    if (userName && activeGroupId) {
      fetchMyBets()
        .then((bets) =>
          setMyPreviousBets(
            bets.filter((b) => b.groupId?.toString() !== activeGroupId?.toString()),
          ),
        )
        .catch(console.error);
    }
  }, [userName, activeGroupId]);

  const handleCopyBet = async (betId) => {
    if (activeGroupIsLocked) {
      alert('El plazo para enviar o modificar porras en esta liga ha finalizado.');
      return;
    }
    if (!window.confirm('¿Quieres copiar esta porra y enviarla a la liga actual?')) return;
    try {
      const res = await fetch(`/api/predictions/${betId}`, {
        headers: { ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}) },
      });
      if (!res.ok) throw new Error();
      const betData = await res.json();
      betData.user = userName;
      await createBet(betData, activeGroupId);
      alert('¡Porra copiada con éxito a esta liga!');
      fetchData();
    } catch (e) {
      alert(e.message || 'Error copiando porra');
    }
  };

  const setR32Team = (teamName, side, matchIndex, isHome) => {
    const ns = JSON.parse(JSON.stringify(bracketState));
    const m = side === 'left' ? ns.r32.left[matchIndex] : ns.r32.right[matchIndex];
    if (isHome) m.home = { name: teamName, id: `${side}_${matchIndex}_home` };
    else m.away = { name: teamName, id: `${side}_${matchIndex}_away` };
    setBracketState(ns);
  };

  const advanceTeam = (team, side, roundIndex, matchIndex) => {
    if (!team || team.name.includes('º')) return;
    const ns = JSON.parse(JSON.stringify(bracketState));

    if (roundIndex < 3) {
      const arr = [ns.r16, ns.qf, ns.sf][roundIndex][side];
      const next = Math.floor(matchIndex / 2);
      if (matchIndex % 2 === 0) arr[next].home = team;
      else arr[next].away = team;
    } else if (roundIndex === 3) {
      if (!ns.final) ns.final = { home: null, away: null, id: 'FINAL' };
      if (!ns.thirdPlaceMatch) ns.thirdPlaceMatch = { home: null, away: null, id: 'THIRD' };
      const sf = bracketState.sf[side][0];
      const loser = sf.home.name === team.name ? sf.away : sf.home;
      if (side === 'left') {
        ns.final.home = team;
        ns.thirdPlaceMatch.home = loser;
      } else {
        ns.final.away = team;
        ns.thirdPlaceMatch.away = loser;
      }
      ns.champion = null;
      ns.thirdPlaceWinner = null;
    } else if (roundIndex === 4) {
      ns.champion = team;
    } else if (roundIndex === 5) {
      ns.thirdPlaceWinner = team;
    }
    setBracketState(ns);
  };

  const getTeamPairs = (matches) =>
    matches.map((m) => [
      m.home?.name && !m.home.name.includes('º') ? m.home.name : null,
      m.away?.name && !m.away.name.includes('º') ? m.away.name : null,
    ]);

  const handleGroupStageComplete = (selections, advancingThirds) => {
    const ns = JSON.parse(JSON.stringify(bracketState));
    const applySlot = (slot) => {
      if (!slot?.name?.includes('º Grupo')) return;
      const [pos, , group] = slot.name.split(' ');
      const sel = selections[group];
      if (sel) slot.name = pos === '1º' ? sel.first : sel.second;
    };

    [...ns.r32.left, ...ns.r32.right].forEach((m) => {
      applySlot(m.home);
      applySlot(m.away);
    });

    const teamToGroup = {};
    Object.keys(selections).forEach((g) => {
      if (selections[g].third) teamToGroup[selections[g].third] = g;
    });

    const thirdTeams = advancingThirds.map((t) => ({ team: t, group: teamToGroup[t] }));
    const solvedMatrix = solveThirdPlaceMatrix(thirdTeams);

    if (solvedMatrix) {
      THIRD_PLACE_RULES.forEach((rule, idx) => {
        const match = ns.r32[rule.side][rule.matchIndex];
        const slot = rule.isHome ? match.home : match.away;
        if (slot?.name?.startsWith('3º ')) {
          slot.name = solvedMatrix[idx].team;
        }
      });
    } else {
      const sorted3rds = [...advancingThirds].sort((a, b) =>
        teamToGroup[a].localeCompare(teamToGroup[b]),
      );
      let ti = 0;
      const apply3rdFallback = (slot) => {
        if (slot?.name?.startsWith('3º ') && ti < sorted3rds.length) slot.name = sorted3rds[ti++];
      };
      [...ns.r32.left, ...ns.r32.right].forEach((m) => {
        apply3rdFallback(m.home);
        apply3rdFallback(m.away);
      });
    }

    setBracketState(ns);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateBetData = async () => {
    if (!betName.trim()) {
      alert('Por favor introduce un nombre para tu porra.');
      return;
    }
    if (!isAuthenticated && (!userName || !bracketState.champion)) {
      alert('Por favor rellena tu nombre y completa el bracket hasta el campeón.');
      return;
    }
    if (activeGroupPichichi && !topScorer) {
      alert('Por favor introduce el pichichi.');
      return;
    }
    if (isKnockoutsOnly) {
      const all = [...bracketState.r32.left, ...bracketState.r32.right];
      if (
        all.some(
          (m) =>
            !m.home?.name ||
            m.home.name.includes('º') ||
            !m.away?.name ||
            m.away.name.includes('º'),
        )
      ) {
        alert('Por favor rellena todos los equipos de los Dieciseisavos antes de enviar.');
        return;
      }
    }
    const r32 = [...getTeamPairs(bracketState.r32.left), ...getTeamPairs(bracketState.r32.right)];
    const r16 = [...getTeamPairs(bracketState.r16.left), ...getTeamPairs(bracketState.r16.right)];
    const qf = [...getTeamPairs(bracketState.qf.left), ...getTeamPairs(bracketState.qf.right)];
    const sf = [...getTeamPairs(bracketState.sf.left), ...getTeamPairs(bracketState.sf.right)];

    const savedGroups = localStorage.getItem('draft_groups_' + activeGroupId);
    const savedThirds = localStorage.getItem('draft_advancing_' + activeGroupId);
    const groupsRaw = savedGroups ? JSON.parse(savedGroups) : {};
    const advancingThirds = savedThirds ? JSON.parse(savedThirds) : [];

    const formattedGroups = {};
    Object.keys(groupsRaw).forEach((g) => {
      formattedGroups[g] = [groupsRaw[g].first, groupsRaw[g].second];
      if (groupsRaw[g].third) formattedGroups[g].push(groupsRaw[g].third);
    });

    const betData = {
      user: userName,
      bet: betName,
      r1: r32,
      r32,
      r16,
      qf,
      sf,
      final:
        bracketState.final?.home?.name && bracketState.final?.away?.name
          ? [bracketState.final.home.name, bracketState.final.away.name]
          : null,
      champion: bracketState.champion?.name || null,
      thirdPlaceMatch:
        bracketState.thirdPlaceMatch?.home?.name && bracketState.thirdPlaceMatch?.away?.name
          ? [bracketState.thirdPlaceMatch.home.name, bracketState.thirdPlaceMatch.away.name]
          : null,
      thirdPlaceWinner: bracketState.thirdPlaceWinner?.name || null,
      scorer: topScorer,
      isOfficial: false,
      groups: isKnockoutsOnly ? {} : formattedGroups,
      thirds: isKnockoutsOnly ? [] : advancingThirds,
    };
    if (activeGroupIsLocked && !(isAdminAuthenticated && betName === 'official')) {
      alert('El plazo para enviar o modificar porras en esta liga ha finalizado.');
      return;
    }
    try {
      if (isAdminAuthenticated && betName === 'official') {
        const res = await fetch('/api/admin/official', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(betData),
        });
        alert(
          res.ok
            ? '¡Resultados OFICIALES actualizados!'
            : 'Error al actualizar resultados oficiales',
        );
      } else {
        await createBet(betData, activeGroupId);
        alert('¡Porra guardada correctamente en la liga!');
        fetchData();
      }
    } catch (e) {
      alert(e.message || 'Hubo un error al guardar la porra.');
    }
  };

  const getTeamStatus = (teamName) => {
    if (!teamName || !officialPoints || !groupOdds) return 0;
    for (const groupName of Object.keys(officialPoints)) {
      if (!groupOdds[groupName]) continue;
      const isInGroup = groupOdds[groupName].some((t) => t.name === teamName);
      if (!isInGroup) continue;
      const safeKey = teamName.replace(/[.#$[\]]/g, '');
      const officialData = officialPoints[groupName][safeKey];
      if (typeof officialData === 'object' && officialData !== null) {
        return officialData.status || 0;
      }
    }
    return 0;
  };

  const hasPlaceholders = bracketState.r32.left[0]?.home?.name?.includes('º');
  const isInitialState =
    !isKnockoutsOnly && hasPlaceholders && groupOdds && Object.keys(groupOdds).length > 0;

  return {
    bracketState,
    setBracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    betName,
    setBetName,
    myPreviousBets,
    isKnockoutsOnly,
    isMatchDay,
    allTeams,
    isInitialState,
    isAuthenticated,
    isAdminAuthenticated,
    activeGroupId,
    groupOdds,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    handleCopyBet,
    setR32Team,
    advanceTeam,
    handleGroupStageComplete,
    generateBetData,
    getTeamStatus,
  };
}
