import { useState } from 'react';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import { formatDay } from '../components/tracker/trackerFormat';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import TrackerAttendees from '../components/tracker/TrackerAttendees';
import TrackerGamePicker from '../components/tracker/TrackerGamePicker';
import TrackerSheet from '../components/tracker/TrackerSheet';
import TrackerResult from '../components/tracker/TrackerResult';
import {
  addTrackerGame,
  addTrackerPlayer,
  addTrackerRound,
  closeTrackerDay,
  deleteTrackerRound,
  editTrackerRound,
  endTrackerSession,
  reopenTrackerSession,
  startTrackerDay,
  startTrackerSession,
  type TrackerGameDraft,
  type TrackerRound,
} from '../services/endpoints/trackers';
import { useTrackerLeague } from '../hooks/useTrackerLeague';
import { confirmAction } from '../utils/confirmAction';

/**
 * Liga de juegos de mesa en la mesa: se empieza el día con quienes han venido, se elige juego, se
 * apunta cada ronda en la hoja y al terminar se ve quién ha ganado. Cualquier miembro apunta y todos
 * los móviles lo ven en directo.
 */
export default function TrackerView({ leagueId }: { leagueId: string | null }) {
  const { query, tracker, busy, change } = useTrackerLeague(leagueId);
  /** Quién juega lo siguiente que se empiece; null mientras no se toca (todos los del día). */
  const [chosen, setChosen] = useState<number[] | null>(null);
  /** Eligiendo juego aunque haya una partida a medias o un resultado que enseñar. */
  const [picking, setPicking] = useState(false);

  if (query.isPending) return <PaperLoading label="Cargando la partida" />;
  if (!tracker) return <TrackerUnavailable error={query.error} />;

  const games = tracker.games ?? [];
  const day = (tracker.days ?? []).find((item) => item.id === tracker.currentDayId) ?? null;
  const daySessions = day ? tracker.sessions.filter((item) => item.dayId === day.id) : [];
  const open = daySessions.find((item) => !item.endedAt) ?? null;
  const lastEnded = [...daySessions].reverse().find((item) => item.endedAt) ?? null;
  const gameOf = (gameId: number | null) =>
    games.find((game) => game.id === gameId) ?? {
      name: 'Partida',
      unit: tracker.unit,
      mode: 'POINTS' as const,
      lowerWins: tracker.lowerWins,
    };

  const everyone = tracker.players.map((player) => player.id);
  const defaults = day && day.playerIds.length > 0 ? day.playerIds : everyone;
  const selected = (chosen ?? defaults).filter((playerId) => everyone.includes(playerId));
  const toggle = (playerId: number) =>
    setChosen(
      selected.includes(playerId)
        ? selected.filter((item) => item !== playerId)
        : [...selected, playerId],
    );

  const addPlayer = async (name: string) => {
    const next = await change(() => addTrackerPlayer(tracker.id, name), 'No se pudo añadir');
    if (!next) return false;
    const added = next.players.find((player) => !everyone.includes(player.id));
    if (added) setChosen([...selected, added.id]);
    return true;
  };

  const startDay = async () => {
    if (selected.length === 0) {
      toast.error('Marca al menos a un jugador.');
      return;
    }
    if (await change(() => startTrackerDay(tracker.id, selected), 'No se pudo empezar el día')) {
      setChosen(null);
    }
  };

  const play = async (gameId: number) => {
    if (selected.length === 0) {
      toast.error('Marca al menos a un jugador.');
      return false;
    }
    const next = await change(
      () => startTrackerSession(tracker.id, { gameId, playerIds: selected }),
      'No se pudo empezar la partida',
    );
    if (next) {
      setPicking(false);
      setChosen(null);
    }
    return Boolean(next);
  };

  const createGame = async (game: TrackerGameDraft) => {
    const known = new Set(games.map((item) => item.id));
    const next = await change(() => addTrackerGame(tracker.id, game), 'No se pudo crear el juego');
    const created = next?.games?.find((item) => !known.has(item.id));
    return created ? play(created.id) : false;
  };

  const endSession = async () => {
    if (!open) return;
    const confirmed = await confirmAction({
      title: '¿Terminar la partida?',
      message: 'Se cierra la hoja y se ve quién ha ganado. Se puede reabrir para corregirla.',
      confirmLabel: 'Terminar partida',
    });
    if (confirmed) {
      await change(() => endTrackerSession(tracker.id, open.id), 'No se pudo terminar');
    }
  };

  const closeDay = async () => {
    if (!day) return;
    const confirmed = await confirmAction({
      title: '¿Cerrar el día de juego?',
      message: 'Las partidas quedan en el histórico. La próxima vez se empieza un día nuevo.',
      confirmLabel: 'Cerrar el día',
    });
    if (confirmed) {
      setPicking(false);
      await change(() => closeTrackerDay(tracker.id, day.id), 'No se pudo cerrar el día');
    }
  };

  const removeRound = async (round: TrackerRound) => {
    const confirmed = await confirmAction({
      title: `¿Borrar la ronda ${round.number}?`,
      message: 'Se quita de la hoja y de la clasificación.',
      confirmLabel: 'Borrar ronda',
    });
    if (!confirmed) return false;
    return Boolean(
      await change(() => deleteTrackerRound(tracker.id, round.id), 'No se pudo borrar'),
    );
  };

  const showSheet = open && !picking;
  const showResult = !open && lastEnded && !picking;

  return (
    <section className="view-section active create-league tracker">
      <header className="create-league-header tracker-head">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">{tracker.name}</h1>
          <p className="create-league-progress" role="status">
            {day ? `Día de juego · ${formatDay(day.startedAt)}` : 'Ningún día de juego en curso'}
          </p>
        </div>
      </header>
      {!day && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-day-title"
        >
          <h2 id="tracker-day-title" className="tracker-heading">
            ¿Quién ha venido hoy?
          </h2>
          <TrackerAttendees
            label="Jugadores que han venido"
            players={tracker.players}
            selected={selected}
            busy={busy}
            onToggle={toggle}
            onAddPlayer={addPlayer}
          />
          <button
            type="button"
            className="glass-btn primary-btn tracker-submit"
            disabled={busy || selected.length === 0}
            onClick={() => void startDay()}
          >
            Empezar día de juego
          </button>
        </section>
      )}

      {showSheet && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-sheet-title"
        >
          <div className="tracker-section-head">
            <h2 id="tracker-sheet-title" className="tracker-heading">
              {gameOf(open.gameId).name} · partida {open.number}
            </h2>
            {open.rounds === 0 && (
              <button
                type="button"
                className="create-league-link"
                onClick={() => {
                  setChosen(open.playerIds);
                  setPicking(true);
                }}
              >
                Cambiar de juego
              </button>
            )}
          </div>
          <TrackerSheet
            key={open.id}
            session={open}
            game={gameOf(open.gameId)}
            players={tracker.players.filter(
              (player) => open.playerIds.length === 0 || open.playerIds.includes(player.id),
            )}
            rounds={tracker.rounds.filter((round) => round.sessionId === open.id)}
            busy={busy}
            onAdd={async (round) =>
              Boolean(await change(() => addTrackerRound(tracker.id, round), 'No se pudo apuntar'))
            }
            onEdit={async (roundId, round) =>
              Boolean(
                await change(
                  () => editTrackerRound(tracker.id, roundId, round),
                  'No se pudo corregir',
                ),
              )
            }
            onDelete={removeRound}
          />
          <button
            type="button"
            className="glass-btn create-league-small-btn tracker-end"
            disabled={busy || open.rounds === 0}
            onClick={() => void endSession()}
          >
            Terminar partida
          </button>
        </section>
      )}

      {showResult && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-result-title"
        >
          <h2 id="tracker-result-title" className="tracker-heading">
            Partida terminada
          </h2>
          <TrackerResult
            session={lastEnded}
            gameName={gameOf(lastEnded.gameId).name}
            unit={gameOf(lastEnded.gameId).unit}
            myPlayerId={tracker.myPlayerId}
            busy={busy}
            onAnother={() => setPicking(true)}
            onReopen={() =>
              void change(
                () => reopenTrackerSession(tracker.id, lastEnded.id),
                'No se pudo reabrir',
              )
            }
            onCloseDay={() => void closeDay()}
          />
        </section>
      )}

      {day && !showSheet && !showResult && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-pick-title"
        >
          <div className="tracker-section-head">
            <h2 id="tracker-pick-title" className="tracker-heading">
              ¿A qué jugáis?
            </h2>
            {picking && (
              <button
                type="button"
                className="create-league-link"
                onClick={() => {
                  setPicking(false);
                  setChosen(null);
                }}
              >
                {open ? 'Volver a la partida' : 'Volver'}
              </button>
            )}
          </div>
          <h3 className="tracker-subheading">Quién juega</h3>
          <TrackerAttendees
            label="Jugadores de la partida"
            players={tracker.players}
            selected={selected}
            busy={busy}
            onToggle={toggle}
            onAddPlayer={addPlayer}
          />
          <h3 className="tracker-subheading">Juego</h3>
          <TrackerGamePicker
            games={games}
            busy={busy}
            onPick={(gameId) => void play(gameId)}
            onCreate={createGame}
          />
          {daySessions.length > 0 && !open && (
            <button
              type="button"
              className="create-league-link tracker-close-day"
              disabled={busy}
              onClick={() => void closeDay()}
            >
              Cerrar el día de juego
            </button>
          )}
        </section>
      )}
    </section>
  );
}
