import { useState } from 'react';
import type {
  Tracker,
  TrackerDay,
  TrackerRoundDraft,
  TrackerSession,
} from '../../services/endpoints/trackers';
import { confirmAction } from '../../utils/confirmAction';
import TrackerSheetTable from './TrackerSheetTable';
import TrackerSheet from './TrackerSheet';
import { formatDay, winnerLabel } from './trackerFormat';
import { dayCard, shareResult } from './shareResult';

interface Props {
  tracker: Tracker;
  busy?: boolean;
  /** Solo el administrador: borrar un día apuntado por error. */
  onDeleteDay?: (dayId: number) => Promise<boolean>;
  /** Solo el administrador: poner a un día cerrado la fecha (AAAA-MM-DD) en que se jugó. */
  onMoveDay?: (dayId: number, date: string) => Promise<boolean>;
  onEditRound?: (roundId: number, round: TrackerRoundDraft) => Promise<boolean>;
}

interface DayGroup {
  key: string;
  title: string;
  attendees: string;
  sessions: TrackerSession[];
  day?: TrackerDay;
}

/** Fecha local AAAA-MM-DD de un instante, para el selector de fecha. */
const localDate = (at: string | Date) => {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Histórico por días: fecha, quién vino, a qué se jugó y quién ganó cada partida. Tocando una partida
 * se ve su hoja, sin poder tocarla.
 */
export default function TrackerHistory({
  tracker,
  busy = false,
  onDeleteDay,
  onMoveDay,
  onEditRound,
}: Props) {
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [movingDayId, setMovingDayId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [visibleDays, setVisibleDays] = useState(10);
  const games = tracker.games ?? [];
  const gameOf = (gameId: number | null) => games.find((game) => game.id === gameId);
  const nameOf = (playerId: number) =>
    tracker.players.find((player) => player.id === playerId)?.name;
  const byId = new Map(tracker.sessions.map((session) => [session.id, session]));

  const groups: DayGroup[] = [...(tracker.days ?? [])]
    .sort((a, b) => (b.playedOn ?? b.startedAt).localeCompare(a.playedOn ?? a.startedAt))
    .map((day) => ({
      key: `day-${day.id}`,
      title: formatDay(day.playedOn ? `${day.playedOn}T12:00:00` : day.startedAt),
      attendees: day.playerIds.map(nameOf).filter(Boolean).join(', '),
      sessions: day.sessionIds
        .map((sessionId) => byId.get(sessionId))
        .filter((session): session is TrackerSession => Boolean(session)),
      day,
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
          {formatDay(
            (tracker.days ?? []).find((day) => day.id === viewing.dayId)?.playedOn
              ? `${(tracker.days ?? []).find((day) => day.id === viewing.dayId)?.playedOn}T12:00:00`
              : viewing.startedAt,
          )}
        </p>
        <p className="tracker-result-winner">
          {viewing.endedAt ? winnerLabel(viewing) : 'Partida en juego'}
        </p>
        {tracker.owner && viewing.endedAt && game && onEditRound ? (
          <TrackerSheet
            key={viewing.id}
            session={viewing}
            game={game}
            players={tracker.players.filter((player) => playerIds.includes(player.id))}
            rounds={rounds}
            busy={busy}
            closed
            onAdd={async () => false}
            onEdit={onEditRound}
            onDelete={async () => false}
          />
        ) : (
          <TrackerSheetTable
            session={viewing}
            game={{ name: game?.name ?? tracker.name, mode: game?.mode ?? 'POINTS' }}
            players={tracker.players.filter((player) => playerIds.includes(player.id))}
            rounds={rounds}
          />
        )}
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
    <>
      <ol className="tracker-history">
        {groups.slice(0, visibleDays).map((group) => (
          <li key={group.key} className="tracker-history-day">
            <h3 className="tracker-history-date">{group.title}</h3>
            {group.attendees && <p className="tracker-note">Vinieron {group.attendees}</p>}
            {group.day?.closedAt && (
              <button
                type="button"
                className="create-league-link"
                aria-label={`Compartir el día ${group.title}`}
                onClick={() => void shareResult(dayCard(tracker.name, group.title, group.sessions))}
              >
                Compartir el día
              </button>
            )}
            {group.day?.closedAt && tracker.owner && onDeleteDay && onMoveDay && (
              <DayActions
                day={group.day}
                title={group.title}
                busy={busy}
                moving={movingDayId === group.day.id}
                date={date}
                onDate={setDate}
                onStartMove={(day) => {
                  setMovingDayId(day.id);
                  setDate(day.playedOn ?? localDate(day.startedAt));
                }}
                onCancelMove={() => setMovingDayId(null)}
                onMove={async (day) => {
                  if (await onMoveDay(day.id, date)) setMovingDayId(null);
                }}
                onDelete={onDeleteDay}
              />
            )}
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
      {groups.length > visibleDays && (
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() => setVisibleDays((count) => count + 10)}
        >
          Ver más días ({groups.length - visibleDays} pendientes)
        </button>
      )}
    </>
  );
}

function DayActions({
  day,
  title,
  busy,
  moving,
  date,
  onDate,
  onStartMove,
  onCancelMove,
  onMove,
  onDelete,
}: {
  day: TrackerDay;
  title: string;
  busy: boolean;
  moving: boolean;
  date: string;
  onDate: (date: string) => void;
  onStartMove: (day: TrackerDay) => void;
  onCancelMove: () => void;
  onMove: (day: TrackerDay) => Promise<void>;
  onDelete: (dayId: number) => Promise<boolean>;
}) {
  const remove = async () => {
    const confirmed = await confirmAction({
      title: `¿Borrar el día ${title}?`,
      message:
        'Se borran sus partidas y rondas, y salen de la clasificación. No se puede deshacer.',
      confirmLabel: 'Borrar día',
    });
    if (confirmed) await onDelete(day.id);
  };

  if (moving) {
    const inputId = `tracker-day-date-${day.id}`;
    return (
      <form
        className="tracker-day-actions"
        onSubmit={(event) => {
          event.preventDefault();
          if (date) void onMove(day);
        }}
      >
        <label htmlFor={inputId}>Se jugó el</label>
        <input
          id={inputId}
          type="date"
          className="glass-input"
          value={date}
          max={localDate(new Date())}
          onChange={(event) => onDate(event.target.value)}
        />
        <button
          type="submit"
          className="glass-btn create-league-small-btn"
          disabled={busy || !date}
        >
          Guardar
        </button>
        <button type="button" className="create-league-link" onClick={onCancelMove}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="tracker-day-actions">
      <button
        type="button"
        className="create-league-link"
        disabled={busy}
        onClick={() => onStartMove(day)}
      >
        Cambiar fecha
      </button>
      <button
        type="button"
        className="create-league-link"
        disabled={busy}
        onClick={() => void remove()}
      >
        Borrar día
      </button>
    </div>
  );
}
