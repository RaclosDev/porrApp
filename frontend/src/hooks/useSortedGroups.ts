import { useMemo } from 'react';
import { teamKey } from '../utils/teamKey';
import { useTournamentData } from '../context/leagueData';
import type { TeamOdds, TeamStanding } from '../types/api';

type TeamWithStats = TeamOdds & { stats: TeamStanding };

const EMPTY_STANDING: TeamStanding = { pts: 0, diff: 0, gls: 0, mp: 0, fp: 0, pos: 0, status: 0 };

/**
 * Equipos de cada grupo con sus estadísticas oficiales, ordenados por la posición
 * que da el backend o, si aún no la hay, por puntos, diferencia, goles y nombre.
 */
export function useSortedGroups(): Record<string, TeamWithStats[]> {
  const { groupOdds, groupStandings: officialPoints } = useTournamentData();

  return useMemo(() => {
    const res: Record<string, TeamWithStats[]> = {};
    if (!groupOdds) return res;
    Object.entries(groupOdds).forEach(([groupName, teams]) => {
      const teamsWithStats = (teams || []).map((t) => {
        const safeKey = teamKey(t.name);
        return { ...t, stats: officialPoints?.[groupName]?.[safeKey] || EMPTY_STANDING };
      });

      // El puesto lo calcula el backend con todos los desempates; sin él, todo está a cero.
      const rank = (t: TeamWithStats) => t.stats.pos || Infinity;
      teamsWithStats.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          b.stats.pts - a.stats.pts ||
          b.stats.diff - a.stats.diff ||
          b.stats.gls - a.stats.gls ||
          a.name.localeCompare(b.name),
      );
      res[groupName] = teamsWithStats;
    });
    return res;
  }, [groupOdds, officialPoints]);
}
