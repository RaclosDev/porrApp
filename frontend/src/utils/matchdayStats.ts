/** Agrupación por jornada y repartos de las estadísticas de una liga por jornadas. */
import type { MatchStats } from '../types/api';
import { percent } from './bracketStats';

export interface MatchdayRound {
  label: string;
  matches: MatchStats[];
}

/** Jornadas en orden de su primer partido (el backend ya los envía por fecha). */
export function groupByRound(matches: MatchStats[]): MatchdayRound[] {
  const rounds = new Map<string, MatchStats[]>();
  for (const match of matches) {
    const label = match.round || 'Sin jornada';
    const list = rounds.get(label) ?? [];
    list.push(match);
    rounds.set(label, list);
  }
  return [...rounds].map(([label, list]) => ({ label, matches: list }));
}

/** La jornada que se abre por defecto: la del último partido que ha empezado. */
export const latestRound = (rounds: MatchdayRound[]): string | null => {
  let latest: { label: string; time: number } | null = null;
  for (const round of rounds) {
    for (const m of round.matches) {
      const time = m.matchDate ? new Date(m.matchDate).getTime() : 0;
      if (!latest || time >= latest.time) latest = { label: round.label, time };
    }
  }
  return latest?.label ?? null;
};

export type Sign = '1' | 'X' | '2';

export interface SignShare {
  sign: Sign;
  count: number;
  percent: number;
}

/** Reparto 1X2 de un partido sobre los pronósticos con signo. */
export function signShares(match: MatchStats): SignShare[] {
  const counts: [Sign, number][] = [
    ['1', match.homeWins],
    ['X', match.draws],
    ['2', match.awayWins],
  ];
  const total = match.homeWins + match.draws + match.awayWins;
  return counts.map(([sign, count]) => ({ sign, count, percent: percent(count, total) }));
}

/** Signo del marcador real, si el partido ha terminado. */
export const realSign = (match: MatchStats): Sign | null => {
  if (!match.finished || match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore > match.awayScore) return '1';
  return match.homeScore === match.awayScore ? 'X' : '2';
};
