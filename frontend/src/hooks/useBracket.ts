import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { createPrediction, fetchMyPredictions, getAuthToken } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { solveThirdPlaceMatrix, THIRD_PLACE_RULES } from '../utils/matrix';
import { isGlobalLeagueId } from '../utils/constants';
import { defaultBracketState } from '../store/useAppStore';

export const WORLD_CUP_2026_GROUPS = {
  A: ['México', 'Sudáfrica', 'Corea del Sur', 'Chequia'],
  B: ['Canadá', 'Bosnia y Her.', 'Catar', 'Suiza'],
  C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  D: ['EEUU', 'Paraguay', 'Australia', 'Turquía'],
  E: ['Alemania', 'Curaçao', 'Costa de Marfil', 'Ecuador'],
  F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
  G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  H: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'],
  I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
  J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
  K: ['Portugal', 'RD Congo', 'Uzbekistán', 'Colombia'],
  L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
};

export function hasValidGroupSelections(groups) {
  if (!groups || typeof groups !== 'object') return false;
  return Object.values(groups).some((g) => {
    if (!g) return false;
    if (Array.isArray(g)) {
      return g.some(
        (team) =>
          typeof team === 'string' &&
          team.trim() !== '' &&
          !team.includes('º') &&
          team !== 'Por definir' &&
          team !== '???',
      );
    }
    if (typeof g === 'object') {
      const isReal = (t) =>
        typeof t === 'string' &&
        t.trim() !== '' &&
        !t.includes('º') &&
        t !== 'Por definir' &&
        t !== '???';
      return isReal(g.first) || isReal(g.second) || isReal(g.third);
    }
    return false;
  });
}

/**
 * Reconstruye el árbol completo de bracketState a partir del DTO plano de la base de datos.
 */
export function normalizeGroupsDraft(groups) {
  if (!groups || typeof groups !== 'object') return {};
  const res = {};
  Object.keys(groups).forEach((g) => {
    const val = groups[g];
    if (Array.isArray(val)) {
      res[g] = {
        first: val[0] || '',
        second: val[1] || '',
        third: val[2] || '',
      };
    } else if (val && typeof val === 'object') {
      res[g] = {
        first: val.first || '',
        second: val.second || '',
        third: val.third || '',
      };
    }
  });
  return res;
}

