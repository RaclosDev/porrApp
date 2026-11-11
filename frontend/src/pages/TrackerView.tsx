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
  closeTrackerDay,
  deleteTrackerRound,
  editTrackerRound,
  endTrackerSession,
  reopenTrackerSession,
  startTrackerDay,
  startTrackerSession,
  setTrackerSessionPlayers,
  type TrackerGameDraft,
  type TrackerRound,
} from '../services/endpoints/trackers';
import { useTrackerLeague } from '../hooks/useTrackerLeague';
import { useOfflineRounds } from '../hooks/useOfflineRounds';
import { confirmAction } from '../utils/confirmAction';

/**
 * Liga de juegos de mesa en la mesa: se empieza el día con quienes han venido, se elige juego, se
 * apunta cada ronda en la hoja y al terminar se ve quién ha ganado. Cualquier miembro apunta y todos
 * los móviles lo ven en directo.
 */
export default function TrackerView({ leagueId }: { leagueId: string | null }) {
  const { id, query, tracker, busy, change } = useTrackerLeague(leagueId);
  const offline = useOfflineRounds(tracker?.id, id);
  /** Quién juega lo siguiente que se empiece; null mientras no se toca (todos los del día). */
  const [chosen, setChosen] = useState<number[] | null>(null);
  /** Eligiendo juego aunque haya una partida a medias o un resultado que enseñar. */
  const [picking, setPicking] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);

  if (query.isPending) return <PaperLoading label="Cargando la partida" />;
  if (!tracker) return <TrackerUnavailable error={query.error} />;

  const games = tracker.games ?? [];
  const day = (tracker.days ?? []).find((item) => item.id === tracker.currentDayId) ?? null;
  const daySessions = day ? tracker.sessions.filter((item) => item.dayId === day.id) : [];
  const open = daySessions.find((item) => !item.endedAt) ?? null;
  const lastEnded =
    [...daySessions].reverse().find((item) => item.endedAt && item.rounds > 0) ?? null;
  const editingPlayers = Boolean(open && editingSessionId === open.id);
  const pendingRounds = offline.pending > 0;
  const lockedPlayers = [
    ...new Set(
      tracker.rounds
        .filter((round) => round.sessionId === open?.id)
        .flatMap((round) => Object.keys(round.scores).map(Number)),
    ),
  ];
  const gameOf = (gameId: number | null) =>
    games.find((game) => game.id === gameId) ?? {
      name: 'Partida',
      unit: tracker.unit,
      mode: 'POINTS' as const,
      lowerWins: tracker.lowerWins,
      targetWins: null,
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
    if (busy || pendingRounds) return false;
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
    if (busy || pendingRounds || selected.length === 0) return false;
    const known = new Set(games.map((item) => item.id));
    const next = await change(() => addTrackerGame(tracker.id, game), 'No se pudo crear el juego');
    const created = next?.games?.find((item) => !known.has(item.id));
    if (!created) return false;
    await play(created.id);
    return true;
  };

  const savePlayers = async () => {
    if (!open || busy || pendingRounds || selected.length === 0) return;
    if (
      await change(
        () => setTrackerSessionPlayers(tracker.id, open.id, selected),
        'No se pudieron cambiar los jugadores',
      )
    ) {
      setEditingSessionId(null);
      setChosen(null);
    }
  };

  const endSession = async () => {
    if (!open || busy || pendingRounds) return;
    const confirmed = await confirmAction({
      title: '¿Terminar la partida?',
      message:
        open.rounds === 0
          ? 'No hay rondas apuntadas. Esta partida no sumará resultados y podrás elegir otro juego.'
          : gameOf(open.gameId).targetWins && open.winners.length === 0
            ? 'Aún no se ha alcanzado el objetivo de rondas ganadas. Se guardará sin ganador. Puedes reabrirla para continuar.'
            : 'Se cierra la hoja y se ve quién ha ganado. Se puede reabrir para corregirla.',
      confirmLabel: 'Terminar partida',
    });
    if (confirmed) {
      if (await change(() => endTrackerSession(tracker.id, open.id), 'No se pudo terminar')) {
        setEditingSessionId(null);
        setChosen(null);
        if (open.rounds === 0) setPicking(true);
      }
    }
  };

  const closeDay = async () => {
    if (!day || busy || pendingRounds || (open && open.rounds > 0)) return;
    const confirmed = await confirmAction({
      title: '¿Cerrar el día de juego?',
      message: daySessions.some((session) => session.rounds > 0)
        ? 'Las partidas con resultados quedan en el histórico. Las partidas vacías se descartan.'
        : 'No hay resultados apuntados. Se descartará este día vacío y podrás empezar uno nuevo.',
      confirmLabel: 'Cerrar el día',
    });
    if (confirmed) {
      if (await change(() => closeTrackerDay(tracker.id, day.id), 'No se pudo cerrar el día')) {
        setPicking(false);
        setChosen(null);
        setEditingSessionId(null);
      }
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
      await change(
        () => deleteTrackerRound(tracker.id, round.id, round.revision),
        'No se pudo borrar',
      ),
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
            <div className="tracker-actions">
              <button
                type="button"
                className="create-league-link"
                disabled={busy || pendingRounds}
                aria-expanded={editingPlayers}
                onClick={() => {
                  setEditingSessionId(editingPlayers ? null : open.id);
                  setChosen(editingPlayers ? null : open.playerIds);
                }}
              >
                Cambiar jugadores
              </button>
              {open.rounds === 0 && !editingPlayers && (
                <button
                  type="button"
                  className="create-league-link"
                  disabled={busy || pendingRounds}
                  onClick={() => {
                    setChosen(open.playerIds);
                    setPicking(true);
                  }}
                >
                  Cambiar de juego
                </button>
              )}
            </div>
          </div>
          {offline.pending > 0 && (
            <p className="tracker-note" role="status">
              {offline.pending} {offline.pending === 1 ? 'ronda pendiente' : 'rondas pendientes'}.
              {offline.problem
                ? ` Necesita revisión: ${offline.problem}`
                : ' Se enviarán al volver la red.'}
              {offline.problem && (
                <button type="button" onClick={offline.retry}>
                  Reintentar
                </button>
              )}
            </p>
          )}
          {editingPlayers && (
            <section className="tracker-entry" aria-label="Cambiar jugadores de la partida">
              <p className="tracker-note">
                Puedes añadir a quien llegue después. Quien ya tiene resultados debe permanecer en
                la partida para conservarlos.
              </p>
              <TrackerAttendees
                label="Jugadores de esta partida"
                players={tracker.players}
                selected={selected}
                locked={lockedPlayers}
                busy={busy || pendingRounds}
                onToggle={toggle}
                onAddPlayer={addPlayer}
              />
              <div className="tracker-actions">
                <button
                  type="button"
                  className="glass-btn primary-btn"
                  disabled={busy || pendingRounds || selected.length === 0}
                  onClick={() => void savePlayers()}
                >
                  Guardar jugadores
                </button>
                <button
                  type="button"
                  className="create-league-link"
                  disabled={busy}
                  onClick={() => {
                    setEditingSessionId(null);
                    setChosen(null);
                  }}
                >
                  Cancelar cambios
                </button>
              </div>
            </section>
          )}
          <div hidden={editingPlayers}>
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
                Boolean(
                  await change(async () => {
                    const next = await offline.add(round);
                    return next === 'queued' ? tracker : next;
                  }, 'No se pudo apuntar'),
                )
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
          </div>
          <button
            type="button"
            className="glass-btn create-league-small-btn tracker-end"
            disabled={busy || pendingRounds || editingPlayers}
            onClick={() => void endSession()}
          >
            Terminar partida
          </button>
          {open.rounds === 0 && !editingPlayers && (
            <button
              type="button"
              className="create-league-link tracker-close-day"
              disabled={busy || pendingRounds}
              onClick={() => void closeDay()}
            >
              Cerrar el día de juego
            </button>
          )}
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
            leagueName={tracker.name}
            gameName={gameOf(lastEnded.gameId).name}
            unit={gameOf(lastEnded.gameId).unit}
            myPlayerId={tracker.myPlayerId}
            busy={busy || pendingRounds}
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
          {selected.length === 0 && (
            <p className="tracker-note" role="status">
              Marca al menos a un jugador para empezar una partida.
            </p>
          )}
          <TrackerGamePicker
            games={games}
            busy={busy || pendingRounds || selected.length === 0}
            onPick={(gameId) => void play(gameId)}
            onCreate={createGame}
          />
          {(!open || open.rounds === 0) && (
            <button
              type="button"
              className="create-league-link tracker-close-day"
              disabled={busy || pendingRounds}
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
