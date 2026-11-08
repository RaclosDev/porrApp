import type { LeagueStanding } from '../types/api';
import type { StandingsGroup } from './standingsGroups';

/** Equipos de cada conferencia que entran en los playoffs de la NFL. */
export const NFL_PLAYOFF_SPOTS = 7;

/** Balance de la NFL: «6-1», o «4-2-1» con empates. */
export const nflRecord = (row: Pick<LeagueStanding, 'wins' | 'losses' | 'ties'>) =>
  `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ''}`;

/** Porcentaje de victorias (el empate vale media), con el que la NFL ordena. */
const winShare = (row: Pick<LeagueStanding, 'wins' | 'ties' | 'gamesPlayed'>) =>
  row.gamesPlayed > 0 ? (row.wins + row.ties / 2) / row.gamesPlayed : 0;

/** Porcentaje como lo escribe la NFL: «.857», «1.000». */
export const formatWinShare = (row: Pick<LeagueStanding, 'wins' | 'ties' | 'gamesPlayed'>) => {
  const text = winShare(row).toFixed(3);
  return text.startsWith('0') ? text.slice(1) : text;
};

const byWinShare = (a: LeagueStanding, b: LeagueStanding) =>
  winShare(b) - winShare(a) || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor;

/** Conferencia de una división («AFC Este» → «AFC»); null si la fila no es de una división. */
const conferenceOf = (row: LeagueStanding) => {
  const conference = row.group?.split(' ')[0];
  return conference === 'AFC' || conference === 'NFC' ? conference : null;
};

/**
 * La tabla de la NFL por conferencias, como se ve la carrera a los playoffs: cada conferencia ordenada
 * por su puesto para los playoffs (los 7 primeros entran) y el puesto como número de fila. Sin puestos
 * de ESPN, por porcentaje de victorias.
 */
export function nflConferenceTables(rows: LeagueStanding[]): StandingsGroup[] {
  return (['AFC', 'NFC'] as const)
    .map((conference) => {
      const teams = rows
        .filter((row) => conferenceOf(row) === conference)
        .sort(
          (a, b) =>
            (a.playoffSeed ?? Number.MAX_SAFE_INTEGER) -
              (b.playoffSeed ?? Number.MAX_SAFE_INTEGER) || byWinShare(a, b),
        );
      return {
        title: conference,
        rows: teams.map((row, index) => ({ ...row, rank: row.playoffSeed ?? index + 1 })),
      };
    })
    .filter((group) => group.rows.length > 0);
}

/** Los 32 equipos en una sola lista por porcentaje de victorias (la tabla corta de la portada). */
export const nflOverall = (rows: LeagueStanding[]): LeagueStanding[] =>
  [...rows].sort(byWinShare).map((row, index) => ({ ...row, rank: index + 1 }));

/** Si la tabla de la NFL llega por divisiones («AFC Este»…). */
export const hasNflDivisions = (rows: LeagueStanding[]) => rows.some((row) => conferenceOf(row));