export function extractGroupsFromR32(r32, groupOdds = {}) {
  const groups = {};
  const thirds = [];
  if (!r32) return { groups, thirds };

  // Normalize r32 into 16 match pairs: [[home, away], ...]
  let pairs = [];
  if (typeof r32 === 'object') {
    if (Array.isArray(r32.left) && Array.isArray(r32.right)) {
      const left = r32.left.map((m) => [m?.home?.name || m?.home, m?.away?.name || m?.away]);
      const right = r32.right.map((m) => [m?.home?.name || m?.home, m?.away?.name || m?.away]);
      pairs = [...left, ...right];
    } else if (Array.isArray(r32)) {
      pairs = r32.map((m) => {
        if (Array.isArray(m)) return [m[0], m[1]];
        if (m && typeof m === 'object') return [m.home?.name || m.home, m.away?.name || m.away];
        return [null, null];
      });
    }
  }

  if (pairs.length < 16) return { groups, thirds };

  const getTeamName = (slot) => {
    if (!slot) return '';
    if (typeof slot === 'string') return slot.trim();
    if (typeof slot === 'object' && slot.name) return slot.name.trim();
    return '';
  };

  const setSpot = (g, pos, slot) => {
    const team = getTeamName(slot);
    if (!team || team.includes('º') || team === 'Por definir' || team === '???') return;
    if (!groups[g]) groups[g] = { first: '', second: '', third: '' };
    groups[g][pos] = team;
  };

  const addThird = (slot) => {
    const team = getTeamName(slot);
    if (!team || team.includes('º') || team === 'Por definir' || team === '???') return;
    if (!thirds.includes(team)) thirds.push(team);
  };

  // Left matches (0 to 7)
  setSpot('E', 'first', pairs[0]?.[0]);
  addThird(pairs[0]?.[1]);

  setSpot('I', 'first', pairs[1]?.[0]);
  addThird(pairs[1]?.[1]);

  setSpot('F', 'first', pairs[2]?.[0]);
  setSpot('C', 'second', pairs[2]?.[1]);

  setSpot('C', 'first', pairs[3]?.[0]);
  setSpot('F', 'second', pairs[3]?.[1]);

  setSpot('A', 'second', pairs[4]?.[0]);
  setSpot('B', 'second', pairs[4]?.[1]);

  setSpot('E', 'second', pairs[5]?.[0]);
  setSpot('I', 'second', pairs[5]?.[1]);

  setSpot('A', 'first', pairs[6]?.[0]);
  addThird(pairs[6]?.[1]);

  setSpot('L', 'first', pairs[7]?.[0]);
  addThird(pairs[7]?.[1]);

  // Right matches (8 to 15)
  setSpot('K', 'second', pairs[8]?.[0]);
  setSpot('L', 'second', pairs[8]?.[1]);

  setSpot('H', 'first', pairs[9]?.[0]);
  setSpot('J', 'second', pairs[9]?.[1]);

  setSpot('D', 'first', pairs[10]?.[0]);
  addThird(pairs[10]?.[1]);

  setSpot('G', 'first', pairs[11]?.[0]);
  addThird(pairs[11]?.[1]);

  setSpot('J', 'first', pairs[12]?.[0]);
  setSpot('H', 'second', pairs[12]?.[1]);

  setSpot('D', 'second', pairs[13]?.[0]);
  setSpot('G', 'second', pairs[13]?.[1]);

  setSpot('B', 'first', pairs[14]?.[0]);
  addThird(pairs[14]?.[1]);

  setSpot('K', 'first', pairs[15]?.[0]);
  addThird(pairs[15]?.[1]);

  const findGroupByTeamName = (teamName) => {
    if (!teamName) return null;
    const lower = teamName.toLowerCase().trim();
    if (groupOdds && typeof groupOdds === 'object') {
      for (const [g, teamList] of Object.entries(groupOdds)) {
        if (
          Array.isArray(teamList) &&
          teamList.some((t) => (t?.name || '').toLowerCase().trim() === lower)
        ) {
          return g;
        }
      }
    }
    for (const [g, teamList] of Object.entries(WORLD_CUP_2026_GROUPS)) {
      if (teamList.some((t) => t.toLowerCase().trim() === lower)) {
        return g;
      }
    }
    return null;
  };

  thirds.forEach((thirdTeam) => {
    const g = findGroupByTeamName(thirdTeam);
    if (g) {
      if (!groups[g]) groups[g] = { first: '', second: '', third: '' };
      groups[g].third = thirdTeam;
    }
  });

  return { groups, thirds };
}

