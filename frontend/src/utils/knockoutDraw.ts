import type { KnockoutRound, KnockoutTie } from '../services/api';
import type { Match, PredictionData } from '../types/api';
import { seriesLengths, seriesRoundTitle } from './nbaPlayoffs';

/** Elecciones por ronda y cruce; null en los cruces sin elegir. */
export type KnockoutPicks = (string | null)[][];

/** En la NBA, en cuántos partidos se gana cada serie, alineado con las elecciones; null sin elegir. */
export type SeriesGames = (number | null)[][];

const TITLES: Record<string, string> = {
  playoff: 'Playoff',
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  final: 'Final',
};

export const knockoutRoundTitle = (round: string, series = false, short = false) =>
  series ? seriesRoundTitle(round, short) : (TITLES[round] ?? round);

/** Elecciones guardadas, alineadas con los cruces de cada ronda. */
export function picksFromSaved(
  rounds: KnockoutRound[],
  saved: (string | null)[][] | undefined,
): KnockoutPicks {
  return rounds.map((round, index) =>
    round.ties.map((tie, position) => {
      const pick = saved?.[index]?.[position] ?? null;
      return pick && (pick === tie.home || pick === tie.away) ? pick : null;
    }),
  );
}

/** Partidos elegidos guardados: solo en series a más de un partido y donde hay ganador elegido. */
export function gamesFromSaved(
  rounds: KnockoutRound[],
  picks: KnockoutPicks,
  saved: (number | null)[][] | undefined,
): SeriesGames {
  return rounds.map((round, index) =>
    round.ties.map((_, position) => {
      const games = saved?.[index]?.[position] ?? null;
      if (games == null || (round.bestOf ?? 0) < 2 || !picks[index]?.[position]) return null;
      return seriesLengths(round.bestOf ?? 0).includes(games) ? games : null;
    }),
  );
}

/**
 * Predicción lista para guardar: una lista por ronda con la elección de cada cruce (vacía si no se
 * eligió ninguno) y el campeón, que es el elegido en la final. Null si aún no hay ninguna elección.
 * En la NBA lleva también en cuántos partidos se gana cada serie elegida.
 */
export function knockoutPrediction(
  rounds: KnockoutRound[],
  picks: KnockoutPicks,
  userName: string,
  predictionName: string,
  games: SeriesGames = [],
): PredictionData | null {
  const customRounds = rounds.map((round, index) => {
    const row = round.ties.map((_, position) => picks[index]?.[position] ?? null);
    return row.some(Boolean) ? row : [];
  });
  while (customRounds.length > 0 && customRounds[customRounds.length - 1].length === 0) {
    customRounds.pop();
  }
  if (customRounds.length === 0) return null;
  const last = rounds[rounds.length - 1];
  const champion =
    last?.round === 'final' && customRounds.length === rounds.length
      ? (customRounds[rounds.length - 1][0] ?? null)
      : null;
  const customSeriesGames = customRounds.map((row, index) =>
    row.length === 0
      ? []
      : row.map((pick, position) => (pick ? (games[index]?.[position] ?? null) : null)),
  );
  return {
    user: userName,
    prediction: predictionName.trim() || userName || 'Mi predicción',
    groups: {},
    customRounds,
    ...(customSeriesGames.some((row) => row.some((value) => value != null))
      ? { customSeriesGames }
      : {}),
    r16: [],
    champion,
  };
}

/** Goles de cada equipo en el cruce, sumando los partidos jugados (null si aún no se ha jugado ninguno). */
export function tieAggregate(
  tie: KnockoutTie,
  matches: Map<number, Match>,
): { home: number; away: number } | null {
  let home = 0;
  let away = 0;
  let played = false;
  for (const id of tie.matchIds) {
    const match = matches.get(id);
    if (!match || match.homeScore == null || match.awayScore == null) continue;
    if (!match.finished && match.status !== 'LIVE' && match.status !== 'PAUSED') continue;
    played = true;
    const straight = match.home === tie.home;
    home += straight ? match.homeScore : match.awayScore;
    away += straight ? match.awayScore : match.homeScore;
  }
  return played ? { home, away } : null;
}

/** Ronda que se abre al entrar: la primera sorteada con algún cruce sin decidir, o la última sorteada. */
export function defaultKnockoutRound(rounds: KnockoutRound[]): number {
  const open = rounds.findIndex((round) => round.drawn && round.ties.some((tie) => !tie.winner));
  if (open >= 0) return open;
  for (let index = rounds.length - 1; index >= 0; index--) {
    if (rounds[index].ties.length > 0) return index;
  }
  return 0;
}

/** Escudos de los equipos, sacados de los partidos de la competición. */
export function logosOf(matches: Match[]): Record<string, string | null> {
  const logos: Record<string, string | null> = {};
  for (const match of matches) {
    logos[match.home] ??= match.homeLogo || match.homeTeamLogo;
    logos[match.away] ??= match.awayLogo || match.awayTeamLogo;
  }
  return logos;
}
