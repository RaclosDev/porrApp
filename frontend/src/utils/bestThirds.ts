import type { GroupStandings, TeamStanding } from '../types/api';

interface ThirdPlaceRow extends TeamStanding {
  group: string;
  name: string;
}

/**
 * Terceros de cada grupo, del mejor al peor. El puesto dentro del grupo (`pos`) lo calcula el
 * backend con todos los desempates; aquí solo se comparan terceros entre sí, con los mismos
 * criterios que `GroupTiebreaker.THIRD_PLACE_ORDER`: puntos, diferencia de goles, goles a favor,
 * fair play y nombre.
 */
export function rankBestThirds(officialPoints: GroupStandings | null | undefined): ThirdPlaceRow[] {
  const thirds: ThirdPlaceRow[] = [];
  Object.entries(officialPoints ?? {}).forEach(([group, teams]) => {
    const third = Object.entries(teams).find(([, stats]) => stats?.pos === 3);
    if (third) thirds.push({ group, name: third[0], ...third[1] });
  });

  return thirds.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.diff - a.diff ||
      b.gls - a.gls ||
      (b.fp || 0) - (a.fp || 0) ||
      a.name.localeCompare(b.name),
  );
}
