import { useState, useEffect, useMemo } from 'react';
import { fetchOfficialBracket, fetchPredictionScore, getAuthToken } from '../services/api';
import { compareTeams } from '../utils/points';
import { extractGroupsFromR32, hasValidGroupSelections, buildR32FromGroups } from './useBracket';

/**
 * Hook personalizado que carga y procesa los datos necesarios para visualizar la porra de un usuario.
 * Maneja la lógica de obtener los puntos oficiales, combinarlos con los de la porra y calcular en vivo qué se ha acertado.
 *
 * @param {string|number} viewerPredictionId - ID de la porra a visualizar.
 * @param {Object} officialPoints - Puntuación oficial calculada de los equipos.
 * @param {Array} leaderboardData - Datos globales del Leaderboard para extraer la información de los puntos obtenidos por este usuario.
 * @param {Object} groupOdds - Datos de los grupos y equipos que los conforman.
 * @param {Array} allGames - Todos los partidos para resolver desempates.
 * @param {Object} nameToIdMap - Mapa de resolución de nombres a IDs.
 * @param {Object} [initialPart] - Datos ya disponibles de la porra (lista de participantes) para pintarla al instante.
 * @returns {Object} Objeto con la información lista para el visor: { part, loading, error, points, initialSection, leftRounds, rightRounds, getSlotDetails, getRoundFooterTotal, getCenterPointsTotal, getGroupTeamData }
 */
const checkIsKnockoutPhase = (games, officialData) => {
  if (games && games.length > 0) {
    const hasActiveKo = games.some((g) => {
      if (!g || g.round === 'group' || g.round === 'r1' || g.round === '1') return false;
      if (g.finished || g.home_score != null || g.away_score != null) return true;
      if (
        g.home &&
        typeof g.home === 'string' &&
        g.home !== 'Por definir' &&
        g.home !== 'TBD' &&
        !g.home.includes('º')
      )
        return true;
      if (g.date && new Date(g.date) <= new Date()) return true;
      return false;
    });
    if (hasActiveKo) return true;
  }
  if (officialData) {
    const allKo = [
      ...(officialData.r32 || []),
      ...(officialData.r16 || []),
      ...(officialData.qf || []),
      ...(officialData.sf || []),
      officialData.final || [],
      officialData.thirdPlaceMatch || [],
    ].flat(2);
    if (
      allKo.some(
        (team) =>
          team &&
          typeof team === 'string' &&
          team !== 'Por definir' &&
          team !== '???' &&
          !team.includes('º'),
      )
    ) {
      return true;
    }
  }
  return false;
};

