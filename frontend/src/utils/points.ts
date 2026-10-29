import type { GroupStandings, Match } from '../types/api';

interface RankedTeam {
  name: string;
}

export function compareTeams(
  a: RankedTeam,
  b: RankedTeam,
  groupName: string,
  officialPoints: GroupStandings | null | undefined,
  allGames: Match[] | null | undefined,
  nameToIdMap: Record<string, number> | null | undefined,
): number {
  const safeNameA = a.name.replace(/[.#$[\]]/g, '');
  const safeNameB = b.name.replace(/[.#$[\]]/g, '');

  const statsA = officialPoints?.[groupName]?.[safeNameA];
  const statsB = officialPoints?.[groupName]?.[safeNameB];

  const ptsA = statsA?.pts || 0;
  const ptsB = statsB?.pts || 0;

  const diffA = statsA?.diff || 0;
  const diffB = statsB?.diff || 0;

  const glsA = statsA?.gls || 0;
  const glsB = statsB?.gls || 0;

  const fpA = statsA?.fp || 0;
  const fpB = statsB?.fp || 0;

  // Puntos totales
  if (ptsB !== ptsA) return ptsB - ptsA;

  // Head-to-Head calculations
  let h2hPtsA = 0,
    h2hPtsB = 0;
  let h2hDiffA = 0,
    h2hDiffB = 0;
  let h2hGlsA = 0,
    h2hGlsB = 0;

  if (Array.isArray(allGames) && nameToIdMap) {
    const idA = nameToIdMap[a.name];
    const idB = nameToIdMap[b.name];
    if (idA && idB) {
      const h2hGame = allGames.find(
        (g) =>
          (g.home_team_id === idA && g.away_team_id === idB) ||
          (g.home_team_id === idB && g.away_team_id === idA),
      );
      if (h2hGame && h2hGame.home_score != null && h2hGame.away_score != null) {
        const scoreA = h2hGame.home_team_id === idA ? h2hGame.home_score : h2hGame.away_score;
        const scoreB = h2hGame.home_team_id === idB ? h2hGame.home_score : h2hGame.away_score;
        if (scoreA > scoreB) h2hPtsA += 3;
        else if (scoreB > scoreA) h2hPtsB += 3;
        else {
          h2hPtsA += 1;
          h2hPtsB += 1;
        }

        h2hDiffA += scoreA - scoreB;
        h2hDiffB += scoreB - scoreA;

        h2hGlsA += scoreA;
        h2hGlsB += scoreB;
      }
    }
  }

  // Puntos en enfrentamientos directos (Head-to-Head)
  if (h2hPtsB !== h2hPtsA) return h2hPtsB - h2hPtsA;

  // Diferencia de goles en enfrentamientos directos
  if (h2hDiffB !== h2hDiffA) return h2hDiffB - h2hDiffA;

  // Goles marcados en enfrentamientos directos
  if (h2hGlsB !== h2hGlsA) return h2hGlsB - h2hGlsA;

  // 5. Diferencia de goles (General)
  if (diffB !== diffA) return diffB - diffA;

  // 6. Goles marcados (General)
  if (glsB !== glsA) return glsB - glsA;

  // 7. Puntos de Fair Play / Conducta de equipo (menos puntos negativos es mejor)
  if (fpB !== fpA) return fpB - fpA;

  // 8. Sorteo / Orden alfabético
  return a.name.localeCompare(b.name);
}
