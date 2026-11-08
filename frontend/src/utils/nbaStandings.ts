import type { LeagueStanding } from '../types/api';
import { groupStandings, type StandingsGroup } from './standingsGroups';

/** Cómo se ve la tabla de la NBA: por conferencias (el camino a los playoffs) o por divisiones. */
export type NbaStandingsView = 'conference' | 'division';

/** Divisiones de cada conferencia, en el orden de la NBA. */
const DIVISION_ORDER = ['Atlántico', 'Central', 'Sureste', 'Noroeste', 'Pacífico', 'Suroeste'];

/** Puestos de cada zona de la conferencia: del 1 al 6, playoffs directos; del 7 al 10, play-in. */
const NBA_PLAYOFF_SEEDS = 6;
const NBA_PLAY_IN_SEEDS = 10;

/**
 * Tablas de la NBA. Por conferencias, las del servidor (ordenadas por su puesto de playoffs). Por
 * divisiones, cada división con sus cinco equipos en el orden de la conferencia y su puesto en la división.
 */
export function nbaStandingsGroups(
  standings: LeagueStanding[],
  view: NbaStandingsView,
): StandingsGroup[] {
  const conferences = groupStandings(standings);
  if (view === 'conference') return conferences;
  const groups: StandingsGroup[] = [];
  for (const conference of conferences) {
    const divisions = new Map<string, LeagueStanding[]>();
    for (const row of conference.rows) {
      const division = row.division ?? 'Sin división';
      divisions.set(division, [...(divisions.get(division) ?? []), row]);
    }
    const names = [...divisions.keys()].sort(
      (a, b) =>
        (DIVISION_ORDER.indexOf(a) + 1 || DIVISION_ORDER.length + 1) -
        (DIVISION_ORDER.indexOf(b) + 1 || DIVISION_ORDER.length + 1),
    );
    for (const name of names) {
      groups.push({
        title: `División ${name}`,
        rows: (divisions.get(name) ?? []).map((row, index) => ({ ...row, rank: index + 1 })),
      });
    }
  }
  return groups;
}

/** Porcentaje de victorias como en la NBA: «.800», «1.000»; «.000» sin partidos. */
export function winPercentage(row: LeagueStanding): string {
  const played = row.wins + row.losses;
  if (played === 0) return '.000';
  const share = row.wins / played;
  return share >= 1 ? '1.000' : share.toFixed(3).replace(/^0/, '');
}

/**
 * Partidos por detrás del mejor balance de la tabla: la mitad de la diferencia de victorias más la de
 * derrotas. «–» para el líder; en decimal español («1,5»).
 */
export function gamesBehind(row: LeagueStanding, rows: LeagueStanding[]): string {
  const best = Math.max(...rows.map((other) => other.wins - other.losses));
  const behind = (best - (row.wins - row.losses)) / 2;
  if (behind <= 0) return '–';
  return Number.isInteger(behind) ? String(behind) : behind.toFixed(1).replace('.', ',');
}

/** Zona de la conferencia de un puesto: playoffs, play-in o ninguna. */
export function nbaZone(rank: number): 'playoff' | 'playin' | null {
  if (rank >= 1 && rank <= NBA_PLAYOFF_SEEDS) return 'playoff';
  if (rank > NBA_PLAYOFF_SEEDS && rank <= NBA_PLAY_IN_SEEDS) return 'playin';
  return null;
}