export function usePredictionViewerData(
  viewerPredictionId,
  officialPoints,
  leaderboardData,
  groupOdds,
  allGames,
  nameToIdMap,
  initialPart = null,
) {
  const [rawPart, setRawPart] = useState(() => initialPart || null);
  const [rawOfficialBracket, setRawOfficialBracket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailedScore, setDetailedScore] = useState(null);

  const injectQualifiedTeams = (partData, ptsData) => {
    if (!partData?.r32 || !ptsData) return partData;
    const guaranteed = {};
    Object.keys(ptsData).forEach((group) => {
      guaranteed[group] = {};
      const status5Teams = [];
      Object.keys(ptsData[group]).forEach((team) => {
        const st = ptsData[group][team].status;
        if (st === 1) guaranteed[group]['1'] = team;
        else if (st === 2) guaranteed[group]['2'] = team;
        else if (st === 5) status5Teams.push(team);
      });

      if (status5Teams.length > 0) {
        const combinedName = status5Teams.join(' / ');
        if (!guaranteed[group]['1']) guaranteed[group]['1'] = combinedName;
        if (!guaranteed[group]['2']) guaranteed[group]['2'] = combinedName;
      }
    });
    const newPart = JSON.parse(JSON.stringify(partData));
    newPart.r32 = newPart.r32.map((match) =>
      match.map((teamName) => {
        if (typeof teamName === 'string' && teamName.includes('º Grupo ')) {
          const parts = teamName.split(' ');
          const grp = parts[2];
          if (guaranteed[grp]?.[parts[0].replace('º', '')])
            return guaranteed[grp][parts[0].replace('º', '')];
        }
        return teamName;
      }),
    );
    return newPart;
  };

  /**
   * Normaliza el JSON de una porra sin mutar el objeto original (puede venir de la caché de React Query).
   */
  const normalizePart = (partData, odds) => {
    if (!partData) return null;
    const normalized = JSON.parse(JSON.stringify(partData));

    // Normalizar final y tercer puesto
    if (!normalized.final && normalized.finalMatch) {
      normalized.final = normalized.finalMatch;
    }
    if (
      normalized.final &&
      typeof normalized.final === 'object' &&
      !Array.isArray(normalized.final)
    ) {
      const h = normalized.final.home;
      const a = normalized.final.away;
      normalized.final = [
        typeof h === 'object' && h ? h.name : h,
        typeof a === 'object' && a ? a.name : a,
      ];
    } else if (Array.isArray(normalized.final)) {
      normalized.final = normalized.final.map((t) => (typeof t === 'object' && t ? t.name : t));
    }

    if (!normalized.thirdPlaceMatch && (normalized.thirdMatch || normalized.third)) {
      normalized.thirdPlaceMatch = normalized.thirdMatch || normalized.third;
    }
    if (
      normalized.thirdPlaceMatch &&
      typeof normalized.thirdPlaceMatch === 'object' &&
      !Array.isArray(normalized.thirdPlaceMatch)
    ) {
      const h = normalized.thirdPlaceMatch.home;
      const a = normalized.thirdPlaceMatch.away;
      normalized.thirdPlaceMatch = [
        typeof h === 'object' && h ? h.name : h,
        typeof a === 'object' && a ? a.name : a,
      ];
    } else if (Array.isArray(normalized.thirdPlaceMatch)) {
      normalized.thirdPlaceMatch = normalized.thirdPlaceMatch.map((t) =>
        typeof t === 'object' && t ? t.name : t,
      );
    }

    // Rescate de la final si está vacía pero hay semifinales y campeón
    if (
      (!normalized.final || !normalized.final[0] || !normalized.final[1]) &&
      Array.isArray(normalized.sf) &&
      normalized.sf.length >= 2 &&
      normalized.champion
    ) {
      const sf1 = (normalized.sf[0] || []).map((t) => (typeof t === 'object' && t ? t.name : t));
      const sf2 = (normalized.sf[1] || []).map((t) => (typeof t === 'object' && t ? t.name : t));
      const champ =
        typeof normalized.champion === 'object' && normalized.champion
          ? normalized.champion.name
          : normalized.champion;
      const inSf1 = sf1.includes(champ);
      const inSf2 = sf2.includes(champ);
      let finalist1 = inSf1 ? champ : null;
      let finalist2 = inSf2 ? champ : null;
      const thirds = Array.isArray(normalized.thirdPlaceMatch) ? normalized.thirdPlaceMatch : [];

      if (inSf1) {
        finalist2 = sf2.find((t) => t && !thirds.includes(t)) || sf2[0] || null;
      } else if (inSf2) {
        finalist1 = sf1.find((t) => t && !thirds.includes(t)) || sf1[0] || null;
      }
      if (finalist1 && finalist2) {
        normalized.final = [finalist1, finalist2];
      }
    }

    // Rescate del 3er puesto si está vacío pero hay semifinales y final
    if (
      (!normalized.thirdPlaceMatch ||
        !normalized.thirdPlaceMatch[0] ||
        !normalized.thirdPlaceMatch[1]) &&
      Array.isArray(normalized.sf) &&
      normalized.sf.length >= 2 &&
      Array.isArray(normalized.final) &&
      normalized.final[0] &&
      normalized.final[1]
    ) {
      const sf1 = (normalized.sf[0] || []).map((t) => (typeof t === 'object' && t ? t.name : t));
      const sf2 = (normalized.sf[1] || []).map((t) => (typeof t === 'object' && t ? t.name : t));
      const t1 = sf1.find((t) => t && !normalized.final.includes(t));
      const t2 = sf2.find((t) => t && !normalized.final.includes(t));
      if (t1 && t2) {
        normalized.thirdPlaceMatch = [t1, t2];
      }
    }

    if (!hasValidGroupSelections(normalized.groups) && (normalized.r32 || normalized.r1)) {
      const extracted = extractGroupsFromR32(normalized.r32 || normalized.r1, odds);
      if (hasValidGroupSelections(extracted.groups)) {
        normalized.groups = extracted.groups;
        if (!normalized.thirds || normalized.thirds.length === 0) {
          normalized.thirds = extracted.thirds;
        }
      }
    }

    if (!Array.isArray(normalized.r32) || normalized.r32.length < 16) {
      if (Array.isArray(normalized.r1) && normalized.r1.length >= 16) {
        normalized.r32 = normalized.r1;
      } else if (normalized.groups && hasValidGroupSelections(normalized.groups)) {
        normalized.r32 = buildR32FromGroups(normalized.groups, normalized.thirds);
      }
    }

    return normalized;
  };

  const part = useMemo(() => normalizePart(rawPart, groupOdds), [rawPart, groupOdds]);

  const officialBracket = useMemo(
    () => injectQualifiedTeams(rawOfficialBracket, officialPoints),
    [rawOfficialBracket, officialPoints],
  );

  const initialSection = useMemo(
    () => (checkIsKnockoutPhase(allGames, officialBracket) ? 'knockout' : 'groups'),
    [allGames, officialBracket],
  );

  useEffect(() => {
    let cancelled = false;

    if (!viewerPredictionId) {
      setRawPart(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const hasInitialPart = Boolean(initialPart);
    setError(null);
    if (hasInitialPart) {
      setRawPart(initialPart);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const partPromise = hasInitialPart
      ? Promise.resolve(null)
      : fetch(`/api/predictions/${viewerPredictionId}`, {
          headers: {
            ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
          },
        }).then((res) => {
          if (!res.ok)
            return res.json().then((e) => {
              throw new Error(e.error || e.message || 'Error al cargar la porra');
            });
          return res.json();
        });

    const officialPromise = fetchOfficialBracket().catch(() => ({
      r32: [
        ['1º Grupo E', '3º A/B/C/D/F'],
        ['1º Grupo I', '3º C/D/F/G/H'],
        ['2º Grupo A', '2º Grupo B'],
        ['1º Grupo F', '2º Grupo C'],
        ['2º Grupo K', '2º Grupo L'],
        ['1º Grupo H', '2º Grupo J'],
        ['1º Grupo D', '3º B/E/F/I/J'],
        ['1º Grupo G', '3º A/E/H/I/J'],
        ['1º Grupo C', '2º Grupo F'],
        ['2º Grupo E', '2º Grupo I'],
        ['1º Grupo A', '3º C/E/F/H/I'],
        ['1º Grupo L', '3º E/H/I/J/K'],
        ['1º Grupo J', '2º Grupo H'],
        ['2º Grupo D', '2º Grupo G'],
        ['1º Grupo B', '3º E/F/G/I/J'],
        ['1º Grupo K', '3º D/E/I/J/L'],
      ],
      r16: Array(8).fill([null, null]),
      qf: Array(4).fill([null, null]),
      sf: Array(2).fill([null, null]),
      final: [null, null],
      thirdPlaceMatch: [null, null],
    }));

    Promise.all([partPromise, officialPromise])
      .then(([partData, officialData]) => {
        if (cancelled) return;
        if (partData) setRawPart(partData);
        setRawOfficialBracket(officialData);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewerPredictionId, initialPart]);

  const scoreForPrediction = useMemo(
    () =>
      detailedScore && String(detailedScore.id) === String(viewerPredictionId)
        ? detailedScore
        : null,
    [detailedScore, viewerPredictionId],
  );

  const points = useMemo(() => {
    if (scoreForPrediction && Array.isArray(scoreForPrediction.log)) {
      return scoreForPrediction;
    }
    const found = (leaderboardData || []).find((lb) => {
      if (!lb) return false;
      if (viewerPredictionId && String(lb.id) === String(viewerPredictionId)) return true;
      if (part?.user && lb.name && lb.name.toLowerCase() === part.user.toLowerCase()) return true;
      if (
        part?.predictionName &&
        lb.predictionName &&
        lb.predictionName.toLowerCase() === part.predictionName.toLowerCase()
      )
        return true;
      return false;
    });
    return (
      found || {
        total: 0,
        r1: 0,
        r32: 0,
        r16: 0,
        qf: 0,
        sf: 0,
        finals: 0,
        scorer: 0,
        log: [],
        exactMatches: {},
        passedTeams: {},
      }
    );
  }, [scoreForPrediction, leaderboardData, viewerPredictionId, part?.user, part?.predictionName]);

  const isPending = loading || (!part && !error && Boolean(viewerPredictionId));
  const partReady = Boolean(part);

  // El desglose completo (log, aciertos exactos) se pide en segundo plano: el visor ya está pintado.
  useEffect(() => {
    if (!viewerPredictionId || !partReady) return undefined;
    let cancelled = false;
    fetchPredictionScore(viewerPredictionId)
      .then((score) => {
        if (!cancelled && score) setDetailedScore(score);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewerPredictionId, partReady]);

  const getFlat = (arr) => (arr ? arr.flat().filter(Boolean) : []);
  const winR16 = getFlat(part?.r16);
  const winQF = getFlat(part?.qf);
  const winSF = getFlat(part?.sf);
  const winFinal = useMemo(() => {
    const f = part?.final || part?.finalMatch;
    if (Array.isArray(f)) {
      return f.map((t) => (typeof t === 'object' && t ? t.name : t)).filter(Boolean);
    }
    if (f && typeof f === 'object') {
      const h = typeof f.home === 'object' && f.home ? f.home.name : f.home;
      const a = typeof f.away === 'object' && f.away ? f.away.name : f.away;
      return [h, a].filter(Boolean);
    }
    return [];
  }, [part?.final, part?.finalMatch]);

  const toMatches = (arr) =>
    (arr || []).map((m) => ({ home: m?.[0] || null, away: m?.[1] || null }));

  const r32Source = useMemo(() => {
    if (Array.isArray(part?.r32) && part.r32.length >= 16) return part.r32;
    if (Array.isArray(part?.r1) && part.r1.length >= 16) return part.r1;
    if (part?.groups && hasValidGroupSelections(part.groups)) {
      return buildR32FromGroups(part.groups, part.thirds);
    }
    return [];
  }, [part?.r32, part?.r1, part?.groups, part?.thirds]);

  const leftRounds = useMemo(
    () => [
      toMatches(r32Source?.slice(0, 8)),
      toMatches(part?.r16?.slice(0, 4)),
      toMatches(part?.qf?.slice(0, 2)),
      toMatches(part?.sf?.slice(0, 1)),
    ],
    [r32Source, part?.r16, part?.qf, part?.sf],
  );

  const rightRounds = useMemo(
    () => [
      toMatches(r32Source?.slice(8, 16)),
      toMatches(part?.r16?.slice(4, 8)),
      toMatches(part?.qf?.slice(2, 4)),
      toMatches(part?.sf?.slice(1, 2)),
    ],
    [r32Source, part?.r16, part?.qf, part?.sf],
  );

  const isTeamEliminated = (teamName) => {
    if (!teamName || teamName === '???' || teamName === 'Por definir' || teamName.includes('º'))
      return false;

    const resolveName = (n) =>
      n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;
    const resolvedName = resolveName(teamName);

    if (officialPoints) {
      for (const group of Object.values(officialPoints)) {
        const safeKey1 = teamName.replace(/[.#$[\]]/g, '');
        const safeKey2 = resolvedName.replace(/[.#$[\]]/g, '');

        if (group[safeKey1]) {
          if (group[safeKey1].status === 4 || group[safeKey1].status === -1) return true;
        } else if (group[safeKey2]) {
          if (group[safeKey2].status === 4 || group[safeKey2].status === -1) return true;
        }
      }
    }

    if (allGames) {
      for (const game of allGames) {
        if (
          game.round !== 'group' &&
          game.round !== 'third' &&
          game.finished &&
          (game.home === teamName ||
            game.away === teamName ||
            game.home === resolvedName ||
            game.away === resolvedName)
        ) {
          const winner = game.winner
            ? game.winner
            : game.home_score > game.away_score
              ? game.home
              : game.away_score > game.home_score
                ? game.away
                : null;
          if (winner && winner !== teamName && winner !== resolvedName) {
            return true;
          }
        }
      }
    }
    return false;
  };

  /**
   * Checks if a team is impossible for a specific round based on cross-round exclusions.
   * e.g., a team that won the semifinal (is in the final) cannot be in the third place match,
   * and a team that lost the semifinal (is in 3rd place match) cannot be in the final/champion.
   */
  const isTeamImpossibleForRound = (teamName, roundIndex) => {
    if (!teamName || teamName === '???' || teamName === 'Por definir' || teamName.includes('º'))
      return false;
    if (!officialBracket) return false;

    const namesMatch = (n1, n2) => {
      if (!n1 || !n2) return false;
      if (n1 === n2) return true;
      if ((n1 === 'EEUU' && n2 === 'Estados Unidos') || (n1 === 'Estados Unidos' && n2 === 'EEUU'))
        return true;
      return false;
    };

    const officialFinal = officialBracket.final || [];
    const officialThird = officialBracket.thirdPlaceMatch || [];
    const officialChampion = officialBracket.champion;
    const isInOfficialFinal = officialFinal.some((t) => namesMatch(t, teamName));
    const isInOfficialThird = officialThird.some((t) => namesMatch(t, teamName));

    // A team in the official final cannot be in the third place match
    if (roundIndex === 'thirdPlaceMatch' && isInOfficialFinal) return true;

    // A team in the official third place match cannot be in the final or be champion
    if ((roundIndex === 'final' || roundIndex === 'champion') && isInOfficialThird) return true;

    // A team that is the official champion cannot be in the third place match
    if (roundIndex === 'thirdPlaceMatch' && namesMatch(officialChampion, teamName)) return true;

    // A semifinal loser (who goes to 3rd place match) cannot be in the final
    // Check if team lost a semifinal : they go to 3rd place, not the final
    if (roundIndex === 'final' || roundIndex === 'champion') {
      if (allGames) {
        for (const game of allGames) {
          if (
            game.round === 'sf' &&
            game.finished &&
            (game.home === teamName || game.away === teamName)
          ) {
            const winner = game.winner
              ? game.winner
              : game.home_score > game.away_score
                ? game.home
                : game.away_score > game.home_score
                  ? game.away
                  : null;
            if (winner && winner !== teamName) return true;
          }
        }
      }
    }

    // A semifinal winner (who goes to final) cannot be in 3rd place match
    if (roundIndex === 'thirdPlaceMatch') {
      if (allGames) {
        for (const game of allGames) {
          if (
            game.round === 'sf' &&
            game.finished &&
            (game.home === teamName || game.away === teamName)
          ) {
            const winner = game.winner
              ? game.winner
              : game.home_score > game.away_score
                ? game.home
                : game.away_score > game.home_score
                  ? game.away
                  : null;
            if (winner && winner === teamName) return true;
          }
        }
      }
    }

    return false;
  };

  const getSlotDetails = (name, roundIndex) => {
    let isWinner = false;
    if (name && name !== '???') {
      if (roundIndex === 0) isWinner = winR16.includes(name);
      else if (roundIndex === 1) isWinner = winQF.includes(name);
      else if (roundIndex === 2) isWinner = winSF.includes(name);
      else if (roundIndex === 3) isWinner = winFinal.includes(name);
      else if (roundIndex === 'final') isWinner = part?.champion === name;
      else if (roundIndex === 4 || roundIndex === 'champion') isWinner = part?.champion === name;
      else if (roundIndex === 5 || roundIndex === 'thirdPlaceMatch')
        isWinner = part?.thirdPlaceWinner === name;
    }

    let slotPoints = null;
    if (officialBracket && name && name !== '???') {
      const isRealTeam = (t) => t && t !== '???' && t !== 'Por definir' && !t.includes('º');
      const resolveName = (n) =>
        n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;
      const altName = resolveName(name);

      const matchesLog = (l, stage, extra) => {
        if (!l || l.stage !== stage) return false;
        const hasTeam = l.msg.includes(name) || l.msg.includes(altName);
        if (!hasTeam) return false;
        if (extra && !l.msg.includes(extra)) return false;
        return true;
      };

      let amount = 0;
      let foundLog = false;

      if (roundIndex === 0) {
        // Dieciseisavos: acertar equipo que avanza a octavos
        const l = (points.log || []).find((l) => matchesLog(l, 'r32'));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 1) {
        // Octavos: acertar equipo que avanza a cuartos
        const l = (points.log || []).find((l) => matchesLog(l, 'r16'));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 2) {
        // Cuartos: acertar equipo que avanza a semifinales
        const l = (points.log || []).find((l) => matchesLog(l, 'qf'));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 3) {
        // Semifinales: acertar equipo que avanza a la final
        const l = (points.log || []).find((l) => matchesLog(l, 'sf'));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'final') {
        const isRunnerUp =
          part?.final &&
          part.final.some((t) => {
            const tName = typeof t === 'object' && t ? t.name : t;
            return tName === name && name !== part?.champion;
          });
        const l = (points.log || []).find((l) =>
          matchesLog(l, 'finals', isRunnerUp ? 'Subcampeón' : 'Campeón'),
        );
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'champion') {
        const l = (points.log || []).find((l) => matchesLog(l, 'finals', 'Campeón'));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'thirdPlaceMatch') {
        const isThird = part?.thirdPlaceWinner === name;
        const l = (points.log || []).find((l) =>
          matchesLog(l, 'finals', isThird ? 'Tercer puesto' : 'Cuarto puesto'),
        );
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      }

      if (foundLog) {
        slotPoints = amount > 0 ? `+${amount}` : '0';
      } else if (
        isWinner ||
        roundIndex === 'final' ||
        roundIndex === 'champion' ||
        roundIndex === 'thirdPlaceMatch'
      ) {
        let isNameAnywhere = false;
        let flatRound = [];

        const namesMatch = (n1, n2) => {
          if (!n1 || !n2) return false;
          if (n1 === n2) return true;
          if (
            (n1 === 'EEUU' && n2 === 'Estados Unidos') ||
            (n1 === 'Estados Unidos' && n2 === 'EEUU')
          )
            return true;
          return n1.trim().toLowerCase() === n2.trim().toLowerCase();
        };

        if (roundIndex === 0) {
          flatRound = getFlat(officialBracket.r16);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 1) {
          flatRound = getFlat(officialBracket.qf);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 2) {
          flatRound = getFlat(officialBracket.sf);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 3) {
          flatRound = officialBracket.final || [];
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 'final') {
          flatRound = officialBracket.final || [];
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 'champion') {
          flatRound = [officialBracket.champion];
          isNameAnywhere = namesMatch(officialBracket.champion, name);
        } else if (roundIndex === 'thirdPlaceMatch') {
          flatRound = officialBracket.thirdPlaceMatch || [];
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        }

        if (!isNameAnywhere) {
          const expectedSize = {
            0: 16,
            1: 8,
            2: 4,
            3: 2,
            final: 2,
            champion: 1,
            thirdPlaceMatch: 2,
          }[roundIndex];
          const isFullyPopulated = flatRound.filter(isRealTeam).length === expectedSize;

          let eliminated = isTeamEliminated(name);
          if (eliminated && roundIndex === 'thirdPlaceMatch') {
            const lostInSemifinal = allGames?.some(
              (game) =>
                game.round === 'sf' &&
                game.finished &&
                (namesMatch(game.home, name) || namesMatch(game.away, name)) &&
                (() => {
                  const w = game.winner
                    ? game.winner
                    : game.home_score > game.away_score
                      ? game.home
                      : game.away_score > game.home_score
                        ? game.away
                        : null;
                  return w && !namesMatch(w, name);
                })(),
            );
            if (lostInSemifinal) eliminated = false;
          }

          if (isFullyPopulated || eliminated || isTeamImpossibleForRound(name, roundIndex)) {
            slotPoints = '0';
          }
        }
      }
    }

    return { isWinner, slotPoints };
  };

  const getRoundFooterTotal = (roundIndex, side) => {
    let matches = [];
    if (side === 'left') matches = leftRounds[roundIndex];
    else if (side === 'right') matches = rightRounds[roundIndex];

    if (!matches || matches.length === 0) return 0;

    const resolveName = (n) =>
      n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;

    let total = 0;
    matches.forEach((m) => {
      const checkName = (slot) => {
        const name = typeof slot === 'object' && slot !== null ? slot.name : slot;
        if (!name || name === '???') return;
        const altName = resolveName(name);
        const matchesLog = (l, stage) => {
          if (!l || l.stage !== stage) return false;
          return l.msg.includes(name) || l.msg.includes(altName);
        };

        if (roundIndex === 0) {
          if (winR16.includes(name)) {
            const l = (points.log || []).find((l) => matchesLog(l, 'r32'));
            if (l) total += l.amount;
          }
        } else if (roundIndex === 1) {
          if (winQF.includes(name)) {
            const l = (points.log || []).find((l) => matchesLog(l, 'r16'));
            if (l) total += l.amount;
          }
        } else if (roundIndex === 2) {
          if (winSF.includes(name)) {
            const l = (points.log || []).find((l) => matchesLog(l, 'qf'));
            if (l) total += l.amount;
          }
        } else if (roundIndex === 3) {
          if (winFinal.includes(name)) {
            const l = (points.log || []).find((l) => matchesLog(l, 'sf'));
            if (l) total += l.amount;
          }
        }
      };
      checkName(m.home);
      checkName(m.away);
    });

    return total;
  };

  const getCenterPointsTotal = () => {
    if (typeof points.finals === 'number' && points.finals > 0) {
      return points.finals;
    }
    return (points.log || [])
      .filter((l) => l.stage === 'finals')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
  };

  const getGroupTeamData = (groupName, teamName, expectedPos) => {
    if (!officialPoints || !officialPoints[groupName] || !groupOdds)
      return { color: 'inherit', mp: 0, status: 0 };
    const teams = groupOdds[groupName].map((t) => ({ name: t.name }));
    teams.sort((a, b) => compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap));

    const safeKey = teamName.replace(/[.#$[\]]/g, '');
    const officialData = officialPoints[groupName][safeKey];
    const mp = typeof officialData === 'object' && officialData !== null ? officialData.mp || 0 : 0;
    const status =
      typeof officialData === 'object' && officialData !== null ? officialData.status || 0 : 0;

    const resolveName = (n) =>
      n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;
    const altTeamName = resolveName(teamName);

    let color = 'inherit';
    if (mp > 0) {
      const groupKey = groupName.toUpperCase();
      const isExact =
        points.exactMatches &&
        (points.exactMatches[groupKey] || points.exactMatches[groupName]) &&
        (points.exactMatches[groupKey]?.[expectedPos] ||
          points.exactMatches[groupName]?.[expectedPos]);
      const isPassed =
        points.passedTeams && (points.passedTeams[teamName] || points.passedTeams[altTeamName]);
      if (isExact) color = '#2ecc71';
      else if (isPassed) color = '#3498db';
      else color = '#e74c3c';
    }

    return { color, mp, status };
  };

  return {
    part,
    loading: isPending,
    error,
    points,
    initialSection,
    leftRounds,
    rightRounds,
    getSlotDetails,
    getRoundFooterTotal,
    getCenterPointsTotal,
    getGroupTeamData,
  };
}
