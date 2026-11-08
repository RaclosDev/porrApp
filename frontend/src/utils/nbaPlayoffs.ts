import type { KnockoutRound, KnockoutTie } from '../services/api';
import type { Match } from '../types/api';

/** Id de la NBA en ESPN: de ella solo se pronostican los playoffs, serie a serie. */
const NBA_EXTERNAL_ID = 'nba';

export const isNbaCompetition = (externalId: string | null | undefined) =>
  externalId === NBA_EXTERNAL_ID;

/** Rondas que son series de la NBA (o partidos del play-in), no cruces de fútbol. */
export const isSeriesRound = (round: KnockoutRound | undefined) => (round?.bestOf ?? 0) > 0;

/** Nombre corto de cada ronda, para las pestañas a 375 px. */
const SHORT_TITLES: Record<string, string> = {
  playin: 'Play-in',
  r16: '1.ª ronda',
  qf: 'Semis conf.',
  sf: 'Final conf.',
  final: 'Finales',
};

const TITLES: Record<string, string> = {
  playin: 'Play-in',
  r16: 'Primera ronda',
  qf: 'Semifinales de conferencia',
  sf: 'Finales de conferencia',
  final: 'Finales',
};

export const seriesRoundTitle = (round: string, short = false) =>
  (short ? SHORT_TITLES : TITLES)[round] ?? round;

export const CONFERENCE_LABELS: Record<string, string> = { E: 'Este', W: 'Oeste' };

/** Victorias de cada equipo en la serie, contando los partidos ya terminados. */
export function seriesWins(
  tie: KnockoutTie,
  matches: Map<number, Match>,
): { home: number; away: number; played: number } {
  let home = 0;
  let away = 0;
  for (const id of tie.matchIds) {
    const match = matches.get(id);
    if (!match?.finished || match.homeScore == null || match.awayScore == null) continue;
    if (match.homeScore === match.awayScore) continue;
    const homeTeamWon = match.homeScore > match.awayScore;
    const winner = homeTeamWon ? match.home : match.away;
    if (winner === tie.home) home++;
    else if (winner === tie.away) away++;
  }
  return { home, away, played: home + away };
}

/** Partidos en que se puede ganar una serie al mejor de `bestOf`: de 4 a 7 en la NBA. */
export function seriesLengths(bestOf: number): number[] {
  const needed = Math.floor(bestOf / 2) + 1;
  return Array.from({ length: bestOf - needed + 1 }, (_, index) => needed + index);
}

/** «4-1» a partir de en cuántos partidos se gana la serie. */
export function seriesScore(games: number, bestOf: number): string {
  const needed = Math.floor(bestOf / 2) + 1;
  return `${needed}-${games - needed}`;
}
