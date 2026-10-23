import { useState, useEffect, useMemo } from 'react';
import { fetchOfficialBracket } from '../services/api';
import { compareTeams } from '../utils/points';

/**
 * Hook personalizado que carga y procesa los datos necesarios para visualizar la porra de un usuario.
 * Maneja la lógica de obtener los puntos oficiales, combinarlos con los de la porra y calcular en vivo qué se ha acertado.
 *
 * @param {string|number} viewerBetId - ID de la porra a visualizar.
 * @param {Object} officialPoints - Puntuación oficial calculada de los equipos.
 * @param {Array} leaderboardData - Datos globales del Leaderboard para extraer la información de los puntos obtenidos por este usuario.
 * @param {Object} groupOdds - Datos de los grupos y equipos que los conforman.
 * @param {Array} allGames - Todos los partidos para resolver desempates.
 * @param {Object} nameToIdMap - Mapa de resolución de nombres a IDs.
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

export function useBetViewerData(
  viewerBetId,
  officialPoints,
  leaderboardData,
  groupOdds,
  allGames,
  nameToIdMap,
) {
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officialBracket, setOfficialBracket] = useState(null);
  const [initialSection, setInitialSection] = useState(() =>
    checkIsKnockoutPhase(allGames, null) ? 'knockout' : 'groups',
  );

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

  useEffect(() => {
    if (!viewerBetId) {
      setTimeout(() => {
        setPart(null);
        setError(null);
      }, 0);
      return;
    }
    setTimeout(() => {
      setError(null);
      setLoading(true);
    }, 0);
    Promise.all([
      fetch(`/api/bets/${viewerBetId}`).then((res) => {
        if (!res.ok)
          return res.json().then((e) => {
            throw new Error(e.error || 'Error al cargar la porra');
          });
        return res.json();
      }),
      fetchOfficialBracket()
        .then((data) => injectQualifiedTeams(data, officialPoints))
        .catch(() => {
          const fallback = {
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
          };
          return injectQualifiedTeams(fallback, officialPoints);
        }),
    ])
      .then(([partData, officialData]) => {
        setPart(partData);
        setOfficialBracket(officialData);

        const isKo = checkIsKnockoutPhase(allGames, officialData);
        if (isKo) {
          setInitialSection('knockout');
        } else {
          setInitialSection('groups');
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [viewerBetId, officialPoints, allGames]);

  const points = useMemo(() => {
    return (
      leaderboardData.find((lb) => String(lb.id) === String(viewerBetId)) || {
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
  }, [leaderboardData, viewerBetId]);

  const getFlat = (arr) => (arr ? arr.flat().filter(Boolean) : []);
  const winR16 = getFlat(part?.r16);
  const winQF = getFlat(part?.qf);
  const winSF = getFlat(part?.sf);
  const winFinal = part?.final ? part.final : [];

  const toMatches = (arr) =>
    (arr || []).map((m) => ({ home: m?.[0] || null, away: m?.[1] || null }));

  const leftRounds = [
    toMatches(part?.r32?.slice(0, 8)),
    toMatches(part?.r16?.slice(0, 4)),
    toMatches(part?.qf?.slice(0, 2)),
    toMatches(part?.sf?.slice(0, 1)),
  ];
  const rightRounds = [
    toMatches(part?.r32?.slice(8, 16)),
    toMatches(part?.r16?.slice(4, 8)),
    toMatches(part?.qf?.slice(2, 4)),
    toMatches(part?.sf?.slice(1, 2)),
  ];

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
      else if (roundIndex === 'final') isWinner = part.champion === name;
      else if (roundIndex === 4 || roundIndex === 'champion') isWinner = part.champion === name;
      else if (roundIndex === 5 || roundIndex === 'thirdPlaceMatch')
        isWinner = part.thirdPlaceWinner === name;
    }

    let slotPoints = null;
    if (officialBracket && name && name !== '???') {
      const isRealTeam = (t) => t && t !== '???' && t !== 'Por definir' && !t.includes('º');
      let amount = 0;
      let foundLog = false;

      if (roundIndex === 1) {
        const l = points.log.find((l) => l.stage === 'r32' && l.msg.includes(name));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 2) {
        const l = points.log.find((l) => l.stage === 'r16' && l.msg.includes(name));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 3) {
        const l = points.log.find((l) => l.stage === 'qf' && l.msg.includes(name));
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'final') {
        const l1 = points.log.find((l) => l.stage === 'sf' && l.msg.includes(name));
        if (l1) {
          amount += l1.amount;
          foundLog = true;
        }
        const l2 = points.log.find(
          (l) => l.stage === 'finals' && l.msg.includes(name) && l.msg.includes('Subcampeón'),
        );
        if (l2) {
          amount += l2.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'champion') {
        const l = points.log.find(
          (l) => l.stage === 'finals' && l.msg.includes(name) && l.msg.includes('Campeón'),
        );
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 'thirdPlaceMatch') {
        const l = points.log.find(
          (l) =>
            l.stage === 'finals' &&
            l.msg.includes(name) &&
            (l.msg.includes('Tercer puesto') || l.msg.includes('Cuarto puesto')),
        );
        if (l) {
          amount += l.amount;
          foundLog = true;
        }
      } else if (roundIndex === 0) {
        const l = points.log.filter((l) => l.stage === 'r1' && l.msg.includes(name));
        if (l.length > 0) {
          amount = l.reduce((sum, entry) => sum + entry.amount, 0);
          foundLog = true;
        }
      }

      if (foundLog) {
        slotPoints = amount > 0 ? `+${amount}` : '0';
      } else {
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
          return false;
        };

        if (roundIndex === 0) {
          flatRound = getFlat(officialBracket.r32);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 1) {
          flatRound = getFlat(officialBracket.r16);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 2) {
          flatRound = getFlat(officialBracket.qf);
          isNameAnywhere = flatRound.some((t) => namesMatch(t, name));
        } else if (roundIndex === 3) {
          flatRound = getFlat(officialBracket.sf);
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
            0: 32,
            1: 16,
            2: 8,
            3: 4,
            final: 2,
            champion: 1,
            thirdPlaceMatch: 2,
          }[roundIndex];
          const isFullyPopulated = flatRound.filter(isRealTeam).length === expectedSize;

          // For thirdPlaceMatch: SF losers are NOT eliminated : they play in the 3rd place match.
          // Only teams eliminated BEFORE semis (lost in QF, R16, etc.) are truly out.
          let eliminated = isTeamEliminated(name);
          if (eliminated && roundIndex === 'thirdPlaceMatch') {
            const resolveName = (n) =>
              n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;
            const resolved = resolveName(name);
            const lostInSemifinal = allGames?.some(
              (game) =>
                game.round === 'sf' &&
                game.finished &&
                (game.home === name ||
                  game.away === name ||
                  game.home === resolved ||
                  game.away === resolved) &&
                (() => {
                  const w = game.winner
                    ? game.winner
                    : game.home_score > game.away_score
                      ? game.home
                      : game.away_score > game.home_score
                        ? game.away
                        : null;
                  return w && w !== name && w !== resolved;
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

    let total = 0;
    matches.forEach((m) => {
      const checkName = (name) => {
        if (!name || name === '???') return;
        if (roundIndex === 1) {
          const l = points.log.find((l) => l.stage === 'r32' && l.msg.includes(name));
          if (l) total += l.amount;
        } else if (roundIndex === 2) {
          const l = points.log.find((l) => l.stage === 'r16' && l.msg.includes(name));
          if (l) total += l.amount;
        } else if (roundIndex === 3) {
          const l = points.log.find((l) => l.stage === 'qf' && l.msg.includes(name));
          if (l) total += l.amount;
        } else if (roundIndex === 0) {
          const l = points.log.filter((l) => l.stage === 'r1' && l.msg.includes(name));
          if (l.length > 0) total += l.reduce((sum, entry) => sum + entry.amount, 0);
        }
      };
      checkName(m.home);
      checkName(m.away);
    });

    return total;
  };

  const getCenterPointsTotal = () => {
    let total = 0;
    const checkName = (name, rIdx) => {
      if (!name || name === '???') return;
      if (rIdx === 'final') {
        const l1 = points.log.find((l) => l.stage === 'sf' && l.msg.includes(name));
        if (l1) total += l1.amount;
        const l2 = points.log.find(
          (l) => l.stage === 'finals' && l.msg.includes(name) && l.msg.includes('Subcampeón'),
        );
        if (l2) total += l2.amount;
      } else if (rIdx === 'champion') {
        const l = points.log.find(
          (l) => l.stage === 'finals' && l.msg.includes(name) && l.msg.includes('Campeón'),
        );
        if (l) total += l.amount;
      } else if (rIdx === 'thirdPlaceMatch') {
        const l = points.log.find(
          (l) =>
            l.stage === 'finals' &&
            l.msg.includes(name) &&
            (l.msg.includes('Tercer puesto') || l.msg.includes('Cuarto puesto')),
        );
        if (l) total += l.amount;
      }
    };
    checkName(part?.final?.[0], 'final');
    checkName(part?.final?.[1], 'final');
    checkName(part?.champion, 'champion');
    checkName(part?.thirdPlaceMatch?.[0], 'thirdPlaceMatch');
    checkName(part?.thirdPlaceMatch?.[1], 'thirdPlaceMatch');
    return total;
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

    let color = 'inherit';
    if (mp > 0) {
      const isExact =
        points.exactMatches &&
        points.exactMatches[groupName] &&
        points.exactMatches[groupName][expectedPos];
      const isPassed = points.passedTeams && points.passedTeams[teamName];
      if (isExact) color = '#2ecc71';
      else if (isPassed) color = '#3498db';
      else color = '#e74c3c';
    }

    return { color, mp, status };
  };

  return {
    part,
    loading,
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
