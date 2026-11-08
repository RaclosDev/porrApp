import type { LeagueStanding } from '../types/api';

/** Una tabla de la clasificación: un grupo, una conferencia o una fase, con su título si hay varias. */
export interface StandingsGroup {
  title: string | null;
  rows: LeagueStanding[];
}

/**
 * Separa la clasificación en sus tablas (los grupos de la Libertadores, las fases del LoL…) en el orden en
 * que llegan del servidor. Una competición con una sola tabla da un único grupo sin título.
 */
export function groupStandings(standings: LeagueStanding[]): StandingsGroup[] {
  const groups: StandingsGroup[] = [];
  for (const row of standings) {
    const title = row.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.rows.push(row);
    else groups.push({ title, rows: [row] });
  }
  return groups;
}

/** Competición de League of Legends: su tabla va por fases y con balance de victorias y derrotas. */
export const isLolCompetition = (externalId: string | null | undefined): boolean =>
  Boolean(externalId?.toLowerCase().startsWith('lol.'));
