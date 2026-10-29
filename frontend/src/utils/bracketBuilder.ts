import type { GroupOdds, GroupStandings, Match } from '../types/api';

export function buildBracketData(
  officialPoints: GroupStandings,
  groupOdds: GroupOdds,
  allGames: Match[],
) {
  const points = officialPoints || {};

  const fallbackR32 = [
    ['1º Grupo E', '3º A/B/C/D/F'],
    ['1º Grupo I', '3º C/D/F/G/H'],
    ['2º Grupo A', '2º Grupo B'],
    ['1º Grupo F', '2º Grupo C'],
    ['2º Grupo K', '2º Grupo L'],
    ['1º Grupo H', '2º Grupo J'],
    ['1º Grupo D', '3º B/E/F/I/J'],
    ['1º Grupo G', '3º A/E/H/I/J'],
    ['1º Grupo C', '2º Grupo F'],
    ['2º Grupo E', '2º Grupo I'],
    ['1º Grupo A', '3º C/E/F/H/I'],
    ['1º Grupo L', '3º E/H/I/J/K'],
    ['1º Grupo J', '2º Grupo H'],
    ['2º Grupo D', '2º Grupo G'],
    ['1º Grupo B', '3º E/F/G/I/J'],
    ['1º Grupo K', '3º D/E/I/J/L'],
  ];

  const sanitizedToReal = {};
  if (groupOdds) {
    Object.values(groupOdds)
      .flat()
      .forEach((t) => {
        if (t?.name) {
          const safe = t.name.replace(/[.#$[\]]/g, '');
          sanitizedToReal[safe] = t.name;
        }
      });
  }
  const realName = (key) => sanitizedToReal[key] || key;

  const guaranteed = {};
  if (points && typeof points === 'object') {
    Object.keys(points).forEach((group) => {
      guaranteed[group] = {};
      const groupTeams = points[group];
      if (groupTeams && typeof groupTeams === 'object') {
        const sortedTeams = Object.entries(groupTeams)
          .sort((a, b) => {
            const posA = a[1]?.pos ?? 99;
            const posB = b[1]?.pos ?? 99;
            return posA - posB;
          })
          .map(([name]) => realName(name));
        if (sortedTeams.length >= 1) guaranteed[group]['1'] = sortedTeams[0];
        if (sortedTeams.length >= 2) guaranteed[group]['2'] = sortedTeams[1];
      }
    });
  }

  const isKnockoutMatch = (m) => {
    if (!m) return false;
    if (m.groupName && m.groupName !== '-' && m.groupName.trim() !== '') return false;
    const r = (m.round || '').toLowerCase().trim();
    if (r === 'group' || r.startsWith('group') || r.includes('grupo') || r.includes('jornada'))
      return false;
    return true;
  };

  const matchRound = (m, ...keys) => {
    if (!m || !m.round || !isKnockoutMatch(m)) return false;
    const r = m.round.toLowerCase();
    return keys.some((k) => r === k || r.includes(k));
  };

  const safeGames = Array.isArray(allGames) ? allGames : [];

  const explicitR32 = safeGames
    .filter((m) => matchRound(m, 'r32', '32', '16avo'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const allR16 = safeGames
    .filter((m) => matchRound(m, 'r16', 'octav'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const realR32Matches = explicitR32.length > 0 ? explicitR32.slice(0, 16) : allR16.slice(0, 16);

  const opponentMap = {};
  realR32Matches.forEach((m) => {
    const h = m.home,
      a = m.away;
    if (h && a && h !== 'Por definir' && a !== 'Por definir') {
      opponentMap[h] = a;
      opponentMap[a] = h;
    }
  });

  const r32WinnerOf = {};
  realR32Matches.forEach((m) => {
    if (m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const winnerName = m.winner
        ? m.winner
        : m.home_score > m.away_score
          ? m.home
          : m.away_score > m.home_score
            ? m.away
            : null;
      if (winnerName) {
        const winnerObj = { name: winnerName, isProvisional: isProv };
        r32WinnerOf[m.home] = winnerObj;
        r32WinnerOf[m.away] = winnerObj;
      }
    }
  });

  let r32 = fallbackR32.map((match) =>
    match.map((teamName) => {
      if (typeof teamName === 'string' && teamName.includes('º Grupo ')) {
        const parts = teamName.split(' ');
        const pos = parts[0].replace('º', '');
        const grp = parts[2];
        return guaranteed[grp]?.[pos] || teamName;
      }
      return teamName;
    }),
  );

  r32 = r32.map((match) => {
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

  const r16 = Array(8)
    .fill(null)
    .map(() => [null, null]);
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

  const matchTeamNames = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    if ((a === 'EEUU' && b === 'Estados Unidos') || (a === 'Estados Unidos' && b === 'EEUU'))
      return true;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  };

  const realQF = safeGames
    .filter((m) => matchRound(m, 'qf', 'quarter', 'cuart'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const realSF = safeGames
    .filter((m) => matchRound(m, 'sf', 'semi'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const realFinal = safeGames.filter(
    (m) =>
      matchRound(m, 'final') &&
      !matchRound(m, 'semi', 'quarter', 'octav', 'third', 'tercer', '3rd', '3er'),
  );
  const realThird = safeGames.filter((m) => matchRound(m, 'third', 'tercer', '3rd', '3er'));
  const cleanName = (n) => (!n || n === 'Por definir' || n === '???' ? null : n);

  const qf =
    realQF.length > 0
      ? realQF.map((m) => [cleanName(m.home), cleanName(m.away)])
      : Array(4).fill([null, null]);
  const sf =
    realSF.length > 0
      ? realSF.map((m) => [cleanName(m.home), cleanName(m.away)])
      : Array(2).fill([null, null]);
  const final_ =
    realFinal.length > 0
      ? [cleanName(realFinal[0].home), cleanName(realFinal[0].away)]
      : [null, null];
  const thirdPlaceMatch =
    realThird.length > 0
      ? [cleanName(realThird[0].home), cleanName(realThird[0].away)]
      : [null, null];

  const findWinner = (t1, t2) => {
    const n1 = typeof t1 === 'object' && t1 ? t1.name : t1;
    const n2 = typeof t2 === 'object' && t2 ? t2.name : t2;
    if (!n1 || !n2 || n1 === 'Por definir' || n2 === 'Por definir') return null;
    const m = safeGames.find(
      (g) =>
        isKnockoutMatch(g) &&
        ((matchTeamNames(g.home, n1) && matchTeamNames(g.away, n2)) ||
          (matchTeamNames(g.home, n2) && matchTeamNames(g.away, n1))),
    );
    if (m && m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const wName = m.winner
        ? m.winner
        : m.home_score > m.away_score
          ? m.home
          : m.away_score > m.home_score
            ? m.away
            : null;
      if (wName) return { name: wName, isProvisional: isProv };
    }
    return null;
  };

  const findLoser = (t1, t2) => {
    const n1 = typeof t1 === 'object' && t1 ? t1.name : t1;
    const n2 = typeof t2 === 'object' && t2 ? t2.name : t2;
    if (!n1 || !n2 || n1 === 'Por definir' || n2 === 'Por definir') return null;
    const m = safeGames.find(
      (g) =>
        isKnockoutMatch(g) &&
        ((matchTeamNames(g.home, n1) && matchTeamNames(g.away, n2)) ||
          (matchTeamNames(g.home, n2) && matchTeamNames(g.away, n1))),
    );
    if (m && m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const wName = m.winner
        ? m.winner
        : m.home_score > m.away_score
          ? m.home
          : m.away_score > m.home_score
            ? m.away
            : null;
      if (wName) {
        const lName = matchTeamNames(wName, n1) ? n2 : n1;
        return { name: lName, isProvisional: isProv };
      }
    }
    return null;
  };

  for (let i = 0; i < 8; i += 2) {
    const idx = Math.floor(i / 2);
    if (!qf[idx][0]) qf[idx][0] = findWinner(r16[i][0], r16[i][1]);
    if (!qf[idx][1]) qf[idx][1] = findWinner(r16[i + 1][0], r16[i + 1][1]);
  }
  for (let i = 0; i < 4; i += 2) {
    const idx = Math.floor(i / 2);
    if (!sf[idx][0]) sf[idx][0] = findWinner(qf[i][0], qf[i][1]);
    if (!sf[idx][1]) sf[idx][1] = findWinner(qf[i + 1][0], qf[i + 1][1]);
  }
  if (!final_[0]) final_[0] = findWinner(sf[0][0], sf[0][1]);
  if (!final_[1]) final_[1] = findWinner(sf[1][0], sf[1][1]);

  if (!thirdPlaceMatch[0]) thirdPlaceMatch[0] = findLoser(sf[0][0], sf[0][1]);
  if (!thirdPlaceMatch[1]) thirdPlaceMatch[1] = findLoser(sf[1][0], sf[1][1]);

  let champion = findWinner(final_[0], final_[1]);
  let thirdPlaceWinner = findWinner(thirdPlaceMatch[0], thirdPlaceMatch[1]);

  if (realFinal.length > 0) {
    const rf = realFinal[0];
    if (rf.home_score != null && rf.away_score != null) {
      const isProv = !rf.finished;
      const wName = rf.winner
        ? rf.winner
        : rf.home_score > rf.away_score
          ? rf.home
          : rf.away_score > rf.home_score
            ? rf.away
            : null;
      if (wName) champion = { name: wName, isProvisional: isProv };
    }
  }

  if (realThird.length > 0) {
    const rt = realThird[0];
    if (rt.home_score != null && rt.away_score != null) {
      const isProv = !rt.finished;
      const wName = rt.winner
        ? rt.winner
        : rt.home_score > rt.away_score
          ? rt.home
          : rt.away_score > rt.home_score
            ? rt.away
            : null;
      if (wName) thirdPlaceWinner = { name: wName, isProvisional: isProv };
    }
  }

  return {
    r32,
    r16,
    qf,
    sf,
    final: final_,
    champion: champion,
    thirdPlaceMatch: thirdPlaceMatch,
    thirdPlaceWinner: thirdPlaceWinner,
  };
}
