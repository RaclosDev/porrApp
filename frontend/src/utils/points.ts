export function compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap) {
  const safeNameA = a.name.replace(/[.#$[\]]/g, '');
  const safeNameB = b.name.replace(/[.#$[\]]/g, '');

  const statsA =
    officialPoints && officialPoints[groupName] && officialPoints[groupName][safeNameA];
  const statsB =
    officialPoints && officialPoints[groupName] && officialPoints[groupName][safeNameB];

  const ptsA = typeof statsA === 'object' && statsA !== null ? statsA.pts || 0 : statsA || 0;
  const ptsB = typeof statsB === 'object' && statsB !== null ? statsB.pts || 0 : statsB || 0;

  const diffA = typeof statsA === 'object' && statsA !== null ? statsA.diff || 0 : 0;
  const diffB = typeof statsB === 'object' && statsB !== null ? statsB.diff || 0 : 0;

  const glsA = typeof statsA === 'object' && statsA !== null ? statsA.gls || 0 : 0;
  const glsB = typeof statsB === 'object' && statsB !== null ? statsB.gls || 0 : 0;

  const fpA = typeof statsA === 'object' && statsA !== null ? statsA.fp || 0 : 0;
  const fpB = typeof statsB === 'object' && statsB !== null ? statsB.fp || 0 : 0;

  // Puntos totales
  if (ptsB !== ptsA) return ptsB - ptsA;

  // Head-to-Head calculations
  let h2hPtsA = 0,
    h2hPtsB = 0;
  let h2hDiffA = 0,
    h2hDiffB = 0;
  let h2hGlsA = 0,
    h2hGlsB = 0;

  if (allGames && nameToIdMap) {
    const idA = nameToIdMap[a.name];
    const idB = nameToIdMap[b.name];
    if (idA && idB) {
      const h2hGame = allGames.find(
        (g) =>
          (g.home_team_id === idA && g.away_team_id === idB) ||
          (g.home_team_id === idB && g.away_team_id === idA),
      );
      if (
        h2hGame &&
        h2hGame.home_score !== null &&
        h2hGame.away_score !== null &&
        h2hGame.home_score !== '' &&
        h2hGame.away_score !== ''
      ) {
        const scoreA =
          h2hGame.home_team_id === idA
            ? parseInt(h2hGame.home_score)
            : parseInt(h2hGame.away_score);
        const scoreB =
          h2hGame.home_team_id === idB
            ? parseInt(h2hGame.home_score)
            : parseInt(h2hGame.away_score);
        if (!isNaN(scoreA) && !isNaN(scoreB)) {
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

  // 7. Puntos de Fair Play (menos negativos es mejor)
  if (fpB !== fpA) return fpB - fpA;

  // 8. Sorteo / Orden alfabético
  return a.name.localeCompare(b.name);
}