export function buildR32FromGroups(groupsInput, thirdsRaw = []) {
  if (!groupsInput || typeof groupsInput !== 'object') return null;
  const groups = normalizeGroupsDraft(groupsInput);
  if (!hasValidGroupSelections(groups)) return null;

  // Resolve third-place teams
  let advancingThirds = [];
  if (Array.isArray(thirdsRaw) && thirdsRaw.length > 0) {
    advancingThirds = thirdsRaw
      .map((t) => (typeof t === 'string' ? t.trim() : t?.team || t?.name || ''))
      .filter((t) => t && !t.includes('º') && t !== 'Por definir' && t !== '???');
  }
  if (advancingThirds.length < 8) {
    Object.keys(groups).forEach((g) => {
      const th = groups[g]?.third;
      if (
        th &&
        !th.includes('º') &&
        th !== 'Por definir' &&
        th !== '???' &&
        !advancingThirds.includes(th)
      ) {
        advancingThirds.push(th);
      }
    });
  }

  const teamToGroup = {};
  Object.keys(groups).forEach((g) => {
    if (groups[g]?.third) teamToGroup[groups[g].third] = g;
    if (groups[g]?.first) teamToGroup[groups[g].first] = g;
    if (groups[g]?.second) teamToGroup[groups[g].second] = g;
  });

  const findGroupByTeam = (teamName) => {
    if (!teamName) return null;
    if (teamToGroup[teamName]) return teamToGroup[teamName];
    const lower = teamName.toLowerCase().trim();
    for (const [g, teamList] of Object.entries(WORLD_CUP_2026_GROUPS)) {
      if (teamList.some((t) => t.toLowerCase().trim() === lower)) {
        return g;
      }
    }
    return null;
  };

  const thirdObjects = advancingThirds.slice(0, 8).map((t) => ({
    team: t,
    group: findGroupByTeam(t) || 'A',
  }));

  const solvedMatrix = solveThirdPlaceMatrix(thirdObjects);
  const thirdSlotTeams = Array(8).fill(null);
  if (solvedMatrix) {
    solvedMatrix.forEach((m, idx) => {
      thirdSlotTeams[idx] = m?.team || null;
    });
  } else {
    advancingThirds.slice(0, 8).forEach((t, idx) => {
      thirdSlotTeams[idx] = t;
    });
  }

  const gFirst = (g) => groups[g]?.first || `1º Grupo ${g}`;
  const gSecond = (g) => groups[g]?.second || `2º Grupo ${g}`;
  const gThird = (idx, placeholder) => thirdSlotTeams[idx] || placeholder;

  return [
    [gFirst('E'), gThird(0, '3º A/B/C/D/F')],
    [gFirst('I'), gThird(1, '3º C/D/F/G/H')],
    [gFirst('F'), gSecond('C')],
    [gFirst('C'), gSecond('F')],
    [gSecond('A'), gSecond('B')],
    [gSecond('E'), gSecond('I')],
    [gFirst('A'), gThird(2, '3º C/E/F/H/I')],
    [gFirst('L'), gThird(3, '3º E/H/I/J/K')],
    [gSecond('K'), gSecond('L')],
    [gFirst('H'), gSecond('J')],
    [gFirst('D'), gThird(4, '3º B/E/F/I/J')],
    [gFirst('G'), gThird(5, '3º A/E/H/I/J')],
    [gFirst('J'), gSecond('H')],
    [gSecond('D'), gSecond('G')],
    [gFirst('B'), gThird(6, '3º E/F/G/I/J')],
    [gFirst('K'), gThird(7, '3º D/E/I/J/L')],
  ];
}

