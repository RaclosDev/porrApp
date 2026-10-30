import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchOfficialBracket } from '../services/api';
import type { PredictionData, TeamPair } from '../types/api';

/** Fila de estadística: nombre, quién lo eligió y, para los gemelos, el % de coincidencia. */
export type StatEntry = [name: string, users: string[], overridePercentage?: number];

/** Hueco con un equipo real (no vacío ni "1º Grupo X"). */
const isRealSlot = (t: string | null | undefined): boolean => Boolean(t) && !t!.includes('º');

export function useStatsData() {
  const { participantsHashes, loading: contextLoading, allGames } = useAppContext();
  const { isLoading: officialLoading } = useQuery({
    queryKey: ['officialBracket'],
    queryFn: () => fetchOfficialBracket(),
    retry: false,
  });
  const loading = contextLoading || officialLoading;

  const stats = useMemo(() => {
    const scorersMap: Record<string, string[]> = {};
    const championsMap: Record<string, string[]> = {};
    const finalsMap: Record<string, string[]> = {};
    const semisMap: Record<string, string[]> = {};
    const runnerupMap: Record<string, string[]> = {};
    const disappointmentsMap: Record<string, string[]> = {};
    const thirdsMap: Record<string, string[]> = {};
    const darkHorsesMap: Record<string, string[]> = {};
    const kingsMap: Record<string, string[]> = {};

    let totalVotes = 0;
    const passCountMap: Record<string, number> = {};

    participantsHashes.forEach((p) => {
      const part = p.data;
      if (!part || !part.r32) return;
      const qualified = part.r32.flat().filter((t): t is string => isRealSlot(t));
      qualified.forEach((t) => {
        passCountMap[t] = (passCountMap[t] || 0) + 1;
      });
    });

    participantsHashes.forEach((p) => {
      const part = p.data;
      if (!part) return;
      const userName = part.user || p.key || 'Anónimo';
      totalVotes++;

      if (part.scorer) {
        if (!scorersMap[part.scorer]) scorersMap[part.scorer] = [];
        scorersMap[part.scorer].push(userName);
      }

      if (part.champion) {
        if (!championsMap[part.champion]) championsMap[part.champion] = [];
        championsMap[part.champion].push(userName);
      }

      if (part.sf) {
        const sfTeams = part.sf.flat();
        sfTeams.forEach((t) => {
          if (!t || t.includes('º')) return;
          if (!semisMap[t]) semisMap[t] = [];
          semisMap[t].push(userName);
        });
      }

      if (part.final && part.final.length === 2) {
        const f1 = part.final[0];
        const f2 = part.final[1];
        if (f1 && f2) {
          const sortedFinal = [f1, f2].sort().join(' vs ');
          if (!finalsMap[sortedFinal]) finalsMap[sortedFinal] = [];
          finalsMap[sortedFinal].push(userName);

          if (part.champion) {
            const runnerup = f1 === part.champion ? f2 : f1;
            if (!runnerup.includes('º')) {
              if (!runnerupMap[runnerup]) runnerupMap[runnerup] = [];
              runnerupMap[runnerup].push(userName);
            }
          }
        }
      }

      if (part.groups) {
        Object.values(part.groups).forEach((g) => {
          if (g[0] && !g[0].includes('º')) {
            if (!kingsMap[g[0]]) kingsMap[g[0]] = [];
            kingsMap[g[0]].push(userName);
          }
          if (g[2] && !g[2].includes('º') && part.r32 && part.r32.flat().includes(g[2])) {
            if (!thirdsMap[g[2]]) thirdsMap[g[2]] = [];
            thirdsMap[g[2]].push(userName);
          }
        });
      }
    });

    const officialR32: string[] = [];
    if (allGames) {
      allGames.forEach((m) => {
        if (m.round === 'r16') {
          if (m.home) officialR32.push(m.home);
          if (m.away) officialR32.push(m.away);
        }
      });
    }

    const consensusThreshold = totalVotes > 0 ? Math.ceil(totalVotes * 0.7) : 0;
    const underdogThreshold = totalVotes > 0 ? Math.floor(totalVotes * 0.3) : 0;
    const hasKnockoutsStarted = officialR32.length > 0;

    const validParticipants = participantsHashes
      .map((p) => {
        const part = p.data;
        if (!part) return null;
        return { part, userName: part.user || p.key || 'Anónimo' };
      })
      .filter((p): p is { part: PredictionData; userName: string } => p !== null);

    Object.keys(passCountMap).forEach((team) => {
      const passCount = passCountMap[team];
      const isConsensusFavorite = passCount >= consensusThreshold;
      const isUnderdog = passCount <= underdogThreshold;

      if (hasKnockoutsStarted) {
        const officiallyPassed = officialR32.includes(team);

        if (isConsensusFavorite && !officiallyPassed) {
          disappointmentsMap[team] = validParticipants
            .filter((p) => p.part.r32 && p.part.r32.flat().includes(team))
            .map((p) => p.userName);
        }

        if (isUnderdog && officiallyPassed) {
          darkHorsesMap[team] = validParticipants
            .filter((p) => p.part.r32 && p.part.r32.flat().includes(team))
            .map((p) => p.userName);
        }
      }
    });

    const getSimilarity = (partA: PredictionData, partB: PredictionData) => {
      let totalMatches = 0;
      let possibleMatches = 0;

      const compareRound = (
        arr1: (TeamPair | string)[] | undefined,
        arr2: (TeamPair | string)[] | undefined,
      ) => {
        if (!arr1 || !arr2) return;
        const flat1 = arr1.flat().filter((t): t is string => isRealSlot(t));
        const flat2 = arr2.flat().filter((t): t is string => isRealSlot(t));
        possibleMatches += flat2.length;
        flat1.forEach((t) => {
          if (flat2.includes(t)) totalMatches++;
        });
      };

      compareRound(partA.r32, partB.r32);
      compareRound(partA.r16, partB.r16);
      compareRound(partA.qf, partB.qf);
      compareRound(partA.sf, partB.sf);
      compareRound(partA.final, partB.final);

      if (partA.champion && partB.champion && !partA.champion.includes('º')) {
        possibleMatches += 2;
        if (partA.champion === partB.champion) totalMatches += 2;
      }

      if (possibleMatches > 0) return Math.round((totalMatches / possibleMatches) * 100);
      return 0;
    };

    const twinsListRaw: { name: string; usersArray: string[]; overridePercentage: number }[] = [];
    for (let i = 0; i < validParticipants.length; i++) {
      for (let j = i + 1; j < validParticipants.length; j++) {
        const pA = validParticipants[i];
        const pB = validParticipants[j];
        const sim = getSimilarity(pA.part, pB.part);
        twinsListRaw.push({
          name: `${pA.userName} 🤝 ${pB.userName}`,
          usersArray: [pA.userName, pB.userName],
          overridePercentage: sim,
        });
      }
    }
    twinsListRaw.sort((a, b) => b.overridePercentage - a.overridePercentage);

    const twinsList = twinsListRaw.map((t): StatEntry => [
      t.name,
      t.usersArray,
      t.overridePercentage,
    ]);

    const getTop = (map: Record<string, string[]>, limit = 999): StatEntry[] => {
      return Object.entries(map)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, limit);
    };

    return {
      total: totalVotes,
      scorers: getTop(scorersMap),
      champions: getTop(championsMap),
      finals: getTop(finalsMap),
      semis: getTop(semisMap),
      runnerups: getTop(runnerupMap),
      disappointments: getTop(disappointmentsMap).filter((d) => d[1].length > 0),
      thirds: getTop(thirdsMap),
      darkHorses: getTop(darkHorsesMap),
      kings: getTop(kingsMap),
      twins: twinsList,
    };
  }, [participantsHashes, allGames]);

  return { stats, loading };
}
