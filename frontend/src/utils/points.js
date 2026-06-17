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

export function calculatePoints(participant, official, state) {
  const { officialPoints, groupOdds, manualTiebreakers, allGames, nameToIdMap } = state;
  let points = { r1: 0, r32: 0, r16: 0, qf: 0, sf: 0, finals: 0, scorer: 0, total: 0, log: [], exactMatches: {}, passedTeams: {} };

  // Helper arrays
  const getTeams = (arrOfArrays) => arrOfArrays ? arrOfArrays.flat().filter(Boolean) : [];

  const offR32 = (official && official.groups) ? Object.values(official.groups).map(g => [g[0], g[1]]).flat().concat(official.thirds || []) : [];
  const offR16 = official ? getTeams(official.r16) : [];
  const offQF = official ? getTeams(official.qf) : [];
  const offSF = official ? getTeams(official.sf) : [];
  const offFinal = official ? (official.final || []) : [];

  // Helper to check if a team has played at least 1 match
  const hasPlayed = (teamName) => {
    if (!teamName) return false;
    if (offR32 && offR32.includes(teamName)) return true;
    if (!groupOdds) return false;
    for (const g of Object.keys(groupOdds)) {
      const found = groupOdds[g].find(t => t.name === teamName);
      if (found) {
        const safeKey = teamName.replace(/[.#$\[\]]/g, "");
        const stats = (officialPoints && officialPoints[g] && officialPoints[g][safeKey]);
        const mp = (typeof stats === 'object' && stats !== null) ? (stats.mp || 0) : 0;
        return mp > 0;
      }
    }
    return false;
  };

  // Virtual groups tracking
  const virtualGroups = {};
  let allVirtualThirds = [];
  if (officialPoints && groupOdds) {
    Object.keys(groupOdds).forEach(g => {
      const teamsInGroup = groupOdds[g].map(t => {
        const safeKey = t.name.replace(/[.#$\[\]]/g, "");
        const stats = (officialPoints[g] && officialPoints[g][safeKey]) || { pts: 0, diff: 0, gls: 0, mp: 0 };
        return { name: t.name, stats: stats };
      });

      const totalMatchesPlayed = teamsInGroup.reduce((sum, t) => sum + (t.stats.mp || 0), 0);

      if (totalMatchesPlayed > 0) {
        teamsInGroup.sort((a, b) => compareTeams(a, b, g, officialPoints, manualTiebreakers, allGames, nameToIdMap));
        virtualGroups[g] = [
          hasPlayed(teamsInGroup[0].name) ? teamsInGroup[0].name : null,
          hasPlayed(teamsInGroup[1].name) ? teamsInGroup[1].name : null,
          hasPlayed(teamsInGroup[2].name) ? teamsInGroup[2].name : null
        ];
        if (hasPlayed(teamsInGroup[2].name)) {
          allVirtualThirds.push({ name: teamsInGroup[2].name, stats: teamsInGroup[2].stats });
        }
      }
    });
  }

  // Calculate best 8 virtual thirds
  allVirtualThirds.sort((a, b) => {
    if (b.stats.pts !== a.stats.pts) return b.stats.pts - a.stats.pts;
    if (b.stats.diff !== a.stats.diff) return b.stats.diff - a.stats.diff;
    return b.stats.gls - a.stats.gls;
  });
  const bestVirtualThirds = allVirtualThirds.slice(0, 8).map(t => t.name);

  // 1. Group Stage / R32
  if (participant.groups) {
    Object.keys(participant.groups).forEach(g => {
      const p1 = participant.groups[g][0];
      const p2 = participant.groups[g][1];
      const p3 = participant.groups[g][2];

      const o1 = (official && official.groups && official.groups[g]) ? official.groups[g][0] : null;
      const o2 = (official && official.groups && official.groups[g]) ? official.groups[g][1] : null;
      const o3 = (official && official.groups && official.groups[g]) ? official.groups[g][2] : null;

      const v1 = virtualGroups[g] ? virtualGroups[g][0] : null;
      const v2 = virtualGroups[g] ? virtualGroups[g][1] : null;
      const v3 = virtualGroups[g] ? virtualGroups[g][2] : null;

      const actualO1 = (o1 && !o1.includes("º")) ? o1 : v1;
      const actualO2 = (o2 && !o2.includes("º")) ? o2 : v2;
      const actualO3 = (o3 && !o3.includes("º")) ? o3 : v3;

      const isPassed = (team) => {
        if (offR32.includes(team)) return true;
        if (!hasPlayed(team)) return false;
        if (actualO1 === team || actualO2 === team) return true;
        if (official && official.thirds && official.thirds.includes(team)) return true;
        if (bestVirtualThirds.includes(team)) return true;
        return false;
      };

      const award = (amount, stage, msg) => {
        points[stage] += amount;
        points.log.push({ stage: stage, amount: amount, msg: msg });
      };

      // P1 Guess
      let p1Passed = isPassed(p1);
      let p1Exact = actualO1 && p1 === actualO1;
      if (p1Passed && p1Exact) {
        award(20, 'r1', `Grupo ${g}: ${p1} clasificado en posición exacta (1º)`);
      } else {
        if (p1Passed) award(10, 'r1', `Grupo ${g}: ${p1} clasificado a la siguiente fase`);
        if (p1Exact) award(10, 'r1', `Grupo ${g}: ${p1} acierto posición exacta (1º)`);
      }

      // P2 Guess
      let p2Passed = isPassed(p2);
      let p2Exact = actualO2 && p2 === actualO2;
      if (p2Passed && p2Exact) {
        award(20, 'r1', `Grupo ${g}: ${p2} clasificado en posición exacta (2º)`);
      } else {
        if (p2Passed) award(10, 'r1', `Grupo ${g}: ${p2} clasificado a la siguiente fase`);
        if (p2Exact) award(10, 'r1', `Grupo ${g}: ${p2} acierto posición exacta (2º)`);
      }

      // P3 Guess
      const p3SelectedToPass = participant.thirds && participant.thirds.includes(p3);
      let p3ActuallyPassed = isPassed(p3);
      let p3Passed = p3SelectedToPass && p3ActuallyPassed;
      let p3Exact = actualO3 && p3 === actualO3;

      if (!p3ActuallyPassed || !p3SelectedToPass) {
        p3Exact = false;
      }

      if (p3Passed && p3Exact) {
        award(20, 'r1', `Grupo ${g}: ${p3} clasificado en posición exacta (Mejor 3º)`);
      } else {
        if (p3Passed) award(10, 'r1', `Grupo ${g}: ${p3} clasificado a la siguiente fase`);
        if (p3Exact) award(10, 'r1', `Grupo ${g}: ${p3} acierto posición exacta (3º)`);
      }

      points.exactMatches[g] = {
        1: p1Exact,
        2: p2Exact,
        3: p3Exact
      };
      
      points.passedTeams[p1] = isPassed(p1);
      points.passedTeams[p2] = isPassed(p2);
      points.passedTeams[p3] = p3Passed;
    });
  }

  // Remaining rounds
  if (official) {
    const award = (amount, stage, msg) => {
      points[stage] += amount;
      points.log.push({ stage: stage, amount: amount, msg: msg });
    };

    const partR16 = getTeams(participant.r16);
    partR16.forEach(t => { if (offR16.includes(t)) award(25, 'r32', `1/16: ${t} clasificado a octavos`); });

    const partQF = getTeams(participant.qf);
    partQF.forEach(t => { if (offQF.includes(t)) award(30, 'r16', `Octavos: ${t} clasificado a cuartos`); });

    const partSF = getTeams(participant.sf);
    partSF.forEach(t => { if (offSF.includes(t)) award(40, 'qf', `Cuartos: ${t} clasificado a semis`); });

    const partFinal = participant.final;
    if (partFinal) {
      partFinal.forEach(t => { if (offFinal.includes(t)) award(60, 'sf', `Semis: ${t} clasificado a la final`); });
    }

    const official1st = official.champion;
    const official2nd = official.final ? official.final.find(t => t !== official1st) : null;
    const official3rd = official.thirdPlaceWinner;
    const official4th = official.thirdPlaceMatch ? official.thirdPlaceMatch.find(t => t !== official3rd) : null;

    const part1st = participant.champion;
    const part2nd = participant.final ? participant.final.find(t => t !== part1st) : null;
    const part3rd = participant.thirdPlaceWinner;
    const part4th = participant.thirdPlaceMatch ? participant.thirdPlaceMatch.find(t => t !== part3rd) : null;

    if (part1st && part1st === official1st) award(200, 'finals', `Final: ${part1st} Campeón`);
    if (part2nd && part2nd === official2nd) award(150, 'finals', `Final: ${part2nd} Subcampeón`);
    if (part3rd && part3rd === official3rd) award(100, 'finals', `Tercer y Cuarto: ${part3rd} Tercer puesto`);
    if (part4th && part4th === official4th) award(75, 'finals', `Tercer y Cuarto: ${part4th} Cuarto puesto`);

    if (participant.scorer && official.scorer && participant.scorer === official.scorer) {
      award(100, 'scorer', `Goleador: ${participant.scorer} acertado`);
    }
  }

  points.total = points.r1 + points.r32 + points.r16 + points.qf + points.sf + points.finals + points.scorer;
  return points;
}
