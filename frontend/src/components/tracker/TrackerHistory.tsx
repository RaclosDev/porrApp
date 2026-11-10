import { useState } from 'react';
import type { Tracker, TrackerSession } from '../../services/endpoints/trackers';
import TrackerSheetTable from './TrackerSheetTable';
import { formatDay, winnerLabel } from './trackerFormat';

interface Props {
  tracker: Tracker;
}

interface DayGroup {
  key: string;
  title: string;
  attendees: string;
  sessions: TrackerSession[];
}

/**
 * Histórico por días: fecha, quién vino, a qué se jugó y quién ganó cada partida. Tocando una partida
 * se ve su hoja, sin poder tocarla.
 */
export default function TrackerHistory({ tracker }: Props) {
  const [viewingId, setViewingId] = useState<number | null>(null);
  const games = tracker.games ?? [];
  const gameOf = (gameId: number | null) => games.find((game) => game.id === gameId);
  const nameOf = (playerId: number) =>
    tracker.players.find((player) => player.id === playerId)?.name;
  const byId = new Map(tracker.sessions.map((session) => [session.id, session]));

  const groups: DayGroup[] = [...(tracker.days ?? [])]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((day) => ({
      key: `day-${day.id}`,
      title: formatDay(day.startedAt),
      attendees: day.playerIds.map(nameOf).filter(Boolean).join(', '),
      sessions: day.sessionIds
        .map((sessionId) => byId.get(sessionId))
        .filter((session): session is TrackerSession => Boolean(session)),
    }))
    .filter((group) => group.sessions.length > 0);
  // Partidas de antes de que hubiera días de juego.
  const loose = tracker.sessions.filter((session) => session.dayId == null && session.rounds > 0);
  if (loose.length > 0) {
    groups.push({ key: 'loose', title: 'Partidas sueltas', attendees: '', sessions: loose });
  }

  const viewing = viewingId == null ? null : (byId.get(viewingId) ?? null);
  if (viewing) {
    const game = gameOf(viewing.gameId);
    const rounds = tracker.rounds.filter((round) => round.sessionId === viewing.id);
    const playerIds =
      viewing.playerIds.length > 0
        ? viewing.playerIds
        : viewing.standings.map((row) => row.playerId);
    return (
      <div className="tracker-history-sheet">
        <p className="tracker-result-label">
          {game?.name ?? tracker.name} · partida {viewing.number}
          {' · '}
          {formatDay(viewing.startedAt)}
        </p>
        <p className="tracker-result-winner">
          {viewing.endedAt ? winnerLabel(viewing) : 'Partida en juego'}
        </p>
        <TrackerSheetTable
          session={viewing}
          game={{ name: game?.name ?? tracker.name, mode: game?.mode ?? 'POINTS' }}
          players={tracker.players.filter((player) => playerIds.includes(player.id))}
          rounds={rounds}
        />
        <button
          type="button"
          className="glass-btn create-league-small-btn tracker-end"
          onClick={() => setViewingId(null)}
        >
          Volver al histórico
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return <p className="tracker-note">Aquí quedarán los días de juego y sus partidas.</p>;
  }

  return (
    <ol className="tracker-history">
      {groups.map((group) => (
        <li key={group.key} className="tracker-history-day">
          <h3 className="tracker-history-date">{group.title}</h3>
          {group.attendees && <p className="tracker-note">Vinieron {group.attendees}</p>}
          <ul className="tracker-game-list">
            {group.sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="glass-btn tracker-game-btn"
                  onClick={() => setViewingId(session.id)}
                >
                  {gameOf(session.gameId)?.name ?? tracker.name} · partida {session.number}
                  <span>{session.endedAt ? winnerLabel(session) : 'En juego'}</span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
