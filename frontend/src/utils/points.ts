import type { GroupStandings, Match } from '../types/api';

interface RankedTeam {
  name: string;
}

// Desempate: puntos, enfrentamiento directo (puntos, diferencia, goles), diferencia y goles
// generales, fair play (menos negativos gana) y nombre.
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

  if (ptsB !== ptsA) return ptsB - ptsA;

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

  if (h2hPtsB !== h2hPtsA) return h2hPtsB - h2hPtsA;

  if (h2hDiffB !== h2hDiffA) return h2hDiffB - h2hDiffA;

  if (h2hGlsB !== h2hGlsA) return h2hGlsB - h2hGlsA;

  if (diffB !== diffA) return diffB - diffA;

  if (glsB !== glsA) return glsB - glsA;

  if (fpB !== fpA) return fpB - fpA;

  return a.name.localeCompare(b.name);
}
