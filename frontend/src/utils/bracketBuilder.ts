import type { GroupOdds, GroupStandings, Match } from '../types/api';
import { alignOfficialRound, nextPools } from './officialBracketLayout';

/** Equipo clasificado según el marcador; provisional si el partido no ha terminado. */
export type ProvisionalTeam = {
  name: string;
  isProvisional: boolean;
};

/** Hueco del cuadro: nombre conocido, ganador calculado o vacío. */
export type BracketSlot = string | ProvisionalTeam | null;

/** Ganador del partido (oficial o, si va en juego, el que va por delante). */
export function matchWinner(m: Match): string | null {
  if (m.winner) return m.winner;
  if (m.home_score == null || m.away_score == null) return null;
  if (m.home_score > m.away_score) return m.home;
  if (m.away_score > m.home_score) return m.away;
  return null;
}

/** Partido de eliminatorias (no de fase de grupos ni de liga). */
export const isKnockoutMatch = (m: Match | null | undefined) => {
  if (!m) return false;
  if (m.groupName && m.groupName !== '-' && m.groupName.trim() !== '') return false;
  const r = (m.round || '').toLowerCase().trim();
  if (r === 'group' || r.startsWith('group') || r.includes('grupo') || r.includes('jornada'))
    return false;
  return true;
};

/** Mismo equipo aunque cambien mayúsculas o el alias de EE. UU. */
export const matchTeamNames = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if ((a === 'EEUU' && b === 'Estados Unidos') || (a === 'Estados Unidos' && b === 'EEUU'))
    return true;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
};

/** El partido pertenece a la ronda del hueco (índice del lienzo o hueco central). */
export const isMatchInRound = (match: Match, roundIndex: number | string | undefined) => {
  if (roundIndex === undefined) return true;
  if (!isKnockoutMatch(match)) return false;
  const r = (match.round || '').toLowerCase();
  if (roundIndex === 0) return r === 'r32' || r === '32' || r.includes('32') || r.includes('16avo');
  if (roundIndex === 1) return r === 'r16' || r === '16' || r.includes('16') || r.includes('octav');
  if (roundIndex === 2) return r === 'qf' || r.includes('quart') || r.includes('cuart');
  if (roundIndex === 3) return r === 'sf' || r.includes('semi') || r.includes('semis');
  if (roundIndex === 'final')
    return (
      r.includes('final') &&
      !['semi', 'quarter', 'cuart', 'octav', 'third', 'tercer', '3rd', '3er', '16avo'].some(
        (other) => r.includes(other),
      )
    );
  if (roundIndex === 'thirdPlaceMatch')
    return r === 'third' || r.includes('tercer') || r.includes('3rd') || r.includes('3er');
  return true;
};

/** Próximo partido de eliminatorias sin jugar (el que se destaca en el cuadro). */
export const nextKnockoutMatch = (games: Match[] | null | undefined): Match | null => {
  if (!games || games.length === 0) return null;
  const pending = games
    .filter((g) => g && isKnockoutMatch(g) && !g.finished && !g.winner && g.home_score == null)
    .sort(
      (a, b) => new Date(a.date || Infinity).getTime() - new Date(b.date || Infinity).getTime(),
    );
  return pending[0] || null;
};

