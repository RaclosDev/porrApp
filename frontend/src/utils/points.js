export function compareTeams(a, b, groupName, officialPoints, manualTiebreakers, allGames, nameToIdMap) {
  const safeNameA = a.name.replace(/[.#$\[\]]/g, "");
  const safeNameB = b.name.replace(/[.#$\[\]]/g, "");

  const statsA = (officialPoints && officialPoints[groupName] && officialPoints[groupName][safeNameA]);
  const statsB = (officialPoints && officialPoints[groupName] && officialPoints[groupName][safeNameB]);

  const ptsA = (typeof statsA === 'object' && statsA !== null) ? (statsA.pts || 0) : (statsA || 0);
  const ptsB = (typeof statsB === 'object' && statsB !== null) ? (statsB.pts || 0) : (statsB || 0);

  const diffA = (typeof statsA === 'object' && statsA !== null) ? (statsA.diff || 0) : 0;
  const diffB = (typeof statsB === 'object' && statsB !== null) ? (statsB.diff || 0) : 0;

  const glsA = (typeof statsA === 'object' && statsA !== null) ? (statsA.gls || 0) : 0;
  const glsB = (typeof statsB === 'object' && statsB !== null) ? (statsB.gls || 0) : 0;

  if (ptsB !== ptsA) return ptsB - ptsA;
  if (diffB !== diffA) return diffB - diffA;
  if (glsB !== glsA) return glsB - glsA;

  // Custom manual tiebreakers from the admin (OVERRIDE ONLY FOR EXACT TIES)
  const manualA = (manualTiebreakers && manualTiebreakers[groupName] && manualTiebreakers[groupName][safeNameA]) || 0;
  const manualB = (manualTiebreakers && manualTiebreakers[groupName] && manualTiebreakers[groupName][safeNameB]) || 0;
  if (manualB !== manualA) return manualB - manualA;

  // Head-to-Head fallback
  if (allGames && nameToIdMap) {
    const idA = nameToIdMap[a.name];
    const idB = nameToIdMap[b.name];
    if (idA && idB) {
      const h2hGame = allGames.find(g =>
        (g.home_team_id === idA && g.away_team_id === idB) ||
        (g.home_team_id === idB && g.away_team_id === idA)
      );
      if (h2hGame && h2hGame.home_score !== null && h2hGame.away_score !== null && h2hGame.home_score !== "" && h2hGame.away_score !== "") {
        const scoreA = h2hGame.home_team_id === idA ? parseInt(h2hGame.home_score) : parseInt(h2hGame.away_score);
        const scoreB = h2hGame.home_team_id === idB ? parseInt(h2hGame.home_score) : parseInt(h2hGame.away_score);
        if (!isNaN(scoreA) && !isNaN(scoreB) && scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }
    }
  }

  return a.name.localeCompare(b.name);
}


