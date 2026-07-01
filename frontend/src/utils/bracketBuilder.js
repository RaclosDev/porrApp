export function buildBracketData(officialPoints, groupOdds, allGames) {
  if (!officialPoints || Object.keys(officialPoints).length === 0) return null;

  const fallbackR32 = [
    ['1º Grupo E','3º A/B/C/D/F'],['1º Grupo I','3º C/D/F/G/H'],
    ['2º Grupo A','2º Grupo B'],['1º Grupo F','2º Grupo C'],
    ['2º Grupo K','2º Grupo L'],['1º Grupo H','2º Grupo J'],
    ['1º Grupo D','3º B/E/F/I/J'],['1º Grupo G','3º A/E/H/I/J'],
    ['1º Grupo C','2º Grupo F'],['2º Grupo E','2º Grupo I'],
    ['1º Grupo A','3º C/E/F/H/I'],['1º Grupo L','3º E/H/I/J/K'],
    ['1º Grupo J','2º Grupo H'],['2º Grupo D','2º Grupo G'],
    ['1º Grupo B','3º E/F/G/I/J'],['1º Grupo K','3º D/E/I/J/L'],
  ];

  const sanitizedToReal = {};
  if (groupOdds) {
    Object.values(groupOdds).flat().forEach(t => {
      if (t?.name) {
        const safe = t.name.replace(/[.#$[\]]/g, '');
        sanitizedToReal[safe] = t.name;
      }
    });
  }
  const realName = (key) => sanitizedToReal[key] || key;

  const guaranteed = {};
  Object.keys(officialPoints).forEach(group => {
    guaranteed[group] = {};
    const teams = Object.keys(officialPoints[group]);
    if (teams.length >= 1) guaranteed[group]['1'] = realName(teams[0]);
    if (teams.length >= 2) guaranteed[group]['2'] = realName(teams[1]);
  });

  const allR16 = (allGames || []).filter(m => m.round === 'r16').sort((a, b) => new Date(a.date) - new Date(b.date));
  const realR32Matches = allR16.slice(0, 16);

  const opponentMap = {};
  realR32Matches.forEach(m => {
    const h = m.home, a = m.away;
    if (h && a && h !== 'Por definir' && a !== 'Por definir') {
      opponentMap[h] = a;
      opponentMap[a] = h;
    }
  });

  const r32WinnerOf = {};
  realR32Matches.forEach(m => {
    if (m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const winnerName = m.winner ? m.winner :
                         m.home_score > m.away_score ? m.home :
                         m.away_score > m.home_score ? m.away : null;
      if (winnerName) {
        const winnerObj = { name: winnerName, isProvisional: isProv };
        r32WinnerOf[m.home] = winnerObj;
        r32WinnerOf[m.away] = winnerObj;
      }
    }
  });

  let r32 = fallbackR32.map(match =>
    match.map(teamName => {
      if (typeof teamName === 'string' && teamName.includes('º Grupo ')) {
        const parts = teamName.split(' ');
        const pos = parts[0].replace('º', '');
        const grp = parts[2];
        return guaranteed[grp]?.[pos] || teamName;
      }
      return teamName;
    })
  );

  r32 = r32.map(match => {
    return match.map((teamName, idx) => {
      if (typeof teamName === 'string' && teamName.startsWith('3º ')) {
        const otherTeam = match[idx === 0 ? 1 : 0];
        if (otherTeam && typeof otherTeam === 'string' && !otherTeam.includes('º')) {
          const realOpponent = opponentMap[otherTeam];
          if (realOpponent) return realOpponent;
        }
      }
      return teamName;
    });
  });

  const r16 = Array(8).fill(null).map(() => [null, null]);
  for (let i = 0; i < 16; i += 2) {
    const r16Idx = Math.floor(i / 2);
    const homeTeam = r32[i][0];
    const awayTeam = r32[i + 1][0];

    if (homeTeam && !homeTeam.includes('º')) {
      const winner = r32WinnerOf[homeTeam];
      if (winner) r16[r16Idx][0] = winner;
    }
    if (awayTeam && !awayTeam.includes('º')) {
      const winner = r32WinnerOf[awayTeam];
      if (winner) r16[r16Idx][1] = winner;
    }
  }

  const realQF = (allGames || []).filter(m => m.round === 'qf').sort((a, b) => new Date(a.date) - new Date(b.date));
  const realSF = (allGames || []).filter(m => m.round === 'sf').sort((a, b) => new Date(a.date) - new Date(b.date));
  const realFinal = (allGames || []).filter(m => m.round === 'final');
  const realThird = (allGames || []).filter(m => m.round === 'third');
  const cleanName = (n) => (!n || n === 'Por definir') ? null : n;

  const qf = realQF.length > 0
    ? realQF.map(m => [cleanName(m.home), cleanName(m.away)])
    : Array(4).fill([null, null]);
  const sf = realSF.length > 0
    ? realSF.map(m => [cleanName(m.home), cleanName(m.away)])
    : Array(2).fill([null, null]);
  const final_ = realFinal.length > 0
    ? [cleanName(realFinal[0].home), cleanName(realFinal[0].away)]
    : [null, null];
  const thirdPlaceMatch = realThird.length > 0
    ? [cleanName(realThird[0].home), cleanName(realThird[0].away)]
    : [null, null];

  const findWinner = (t1, t2) => {
    const n1 = typeof t1 === 'object' && t1 ? t1.name : t1;
    const n2 = typeof t2 === 'object' && t2 ? t2.name : t2;
    if (!n1 || !n2 || n1 === 'Por definir' || n2 === 'Por definir') return null;
    const m = (allGames || []).find(g => (g.home === n1 && g.away === n2) || (g.home === n2 && g.away === n1));
    if (m && m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const wName = m.winner ? m.winner : 
                    m.home_score > m.away_score ? m.home : 
                    (m.away_score > m.home_score ? m.away : null);
      if (wName) return { name: wName, isProvisional: isProv };
    }
    return null;
  };

  for (let i = 0; i < 8; i += 2) {
    const idx = Math.floor(i / 2);
    if (!qf[idx][0]) qf[idx][0] = findWinner(r16[i][0], r16[i][1]);
    if (!qf[idx][1]) qf[idx][1] = findWinner(r16[i+1][0], r16[i+1][1]);
  }
  for (let i = 0; i < 4; i += 2) {
    const idx = Math.floor(i / 2);
    if (!sf[idx][0]) sf[idx][0] = findWinner(qf[i][0], qf[i][1]);
    if (!sf[idx][1]) sf[idx][1] = findWinner(qf[i+1][0], qf[i+1][1]);
  }
  if (!final_[0]) final_[0] = findWinner(sf[0][0], sf[0][1]);
  if (!final_[1]) final_[1] = findWinner(sf[1][0], sf[1][1]);

  let champion = findWinner(final_[0], final_[1]);

  return {
    r32,
    r16,
    qf,
    sf,
    final: final_,
    champion: champion,
    thirdPlaceMatch: thirdPlaceMatch,
  };
}
