import type {
  TrackerDay,
  TrackerRound,
  TrackerSession,
  TrackerStanding,
} from '../../services/endpoints/trackers';

/** Año de una partida, para filtrar el ranking por temporadas. */
export const yearOf = (session: TrackerSession, days: TrackerDay[] = []) => {
  const playedOn = days.find((day) => day.id === session.dayId)?.playedOn;
  return playedOn ? Number(playedOn.slice(0, 4)) : new Date(session.startedAt).getFullYear();
};

/**
 * Clasificación acumulada de unas partidas, como la del servidor: partidas ganadas y, a igualdad,
 * rondas ganadas. Solo cuenta a quien ha jugado alguna; las partidas abiertas suman rondas pero
 * aún no tienen ganador.
 */
export function standingsFrom(
  sessions: TrackerSession[],
  rounds?: TrackerRound[],
): TrackerStanding[] {
  const rows = new Map<number, TrackerStanding>();
  for (const session of sessions) {
    if (session.rounds === 0) continue;
    const sessionRounds = rounds?.filter((round) => round.sessionId === session.id);
    const scored = sessionRounds?.length
      ? new Set(sessionRounds.flatMap((round) => Object.keys(round.scores).map(Number)))
      : null;
    for (const standing of session.standings) {
      if (scored && !scored.has(standing.playerId)) continue;
      const row = rows.get(standing.playerId) ?? {
        playerId: standing.playerId,
        name: standing.name,
        total: 0,
        rank: 0,
        roundsWon: 0,
        sessionsWon: 0,
        sessionsPlayed: 0,
      };
      row.total += standing.total;
      row.roundsWon += standing.roundsWon;
      if (session.endedAt) row.sessionsPlayed = (row.sessionsPlayed ?? 0) + 1;
      if (session.endedAt && session.winners.includes(standing.playerId)) row.sessionsWon += 1;
      rows.set(standing.playerId, row);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.sessionsWon - a.sessionsWon || a.name.localeCompare(b.name),
  );
  for (const row of sorted) {
    row.rank = sorted.filter((other) => other.sessionsWon > row.sessionsWon).length + 1;
  }
  return sorted;
}