export function reconstructBracketState(data) {
  if (!data) return null;
  const toSlot = (name) =>
    name && typeof name === 'string' && name.trim() && name !== 'Por definir' && name !== '???'
      ? { name: name.trim() }
      : null;

  const toMatches = (pairs, start, count, prefix) => {
    const slice = (pairs || []).slice(start, start + count);
    const result = [];
    for (let i = 0; i < count; i++) {
      const p = slice[i];
      result.push({
        home: toSlot(p?.[0]),
        away: toSlot(p?.[1]),
        id: `${prefix}_${i}`,
      });
    }
    return result;
  };

  let r32Data = null;
  if (Array.isArray(data.r32) && data.r32.length >= 16) {
    r32Data = data.r32;
  } else if (Array.isArray(data.r1) && data.r1.length >= 16) {
    r32Data = data.r1;
  } else if (data.groups && hasValidGroupSelections(normalizeGroupsDraft(data.groups))) {
    r32Data = buildR32FromGroups(data.groups, data.thirds);
  }

  const hasR32 = Boolean(r32Data && r32Data.length >= 16);

  return {
    r32: hasR32
      ? {
          left: toMatches(r32Data, 0, 8, 'L'),
          right: toMatches(r32Data, 8, 8, 'R'),
        }
      : defaultBracketState.r32,
    r16: {
      left: toMatches(data.r16 || [], 0, 4, 'L8'),
      right: toMatches(data.r16 || [], 4, 4, 'R8'),
    },
    qf: {
      left: toMatches(data.qf || [], 0, 2, 'L4'),
      right: toMatches(data.qf || [], 2, 2, 'R4'),
    },
    sf: {
      left: toMatches(data.sf || [], 0, 1, 'L2'),
      right: toMatches(data.sf || [], 1, 1, 'R2'),
    },
    final: (() => {
      const f = data.final || data.finalMatch;
      if (Array.isArray(f) && (f[0] || f[1])) {
        return { home: toSlot(f[0]), away: toSlot(f[1]), id: 'FINAL' };
      }
      if (f && typeof f === 'object' && (f.home || f.away)) {
        return {
          home: toSlot(typeof f.home === 'object' ? f.home?.name : f.home),
          away: toSlot(typeof f.away === 'object' ? f.away?.name : f.away),
          id: 'FINAL',
        };
      }
      return null;
    })(),
    champion: toSlot(typeof data.champion === 'object' ? data.champion?.name : data.champion),
    thirdPlaceMatch: (() => {
      const t = data.thirdPlaceMatch || data.thirdMatch || data.third;
      if (Array.isArray(t) && (t[0] || t[1])) {
        return { home: toSlot(t[0]), away: toSlot(t[1]), id: 'THIRD' };
      }
      if (t && typeof t === 'object' && (t.home || t.away)) {
        return {
          home: toSlot(typeof t.home === 'object' ? t.home?.name : t.home),
          away: toSlot(typeof t.away === 'object' ? t.away?.name : t.away),
          id: 'THIRD',
        };
      }
      return null;
    })(),
    thirdPlaceWinner: toSlot(
      typeof data.thirdPlaceWinner === 'object'
        ? data.thirdPlaceWinner?.name
        : data.thirdPlaceWinner,
    ),
  };
}

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
    userId,
    topScorer,
    setTopScorer,
    isAuthenticated,
    activeGroupId,
    fetchData,
    groupOdds,
    activeGroupPoolFormat,
    officialPoints,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    loadingGroup,
    groupError,
    participantsHashes,
  } = useAppContext();

  const [predictionName, setPredictionName] = useState('');
  const [savedPredictionId, setSavedPredictionId] = useState(null);
  const [savedGroupsDraft, setSavedGroupsDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(`draft_groups_${activeGroupId}`);
      if (!raw) return {};
      const parsed = normalizeGroupsDraft(JSON.parse(raw));
      return hasValidGroupSelections(parsed) ? parsed : {};
    } catch {
      return {};
    }
  });
  const [savedThirdsDraft, setSavedThirdsDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(`draft_advancing_${activeGroupId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();

  const isKnockoutsOnly = activeGroupPoolFormat === 'KNOCKOUTS_ONLY';
  const isMatchDay = activeGroupPoolFormat === 'MATCH_DAY';
  const allTeams = groupOdds
    ? Object.values(groupOdds)
        .flat()
        .map((t) => t.name)
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!isKnockoutsOnly) return;
    if (!officialPoints || Object.keys(officialPoints).length === 0) return;
    const hasAnyPlaceholder = [...bracketState.r32.left, ...bracketState.r32.right].some(
      (m) => m.home?.name?.includes('º') || m.away?.name?.includes('º'),
    );
    if (!hasAnyPlaceholder) return;

    const firstPlace = {};
    const secondPlace = {};
    Object.entries(officialPoints).forEach(([g, teams]) => {
      Object.entries(teams).forEach(([name, s]) => {
        if (s.status === 1) firstPlace[g] = name;
        if (s.status === 2) secondPlace[g] = name;
      });
    });
    Object.keys(firstPlace).forEach((g) => {
      const orig = (groupOdds?.[g] || []).find(
        (t) => t.name.replace(/[.#$[\]]/g, '') === firstPlace[g],
      );
      if (orig) firstPlace[g] = orig.name;
    });
    Object.keys(secondPlace).forEach((g) => {
      const orig = (groupOdds?.[g] || []).find(
        (t) => t.name.replace(/[.#$[\]]/g, '') === secondPlace[g],
      );
      if (orig) secondPlace[g] = orig.name;
    });
    if (!Object.keys(firstPlace).length && !Object.keys(secondPlace).length) return;

    const ns = JSON.parse(JSON.stringify(bracketState));
    let changed = false;
    const updateSlot = (slot) => {
      if (slot?.name?.startsWith('1º Grupo ')) {
        const g = slot.name.replace('1º Grupo ', '');
        if (firstPlace[g]) {
          slot.name = firstPlace[g];
          changed = true;
        }
      } else if (slot?.name?.startsWith('2º Grupo ')) {
        const g = slot.name.replace('2º Grupo ', '');
        if (secondPlace[g]) {
          slot.name = secondPlace[g];
          changed = true;
        }
      }
    };

    [...ns.r32.left, ...ns.r32.right].forEach((m) => {
      updateSlot(m.home);
      updateSlot(m.away);
    });
    if (changed) setBracketState(ns);
  }, [officialPoints, groupOdds, bracketState, setBracketState, isKnockoutsOnly]);

  useEffect(() => {
    if (!activeGroupId && !isAuthenticated) {
      toast.error('Debes seleccionar o crear una liga antes de rellenar tu porra.');
      navigate('/mis-ligas');
    }
  }, [activeGroupId, navigate, isAuthenticated]);

  useEffect(() => {
    const token = getAuthToken();
    if ((isAuthenticated || Boolean(token)) && activeGroupId) {
      fetchMyPredictions()
        .then((predictions) => {
          if (!Array.isArray(predictions)) return;
          let current = predictions.find(
            (b) => b.groupId?.toString() === activeGroupId?.toString(),
          );
          if (!current && (!activeGroupId || isGlobalLeagueId(activeGroupId))) {
            current = predictions.find((b) => !b.groupId || isGlobalLeagueId(b.groupId));
          }
          if (!current && predictions.length === 1) {
            current = predictions[0];
          }
          if (!current && Array.isArray(participantsHashes) && participantsHashes.length > 0) {
            current = participantsHashes.find(
              (p) =>
                (userId && p.userId?.toString() === userId?.toString()) ||
                (userName && p.participantName?.toLowerCase() === userName.toLowerCase()) ||
                p.isCaller,
            );
          }

          if (current) {
            setSavedPredictionId(current.id || current.key || null);
            if (current.participantName && !userName) {
              setUserName(current.participantName);
            }
            const predictionTitle = current.predictionName || current.predictionName;
            if (predictionTitle) setPredictionName(predictionTitle);
            const currentData = current.data;
            if (currentData) {
              if (currentData.scorer) setTopScorer(currentData.scorer);
              let norm = normalizeGroupsDraft(currentData.groups);
              let normThirds = Array.isArray(currentData.thirds) ? currentData.thirds : [];

              if (!hasValidGroupSelections(norm) && (currentData.r32 || currentData.r1)) {
                const extracted = extractGroupsFromR32(
                  currentData.r32 || currentData.r1,
                  groupOdds,
                );
                norm = extracted.groups;
                if (normThirds.length === 0) normThirds = extracted.thirds;
              }

              if (hasValidGroupSelections(norm)) {
                setSavedGroupsDraft(norm);
                try {
                  localStorage.setItem(`draft_groups_${activeGroupId}`, JSON.stringify(norm));
                } catch {
                  /* ignore */
                }
              }
              if (normThirds.length > 0) {
                setSavedThirdsDraft(normThirds);
                try {
                  localStorage.setItem(
                    `draft_advancing_${activeGroupId}`,
                    JSON.stringify(normThirds),
                  );
                } catch {
                  /* ignore */
                }
              }
              const hydrated = reconstructBracketState(currentData);
              if (hydrated) {
                setBracketState(hydrated);
              }
            }
          }
        })
        .catch(console.error);
    }
  }, [
    userName,
    userId,
    activeGroupId,
    isAuthenticated,
    participantsHashes,
    groupOdds,
    setBracketState,
    setTopScorer,
    setPredictionName,
    setUserName,
  ]);

  // Si aún no hay borrador de grupos válido pero el bracket ya tiene equipos en R32, extraer automáticamente
  useEffect(() => {
    if (hasValidGroupSelections(savedGroupsDraft)) return;
    const leftMatches = bracketState.r32?.left || [];
    const rightMatches = bracketState.r32?.right || [];
    const hasAnyRealTeam = [...leftMatches, ...rightMatches].some(
      (m) =>
        (m.home?.name &&
          !m.home.name.includes('º') &&
          m.home.name !== 'Por definir' &&
          m.home.name !== '???') ||
        (m.away?.name &&
          !m.away.name.includes('º') &&
          m.away.name !== 'Por definir' &&
          m.away.name !== '???'),
    );
    if (!hasAnyRealTeam) return;

    const extracted = extractGroupsFromR32(bracketState.r32, groupOdds);
    if (hasValidGroupSelections(extracted.groups)) {
      setSavedGroupsDraft(extracted.groups);
      try {
        localStorage.setItem(`draft_groups_${activeGroupId}`, JSON.stringify(extracted.groups));
      } catch {
        /* ignore */
      }
      if (extracted.thirds && extracted.thirds.length > 0) {
        setSavedThirdsDraft(extracted.thirds);
        try {
          localStorage.setItem(
            `draft_advancing_${activeGroupId}`,
            JSON.stringify(extracted.thirds),
          );
        } catch {
          /* ignore */
        }
      }
    }
  }, [bracketState, savedGroupsDraft, groupOdds, activeGroupId]);

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

  const generatePredictionData = async () => {
    if (!predictionName.trim()) {
      toast.error('Por favor introduce un nombre para tu porra.');
      return;
    }
    if (!isAuthenticated && (!userName || !bracketState.champion)) {
      toast.error('Por favor rellena tu nombre y completa el bracket hasta el campeón.');
      return;
    }
    if (activeGroupPichichi && !topScorer) {
      toast.error('Por favor introduce el pichichi.');
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
        toast.error('Por favor rellena todos los equipos de los Dieciseisavos antes de enviar.');
        return;
      }
    }
    const r32 = [...getTeamPairs(bracketState.r32.left), ...getTeamPairs(bracketState.r32.right)];
    const r16 = [...getTeamPairs(bracketState.r16.left), ...getTeamPairs(bracketState.r16.right)];
    const qf = [...getTeamPairs(bracketState.qf.left), ...getTeamPairs(bracketState.qf.right)];
    const sf = [...getTeamPairs(bracketState.sf.left), ...getTeamPairs(bracketState.sf.right)];

    let groupsRaw = {};
    let advancingThirds = [];
    try {
      const savedGroups = localStorage.getItem('draft_groups_' + activeGroupId);
      if (savedGroups) groupsRaw = JSON.parse(savedGroups);
    } catch {
      groupsRaw = {};
    }
    try {
      const savedThirds = localStorage.getItem('draft_advancing_' + activeGroupId);
      if (savedThirds) advancingThirds = JSON.parse(savedThirds);
    } catch {
      advancingThirds = [];
    }

    const formattedGroups = {};
    Object.keys(groupsRaw).forEach((g) => {
      formattedGroups[g] = [groupsRaw[g].first, groupsRaw[g].second];
      if (groupsRaw[g].third) formattedGroups[g].push(groupsRaw[g].third);
    });

    const predictionData = {
      user: userName,
      prediction: predictionName,
      r1: r32,
      r32,
      r16,
      qf,
      sf,
      final: (() => {
        const h =
          bracketState.final?.home?.name || bracketState.final?.home || bracketState.final?.[0];
        const a =
          bracketState.final?.away?.name || bracketState.final?.away || bracketState.final?.[1];
        const hName = typeof h === 'object' && h ? h.name : h;
        const aName = typeof a === 'object' && a ? a.name : a;
        return hName && aName ? [hName, aName] : null;
      })(),
      champion: bracketState.champion?.name || bracketState.champion || null,
      thirdPlaceMatch: (() => {
        const h =
          bracketState.thirdPlaceMatch?.home?.name ||
          bracketState.thirdPlaceMatch?.home ||
          bracketState.thirdPlaceMatch?.[0];
        const a =
          bracketState.thirdPlaceMatch?.away?.name ||
          bracketState.thirdPlaceMatch?.away ||
          bracketState.thirdPlaceMatch?.[1];
        const hName = typeof h === 'object' && h ? h.name : h;
        const aName = typeof a === 'object' && a ? a.name : a;
        return hName && aName ? [hName, aName] : null;
      })(),
      thirdPlaceWinner:
        bracketState.thirdPlaceWinner?.name || bracketState.thirdPlaceWinner || null,
      scorer: topScorer,
      isOfficial: false,
      groups: isKnockoutsOnly ? {} : formattedGroups,
      thirds: isKnockoutsOnly ? [] : advancingThirds,
    };
    if (activeGroupIsLocked) {
      toast.error('El plazo para enviar o modificar porras en esta liga ha finalizado.');
      return;
    }
    try {
      await createPrediction(predictionData, activeGroupId);
      toast.success('¡Porra guardada correctamente en la liga!');
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Hubo un error al guardar la porra.');
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

  const hasPlaceholders = useMemo(() => {
    const leftMatches = bracketState.r32?.left || [];
    const rightMatches = bracketState.r32?.right || [];
    const allMatches = [...leftMatches, ...rightMatches];
    if (allMatches.length === 0) return true;
    return allMatches.some(
      (m) =>
        !m.home?.name ||
        m.home.name.includes('º') ||
        m.home.name.startsWith('3º') ||
        !m.away?.name ||
        m.away.name.includes('º') ||
        m.away.name.startsWith('3º'),
    );
  }, [bracketState]);

  const isInitialState =
    !isKnockoutsOnly && hasPlaceholders && groupOdds && Object.keys(groupOdds).length > 0;

  const handleResetToGroupStage = () => {
    // Si aún no tenemos selecciones válidas pero el cuadro actual tiene equipos, extraer antes de resetear
    if (!hasValidGroupSelections(savedGroupsDraft)) {
      const extracted = extractGroupsFromR32(bracketState.r32, groupOdds);
      if (hasValidGroupSelections(extracted.groups)) {
        setSavedGroupsDraft(extracted.groups);
        try {
          localStorage.setItem(`draft_groups_${activeGroupId}`, JSON.stringify(extracted.groups));
        } catch {
          /* ignore */
        }
        if (extracted.thirds && extracted.thirds.length > 0) {
          setSavedThirdsDraft(extracted.thirds);
          try {
            localStorage.setItem(
              `draft_advancing_${activeGroupId}`,
              JSON.stringify(extracted.thirds),
            );
          } catch {
            /* ignore */
          }
        }
      }
    }
    setBracketState(defaultBracketState);
    try {
      localStorage.removeItem(`draft_bracket_${activeGroupId}`);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    bracketState,
    setBracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    predictionName,
    setPredictionName,
    isKnockoutsOnly,
    isMatchDay,
    allTeams,
    isInitialState,
    isAuthenticated,
    activeGroupId,
    groupOdds,
    activeGroupPichichi,
    activeGroupIsLocked,
    activeGroupLockDate,
    setR32Team,
    advanceTeam,
    handleGroupStageComplete,
    generatePredictionData,
    getTeamStatus,
    handleResetToGroupStage,
    savedGroupsDraft,
    savedThirdsDraft,
    savedPredictionId,
    loadingGroup,
    groupError,
  };
}
