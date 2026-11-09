import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import TrackerStandings from '../components/tracker/TrackerStandings';
import TrackerIdentity from '../components/tracker/TrackerIdentity';
import TrackerInvite from '../components/tracker/TrackerInvite';
import TrackerRoundForm from '../components/tracker/TrackerRoundForm';
import {
  addTrackerPlayer,
  addTrackerRound,
  claimTrackerPlayer,
  deleteTracker,
  deleteTrackerRound,
  fetchTracker,
  leaveTracker,
  releaseTrackerPlayer,
  startTrackerSession,
  type Tracker,
} from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { confirmAction } from '../utils/confirmAction';
import { errorMessage } from '../utils/errors';

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/**
 * Marcador en directo: clasificación de la sesión, clasificación histórica y partidas. Quien lo
 * creó apunta; el resto lo ve y se actualiza solo cuando se apunta algo.
 */
export default function TrackerView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // null: lo decide el marcador (abierto mientras no se ha apuntado ninguna partida).
  const [inviteOpen, setInviteOpen] = useState<boolean | null>(null);

  const query = useQuery({
    queryKey: queryKeys.tracker(id),
    queryFn: () => fetchTracker(id),
    retry: false,
  });
  const tracker = query.data;

  if (query.isPending) return <PaperLoading label="Cargando el marcador" />;
  if (!tracker) {
    return (
      <section className="view-section active create-league">
        <div className="paper-panel album-sheet create-league-sheet">
          <h1 className="poster-title create-league-title">Marcador no disponible</h1>
          <p role="alert">{errorMessage(query.error, 'No se pudo cargar el marcador')}</p>
          <Link to="/mis-ligas" className="glass-btn create-league-nav-btn">
            Ir a Mis ligas
          </Link>
        </div>
      </section>
    );
  }

  /** Ejecuta un cambio del creador y deja el marcador devuelto como el visible. */
  const change = async (action: () => Promise<Tracker>, failure: string) => {
    setBusy(true);
    try {
      queryClient.setQueryData(queryKeys.tracker(id), await action());
      return true;
    } catch (reason) {
      toast.error(errorMessage(reason, failure));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sessionId = picked ?? tracker.currentSessionId;
  const session =
    tracker.sessions.find((item) => item.id === sessionId) ??
    tracker.sessions[tracker.sessions.length - 1];
  const sessionRounds = tracker.rounds.filter((round) => round.sessionId === session?.id).reverse();
  const playerName = (playerId: string) =>
    tracker.players.find((player) => String(player.id) === playerId)?.name ?? '';
  const isCurrent = session?.id === tracker.currentSessionId;

  const startSession = async () => {
    const confirmed = await confirmAction({
      title: '¿Empezar una sesión nueva?',
      message: 'La clasificación de la sesión vuelve a cero; el histórico se conserva.',
      confirmLabel: 'Empezar sesión',
    });
    if (!confirmed) return;
    setPicked(null);
    await change(() => startTrackerSession(tracker.id), 'No se pudo empezar la sesión');
  };

  const removeRound = async (roundId: number, number: number) => {
    const confirmed = await confirmAction({
      title: `¿Borrar la partida ${number}?`,
      message: 'Se quita de la clasificación de la sesión y del histórico.',
      confirmLabel: 'Borrar partida',
    });
    if (confirmed) await change(() => deleteTrackerRound(tracker.id, roundId), 'No se pudo borrar');
  };

  const remove = async () => {
    const confirmed = await confirmAction({
      title: tracker.owner ? '¿Borrar el marcador?' : '¿Salir del marcador?',
      message: tracker.owner
        ? 'Se borran todas las partidas y el histórico para todos. No se puede deshacer.'
        : 'Dejarás de verlo; puedes volver a entrar con el enlace.',
      confirmLabel: tracker.owner ? 'Borrar marcador' : 'Salir',
    });
    if (!confirmed) return;
    try {
      await (tracker.owner ? deleteTracker(tracker.id) : leaveTracker(tracker.id));
      queryClient.removeQueries({ queryKey: queryKeys.tracker(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trackers() });
      navigate('/mis-ligas', { replace: true });
    } catch (reason) {
      toast.error(errorMessage(reason, 'No se pudo completar'));
    }
  };

  const empty = tracker.rounds.length === 0;
  const inviting = inviteOpen ?? (tracker.owner && empty);

  return (
    <section className="view-section active create-league tracker">
      <header className="create-league-header tracker-head">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">{tracker.name}</h1>
          <p className="create-league-progress" role="status">
            En directo: se actualiza solo cuando se apunta una partida.
          </p>
        </div>
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          aria-expanded={inviting}
          onClick={() => setInviteOpen(!inviting)}
        >
          {inviting ? 'Cerrar' : 'Invitar'}
        </button>
      </header>

      {inviting && (
        <TrackerInvite
          tracker={tracker}
          busy={busy}
          onAddPlayer={(name) =>
            change(() => addTrackerPlayer(tracker.id, name), 'No se pudo añadir')
          }
        />
      )}

      {session && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-session-title"
        >
          <div className="tracker-section-head">
            <h2 id="tracker-session-title" className="tracker-heading">
              Sesión {session.number}
              {isCurrent ? ' (en curso)' : ''} · {formatDay(session.startedAt)}
            </h2>
            {tracker.sessions.length > 1 && (
              <div className="tracker-select">
                <label htmlFor="tracker-session-select">Ver otra sesión</label>
                <select
                  id="tracker-session-select"
                  className="glass-input"
                  value={session.id}
                  onChange={(event) => setPicked(Number(event.target.value))}
                >
                  {[...tracker.sessions].reverse().map((item) => (
                    <option key={item.id} value={item.id}>
                      Sesión {item.number} · {formatDay(item.startedAt)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <TrackerStandings
            caption={`Clasificación de la sesión ${session.number}`}
            standings={session.standings}
            unit={tracker.unit}
            empty={session.rounds === 0}
            myPlayerId={tracker.myPlayerId}
          />
          {session.winners.length > 0 && !isCurrent && (
            <p className="tracker-note">
              Ganó{session.winners.length > 1 ? 'n' : ''}:{' '}
              {session.winners.map((winner) => playerName(String(winner))).join(', ')}
            </p>
          )}
        </section>
      )}

      <section
        className="paper-panel album-sheet tracker-section"
        aria-labelledby="tracker-overall-title"
      >
        <h2 id="tracker-overall-title" className="tracker-heading">
          Histórico de todas las sesiones
        </h2>
        <TrackerStandings
          caption="Clasificación histórica"
          standings={tracker.overall}
          unit={tracker.unit}
          showSessions
          empty={empty}
          myPlayerId={tracker.myPlayerId}
        />
        {tracker.lowerWins && <p className="tracker-note">Gana quien menos suma.</p>}
      </section>

      {tracker.owner && session && isCurrent && (
        <div className="paper-panel album-sheet">
          <TrackerRoundForm
            tracker={tracker}
            busy={busy}
            onSubmit={(round) =>
              change(() => addTrackerRound(tracker.id, round), 'No se pudo apuntar la partida')
            }
          />
        </div>
      )}

      <TrackerIdentity
        tracker={tracker}
        busy={busy}
        onClaim={(playerId) =>
          change(() => claimTrackerPlayer(tracker.id, playerId), 'No se pudo apuntarte')
        }
        onRelease={() => change(() => releaseTrackerPlayer(tracker.id), 'No se pudo quitarte')}
      />

      {session && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-rounds-title"
        >
          <h2 id="tracker-rounds-title" className="tracker-heading">
            Partidas de la sesión {session.number}
          </h2>
          {sessionRounds.length === 0 ? (
            <p className="tracker-note">Todavía no se ha apuntado ninguna partida.</p>
          ) : (
            <ol className="tracker-rounds" reversed>
              {sessionRounds.map((round) => (
                <li key={round.id} value={round.number}>
                  <div>
                    <strong>Partida {round.number}</strong>
                    {round.note ? ` · ${round.note}` : ''}
                    <span className="tracker-round-scores">
                      {Object.entries(round.scores)
                        .filter(([, points]) => points !== 0)
                        .map(([playerId, points]) => `${playerName(playerId)} ${points}`)
                        .join(' · ') || 'Sin puntos'}
                    </span>
                  </div>
                  {tracker.owner && (
                    <button
                      type="button"
                      className="create-league-link"
                      disabled={busy}
                      onClick={() => void removeRound(round.id, round.number)}
                    >
                      Borrar
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tracker.owner && (
        <section
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-manage-title"
        >
          <h2 id="tracker-manage-title" className="tracker-heading">
            Gestionar
          </h2>
          <div className="tracker-actions">
            <button
              type="button"
              className="glass-btn create-league-small-btn"
              disabled={busy || session?.rounds === 0}
              onClick={() => void startSession()}
            >
              Empezar sesión nueva
            </button>
          </div>
        </section>
      )}

      <div className="tracker-footer">
        <Link to="/mis-ligas" className="create-league-link">
          Volver a Mis ligas
        </Link>
        <button type="button" className="create-league-link" onClick={() => void remove()}>
          {tracker.owner ? 'Borrar marcador' : 'Salir del marcador'}
        </button>
      </div>
    </section>
  );
}
