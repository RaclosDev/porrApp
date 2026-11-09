import type { GroupStandings, TeamStanding } from '../types/api';

interface ThirdPlaceRow extends TeamStanding {
  group: string;
  name: string;
}

/**
 * Terceros de cada grupo, del mejor al peor. El puesto dentro del grupo (`pos`) y el puesto entre
 * los terceros (`third`) los calcula el backend con el reglamento del torneo (`GroupTiebreaker`):
 * el de la FIFA y el de la UEFA no ordenan igual a los terceros. Si `third` no llega, se ordenan
 * con los criterios de la FIFA: puntos, diferencia de goles, goles a favor, fair play y nombre.
 */
export function rankBestThirds(officialPoints: GroupStandings | null | undefined): ThirdPlaceRow[] {
  const thirds: ThirdPlaceRow[] = [];
  Object.entries(officialPoints ?? {}).forEach(([group, teams]) => {
    const third = Object.entries(teams).find(([, stats]) => stats?.pos === 3);
    if (third) thirds.push({ group, name: third[0], ...third[1] });
  });

  const rank = (t: ThirdPlaceRow) => t.third || Number.MAX_SAFE_INTEGER;
  return thirds.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.pts - a.pts ||
      b.diff - a.diff ||
      b.gls - a.gls ||
      (b.fp || 0) - (a.fp || 0) ||
      a.name.localeCompare(b.name),
  );
}
