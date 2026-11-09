import type { Match } from '../types/api';
import {
  getCustomRoundTitle,
  winnerPlaceholder,
  type CustomResultRound,
  type CustomResultSlot,
} from './customBracket';

/** Rondas eliminatorias de una competición oficial, de la primera a la final. */
const BRACKET_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final'];

/** Todas las rondas eliminatorias, también el playoff de la UEFA. */
export const KNOCKOUT_ROUNDS = ['playoff', ...BRACKET_ROUNDS];

const byDate = (left: Match, right: Match) =>
  (left.date ?? '￿').localeCompare(right.date ?? '￿') || left.id - right.id;

/** Ganador de una serie terminada: el que indica el proveedor o el del marcador. */
export function officialMatchWinner(match: Match | null | undefined): string | null {
  if (!match?.finished) return null;
  if (match.winner) return match.winner;
  if (match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore === match.awayScore) return null;
  return match.homeScore > match.awayScore ? match.home : match.away;
}

const matchSlot = (match: Match): CustomResultSlot => ({
  match,
  home: match.home,
  away: match.away,
  homePlaceholder: match.home,
  awayPlaceholder: match.away,
  isBye: false,
});

const slotWinner = (slot: CustomResultSlot | undefined): string | null =>
  slot?.match ? officialMatchWinner(slot.match) : null;

/**
 * Cuadro eliminatorio de una competición oficial con sus cruces reales. Empieza en la primera ronda
 * eliminatoria que tenga partidos y llega hasta la final: cada cruce se coloca junto a los de la
 * ronda anterior de los que salen sus equipos, y los que aún no existen muestran a los ganadores.
 */
export function computeOfficialResultRounds(matches: Match[]): CustomResultRound[] {
  const byRound = new Map<string, Match[]>();
  for (const match of matches) {
    if (!BRACKET_ROUNDS.includes(match.round)) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  const first = BRACKET_ROUNDS.findIndex((round) => byRound.has(round));
  if (first < 0) return [];
  const rounds = BRACKET_ROUNDS.slice(first);
  const total = rounds.length;

  let previous = [...(byRound.get(rounds[0]) ?? [])].sort(byDate).map(matchSlot);
  const result: CustomResultRound[] = [
    { roundIndex: 0, title: getCustomRoundTitle(0, total), slots: previous },
  ];

  for (let roundIndex = 1; roundIndex < total; roundIndex++) {
    const expected = Math.max(1, Math.ceil(previous.length / 2));
    const placed: (CustomResultSlot | null)[] = Array.from({ length: expected }, () => null);
    const unplaced: Match[] = [];
    for (const match of [...(byRound.get(rounds[roundIndex]) ?? [])].sort(byDate)) {
      const feeder = previous.findIndex(
        (slot) =>
          slot.match &&
          [slot.home, slot.away].some((team) => team === match.home || team === match.away),
      );
      const position = feeder >= 0 ? Math.floor(feeder / 2) : -1;
      if (position >= 0 && position < expected && !placed[position]) {
        placed[position] = matchSlot(match);
      } else {
        unplaced.push(match);
      }
    }
    for (const match of unplaced) {
      const free = placed.indexOf(null);
      if (free < 0) break;
      placed[free] = matchSlot(match);
    }

    const slots = placed.map((slot, position): CustomResultSlot => {
      if (slot) return slot;
      const isBye = position * 2 + 1 >= previous.length;
      const home = slotWinner(previous[position * 2]);
      const away = isBye ? null : slotWinner(previous[position * 2 + 1]);
      return {
        match: null,
        home,
        away,
        homePlaceholder: home ?? winnerPlaceholder(position * 2 + 1, previous.length),
        awayPlaceholder: isBye
          ? 'Descanso'
          : (away ?? winnerPlaceholder(position * 2 + 2, previous.length)),
        isBye,
      };
    });
    result.push({ roundIndex, title: getCustomRoundTitle(roundIndex, total), slots });
    previous = slots;
  }
  return result;
}

interface SwissRow {
  team: string;
  wins: number;
  losses: number;
}

/** Victorias necesarias para pasar la fase suiza y derrotas que eliminan. */
export const SWISS_WINS_TO_ADVANCE = 3;
export const SWISS_LOSSES_TO_EXIT = 3;

/**
 * Balance de victorias y derrotas de la fase suiza (los partidos de ronda "group"), ordenado por
 * victorias, menos derrotas y nombre. Los equipos aparecen en cuanto tienen una serie programada.
 */
export function computeSwissStandings(matches: Match[]): SwissRow[] {
  const rows = new Map<string, SwissRow>();
  const row = (team: string) => {
    let found = rows.get(team);
    if (!found) {
      found = { team, wins: 0, losses: 0 };
      rows.set(team, found);
    }
    return found;
  };
  for (const match of matches) {
    if (match.round !== 'group' || !match.home || !match.away) continue;
    const home = row(match.home);
    const away = row(match.away);
    const winner = officialMatchWinner(match);
    if (winner === match.home) {
      home.wins++;
      away.losses++;
    } else if (winner === match.away) {
      away.wins++;
      home.losses++;
    }
  }
  return [...rows.values()].sort(
    (left, right) =>
      right.wins - left.wins ||
      left.losses - right.losses ||
      left.team.localeCompare(right.team, 'es'),
  );
}

export interface SwissDay {
  key: string;
  label: string;
  matches: Match[];
}

const SPAIN_TIME_ZONE = 'Europe/Madrid';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: SPAIN_TIME_ZONE });
const dayLabel = new Intl.DateTimeFormat('es-ES', {
  timeZone: SPAIN_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Series de la fase suiza agrupadas por día (hora de España) en orden cronológico. */
export function swissMatchesByDay(matches: Match[]): SwissDay[] {
  const days = new Map<string, SwissDay>();
  const sorted = matches
    .filter((match) => match.round === 'group' && match.home && match.away && match.date)
    .sort((left, right) => (left.date ?? '').localeCompare(right.date ?? ''));
  for (const match of sorted) {
    const date = new Date(match.date as string);
    const key = dayKey.format(date);
    let day = days.get(key);
    if (!day) {
      day = { key, label: dayLabel.format(date), matches: [] };
      days.set(key, day);
    }
    day.matches.push(match);
  }
  return [...days.values()];
}

/** Próxima serie del cuadro sin terminar (también la que está en juego) con los dos rivales. */
export function nextOfficialBracketMatch(matches: Match[]): Match | null {
  return (
    matches
      .filter(
        (match) =>
          KNOCKOUT_ROUNDS.includes(match.round) &&
          !match.finished &&
          match.away_team_id != null &&
          Boolean(match.home && match.away),
      )
      .sort(byDate)[0] ?? null
  );
}

/**
 * Cruces reales del cuadro con la forma de una competición personalizada ("bracket-N", la primera
 * ronda en el orden en que se pinta) para pronosticarlos con el mismo editor.
 */
export function officialBracketMatches(matches: Match[]): Match[] {
  const first = BRACKET_ROUNDS.findIndex((round) => matches.some((match) => match.round === round));
  if (first < 0) return [];
  return BRACKET_ROUNDS.slice(first).flatMap((round, index) =>
    matches
      .filter((match) => match.round === round)
      .sort(byDate)
      .map((match) => ({
        ...match,
        round: `bracket-${index + 1}`,
        winner: officialMatchWinner(match),
      })),
  );
}
