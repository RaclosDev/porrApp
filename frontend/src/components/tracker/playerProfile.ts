import type { Tracker, TrackerSession } from '../../services/endpoints/trackers';

interface GameRecord {
  gameId: number;
  name: string;
  played: number;
  won: number;
}

interface Rivalry {
  playerId: number;
  name: string;
  together: number;
  won: number;
  lost: number;
}

export interface PlayerProfile {
  played: number;
  won: number;
  /** Partidas ganadas seguidas hasta la última. */
  streak: number;
  bestStreak: number;
  games: GameRecord[];
  rivals: Rivalry[];
}

const finished = (session: TrackerSession) => session.endedAt != null && session.rounds > 0;
const playedBy = (session: TrackerSession, playerId: number) =>
  session.standings.some((standing) => standing.playerId === playerId);

/** Ficha de un jugador con sus partidas terminadas: victorias, rachas, por juego y cara a cara. */
export function playerProfile(tracker: Tracker, playerId: number): PlayerProfile {
  const mine = tracker.sessions
    .filter((session) => finished(session) && playedBy(session, playerId))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id - b.id);
  const gameNames = new Map((tracker.games ?? []).map((game) => [game.id, game.name]));
  const games = new Map<number, GameRecord>();
  const rivals = new Map<number, Rivalry>();
  let won = 0;
  let run = 0;
  let bestStreak = 0;

  for (const session of mine) {
    const iWon = session.winners.includes(playerId);
    if (iWon) won += 1;
    run = iWon ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);

    if (session.gameId != null) {
      const record = games.get(session.gameId) ?? {
        gameId: session.gameId,
        name: gameNames.get(session.gameId) ?? 'Juego',
        played: 0,
        won: 0,
      };
      record.played += 1;
      if (iWon) record.won += 1;
      games.set(session.gameId, record);
    }

    for (const other of session.standings) {
      if (other.playerId === playerId) continue;
      const rivalry = rivals.get(other.playerId) ?? {
        playerId: other.playerId,
        name: other.name,
        together: 0,
        won: 0,
        lost: 0,
      };
      rivalry.together += 1;
      if (iWon && !session.winners.includes(other.playerId)) rivalry.won += 1;
      if (!iWon && session.winners.includes(other.playerId)) rivalry.lost += 1;
      rivals.set(other.playerId, rivalry);
    }
  }

  return {
    played: mine.length,
    won,
    streak: run,
    bestStreak,
    games: [...games.values()].sort((a, b) => b.played - a.played || a.name.localeCompare(b.name)),
    rivals: [...rivals.values()].sort(
      (a, b) => b.together - a.together || a.name.localeCompare(b.name),
    ),
  };
}

export const percent = (part: number, whole: number) =>
  whole === 0 ? '—' : `${Math.round((part / whole) * 100)} %`;
