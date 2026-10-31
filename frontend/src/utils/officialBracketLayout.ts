import type { Match } from '../types/api';

/** Each slot contains the teams that can reach it through its preceding matches. */
export const nextPools = (pools: string[][]): string[][] =>
  Array.from({ length: pools.length / 2 }, (_, i) => [...pools[i * 2], ...pools[i * 2 + 1]]);

const sameTeam = (a: string, b: string) =>
  a === b || (['EEUU', 'Estados Unidos'].includes(a) && ['EEUU', 'Estados Unidos'].includes(b));

/** Unanchored fixtures stay empty: kickoff time is not a bracket position. */
export function alignOfficialRound(matches: Match[], sourcePools: string[][]): (string | null)[][] {
  const real = (name: string) =>
    name && name !== 'Por definir' && name !== '???' && !name.includes('º');
  const belongs = (name: string, pool: string[]) =>
    !real(name) || pool.some((team) => sameTeam(team, name));
  return Array.from({ length: sourcePools.length / 2 }, (_, index) => {
    const homePool = sourcePools[index * 2];
    const awayPool = sourcePools[index * 2 + 1];
    for (const match of matches) {
      if (!real(match.home) && !real(match.away)) continue;
      if (belongs(match.home, homePool) && belongs(match.away, awayPool))
        return [real(match.home) ? match.home : null, real(match.away) ? match.away : null];
      if (belongs(match.away, homePool) && belongs(match.home, awayPool))
        return [real(match.away) ? match.away : null, real(match.home) ? match.home : null];
    }
    return [null, null];
  });
}