export const slotName = (slot: BracketSlot | undefined): string | null => {
  if (slot == null) return null;
  return typeof slot === 'string' ? slot : slot.name;
};

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

  const sanitizedToReal: Record<string, string> = {};
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
  const realName = (key: string) => sanitizedToReal[key] || key;

  const guaranteed: Record<string, Record<string, string>> = {};
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

  const matchRound = (m: Match, ...keys: string[]) => {
    if (!m || !m.round || !isKnockoutMatch(m)) return false;
    const r = m.round.toLowerCase();
    return keys.some((k) => r === k || r.includes(k));
  };

  const safeGames = Array.isArray(allGames) ? allGames : [];

  const explicitR32 = safeGames
    .filter((m) => matchRound(m, 'r32', '32', '16avo'))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  const allR16 = safeGames
    .filter((m) => matchRound(m, 'r16', 'octav'))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  const realR32Matches = explicitR32;

  const opponentMap: Record<string, string> = {};
  realR32Matches.forEach((m) => {
    const h = m.home,
      a = m.away;
    if (h && a && h !== 'Por definir' && a !== 'Por definir') {
      opponentMap[h] = a;
      opponentMap[a] = h;
    }
  });

  const r32WinnerOf: Record<string, ProvisionalTeam> = {};
  realR32Matches.forEach((m) => {
    const winnerName = matchWinner(m);
    if (winnerName && m.home_score != null && m.away_score != null) {
      const winnerObj = { name: winnerName, isProvisional: !m.finished };
      r32WinnerOf[m.home] = winnerObj;
      r32WinnerOf[m.away] = winnerObj;
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

  const r32Pools = r32.map((pair) => pair.filter((name) => name && !name.includes('º')));
  const r16Pools = nextPools(r32Pools);
  const qfPools = nextPools(r16Pools);
  const sfPools = nextPools(qfPools);
  const r16: BracketSlot[][] = alignOfficialRound(allR16, r32Pools);
  for (let i = 0; i < 16; i += 2) {
    const r16Idx = Math.floor(i / 2);
    const homeTeam = r32[i][0];
    const awayTeam = r32[i + 1][0];

    if (homeTeam && !homeTeam.includes('º')) {
      const winner = r32WinnerOf[homeTeam];
      if (winner && !r16[r16Idx][0]) r16[r16Idx][0] = winner;
    }
    if (awayTeam && !awayTeam.includes('º')) {
      const winner = r32WinnerOf[awayTeam];
      if (winner && !r16[r16Idx][1]) r16[r16Idx][1] = winner;
    }
  }

  const realQF = safeGames
    .filter((m) => matchRound(m, 'qf', 'quarter', 'cuart'))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  const realSF = safeGames
    .filter((m) => matchRound(m, 'sf', 'semi'))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  const realFinal = safeGames.filter(
    (m) =>
      matchRound(m, 'final') &&
      !matchRound(m, 'semi', 'quarter', 'cuart', 'octav', 'third', 'tercer', '3rd', '3er', '16avo'),
  );
  const realThird = safeGames.filter((m) => matchRound(m, 'third', 'tercer', '3rd', '3er'));
  const qf: BracketSlot[][] = alignOfficialRound(realQF, r16Pools);
  const sf: BracketSlot[][] = alignOfficialRound(realSF, qfPools);
  const final_: BracketSlot[] = alignOfficialRound(realFinal, sfPools)[0];
  const thirdPlaceMatch: BracketSlot[] = alignOfficialRound(realThird, sfPools)[0];

  const findMatch = (n1: string, n2: string) =>
    safeGames.find(
      (g) =>
        isKnockoutMatch(g) &&
        ((matchTeamNames(g.home, n1) && matchTeamNames(g.away, n2)) ||
          (matchTeamNames(g.home, n2) && matchTeamNames(g.away, n1))),
    );

  const findWinner = (t1: BracketSlot, t2: BracketSlot): ProvisionalTeam | null => {
    const n1 = slotName(t1);
    const n2 = slotName(t2);
    if (!n1 || !n2 || n1 === 'Por definir' || n2 === 'Por definir') return null;
    const m = findMatch(n1, n2);
    if (m && m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const wName = matchWinner(m);
      if (wName) return { name: wName, isProvisional: isProv };
    }
    return null;
  };

  const findLoser = (t1: BracketSlot, t2: BracketSlot): ProvisionalTeam | null => {
    const n1 = slotName(t1);
    const n2 = slotName(t2);
    if (!n1 || !n2 || n1 === 'Por definir' || n2 === 'Por definir') return null;
    const m = findMatch(n1, n2);
    if (m && m.home_score != null && m.away_score != null) {
      const isProv = !m.finished;
      const wName = matchWinner(m);
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
      const wName = matchWinner(rf);
      if (wName) champion = { name: wName, isProvisional: isProv };
    }
  }

  if (realThird.length > 0) {
    const rt = realThird[0];
    if (rt.home_score != null && rt.away_score != null) {
      const isProv = !rt.finished;
      const wName = matchWinner(rt);
      if (wName) thirdPlaceWinner = { name: wName, isProvisional: isProv };
    }
  }

  return {
    topologyVersion: 2 as const,
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
