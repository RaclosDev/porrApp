import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { compareTeams } from '../utils/points';
import type { TeamOdds, TeamStanding } from '../types/api';

export type TeamWithStats = TeamOdds & { stats: TeamStanding };

const EMPTY_STANDING: TeamStanding = { pts: 0, diff: 0, gls: 0, mp: 0, fp: 0, pos: 0, status: 0 };

/**
 * Equipos de cada grupo con sus estadísticas oficiales, ordenados por la posición
 * que da el backend o, si aún no la hay, por los criterios de desempate.
 */
export function useSortedGroups(): Record<string, TeamWithStats[]> {
  const { groupOdds, officialPoints, allGames, nameToIdMap } = useAppContext();

  return useMemo(() => {
    const res: Record<string, TeamWithStats[]> = {};
    if (!groupOdds) return res;
    Object.entries(groupOdds).forEach(([groupName, teams]) => {
      const teamsWithStats = (teams || []).map((t) => {
        const safeKey = t.name.replace(/[.#$[\]]/g, '');
        return { ...t, stats: officialPoints?.[groupName]?.[safeKey] || EMPTY_STANDING };
      });

      teamsWithStats.sort((a, b) => {
        if (a.stats.pos && b.stats.pos) return a.stats.pos - b.stats.pos;
        return compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap);
      });
      res[groupName] = teamsWithStats;
    });
    return res;
  }, [groupOdds, officialPoints, allGames, nameToIdMap]);
}
