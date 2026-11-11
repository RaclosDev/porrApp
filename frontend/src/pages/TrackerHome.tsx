import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import TrackerIdentity from '../components/tracker/TrackerIdentity';
import TrackerInvite from '../components/tracker/TrackerInvite';
import TrackerAddPlayer from '../components/tracker/TrackerAddPlayer';
import TrackerManage from '../components/tracker/TrackerManage';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import { formatDay, winnerLabel } from '../components/tracker/trackerFormat';
import { useTrackerLeague } from '../hooks/useTrackerLeague';
import {
  addTrackerPlayer,
  claimTrackerPlayer,
  deleteTracker,
  deleteTrackerGame,
  deleteTrackerPlayer,
  editTrackerGame,
  leaveTracker,
  mergeTrackerPlayer,
  releaseTrackerPlayer,
  renameTrackerPlayer,
  type Tracker,
  type TrackerSession,
} from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { confirmAction } from '../utils/confirmAction';
import { errorMessage } from '../utils/errors';

/**
 * Inicio de una liga de juegos de mesa: el día de juego en curso (o el botón para empezarlo), el
 * podio, el último día jugado, invitar y quién eres. La hoja está en Partida; la clasificación
 * completa, en Ranking, y los días, en Histórico.
 */
export default function TrackerHome({ leagueId }: { leagueId: string | null }) {
  const { id, query, tracker, busy, change } = useTrackerLeague(leagueId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<boolean | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  if (query.isPending) return <PaperLoading label="Cargando la liga" />;
  if (!tracker) return <TrackerUnavailable error={query.error} />;

  const remove = async () => {
    const confirmed = await confirmAction({
      title: tracker.owner ? '¿Borrar la liga?' : '¿Salir de la liga?',
      message: tracker.owner
        ? 'Se borran todas las partidas y el histórico para todos. No se puede deshacer.'
        : 'Dejarás de verla; puedes volver a entrar con el enlace.',
      confirmLabel: tracker.owner ? 'Borrar liga' : 'Salir',
    });
    if (!confirmed) return;
    try {
      await (tracker.owner ? deleteTracker(tracker.id) : leaveTracker(tracker.id));
      queryClient.removeQueries({ queryKey: queryKeys.tracker(id) });
      // Al salir de la lista de ligas deja de ser la activa y se abre otra.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.trackers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
      ]);
      navigate('/mis-ligas', { replace: true });
    } catch (reason) {
      toast.error(errorMessage(reason, 'No se pudo completar'));
    }
  };

  const adding = addOpen ?? tracker.players.length === 0;

  return (
    <section className="view-section active create-league tracker">
      <header className="create-league-header tracker-head">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">{tracker.name}</h1>
          <p className="create-league-progress">Liga de juegos de mesa</p>
        </div>
        <div className="tracker-actions">
          <button
            ref={addButton}
            type="button"
            className="glass-btn create-league-small-btn"
            aria-expanded={adding}
            aria-controls="tracker-add-panel"
            disabled={busy}
            onClick={() => setAddOpen(!adding)}
          >
            Añadir jugador
          </button>
          <button
            type="button"
            className="glass-btn create-league-small-btn"
            aria-expanded={inviteOpen}
            onClick={() => setInviteOpen(!inviteOpen)}
          >
            {inviteOpen ? 'Cerrar invitación' : 'Invitar con enlace'}
          </button>
        </div>
      </header>
      {adding && (
        <section
          id="tracker-add-panel"
          className="paper-panel album-sheet tracker-section"
          aria-labelledby="tracker-add-title"
        >
          <div className="tracker-section-head">
            <h2 id="tracker-add-title" className="tracker-heading">
              Añadir jugador sin cuenta
            </h2>
            <button
              type="button"
              className="create-league-link"
              disabled={busy}
              onClick={() => {
                setAddOpen(false);
                addButton.current?.focus();
              }}
            >
              Cerrar formulario
            </button>
          </div>
          <TrackerAddPlayer
            busy={busy}
            onAddPlayer={async (name) => {
              setAddOpen(true);
              return Boolean(
                await change(() => addTrackerPlayer(tracker.id, name), 'No se pudo añadir'),
              );
            }}
          />
        </section>
      )}
      {inviteOpen && <TrackerInvite tracker={tracker} />}
      <TrackerToday tracker={tracker} />
      <TrackerPodium tracker={tracker} />
      <TrackerLastDay tracker={tracker} />
      <TrackerIdentity
        tracker={tracker}
        busy={busy}
        onClaim={async (playerId) =>
          Boolean(
            await change(() => claimTrackerPlayer(tracker.id, playerId), 'No se pudo apuntarte'),
          )
        }
        onRelease={async () =>
          Boolean(await change(() => releaseTrackerPlayer(tracker.id), 'No se pudo quitarte'))
        }
      />
      <TrackerManage
        tracker={tracker}
        busy={busy}
        onRenamePlayer={async (playerId, name) =>
          Boolean(
            await change(
              () => renameTrackerPlayer(tracker.id, playerId, name),
              'No se pudo cambiar el nombre',
            ),
          )
        }
        onDeletePlayer={async (playerId) =>
          Boolean(
            await change(() => deleteTrackerPlayer(tracker.id, playerId), 'No se pudo quitar'),
          )
        }
        onMergePlayer={async (playerId, into) =>
          Boolean(
            await change(
              () => mergeTrackerPlayer(tracker.id, playerId, into),
              'No se pudieron juntar',
            ),
          )
        }
        onEditGame={async (gameId, game) =>
          Boolean(
            await change(() => editTrackerGame(tracker.id, gameId, game), 'No se pudo guardar'),
          )
        }
        onDeleteGame={async (gameId) =>
          Boolean(await change(() => deleteTrackerGame(tracker.id, gameId), 'No se pudo borrar'))
        }
      />
      <div className="tracker-footer">
        <Link to="/mis-ligas" className="create-league-link">
          Volver a Mis ligas
        </Link>
        <button type="button" className="create-league-link" onClick={() => void remove()}>
          {tracker.owner ? 'Borrar la liga' : 'Salir de la liga'}
        </button>
      </div>
    </section>
  );
}

const gameName = (tracker: Tracker, session: TrackerSession) =>
  tracker.games?.find((game) => game.id === session.gameId)?.name ?? tracker.name;

/** Hoy: el día de juego en curso y su partida abierta, o el botón para empezar uno. */
function TrackerToday({ tracker }: { tracker: Tracker }) {
  const day = (tracker.days ?? []).find((item) => item.id === tracker.currentDayId) ?? null;
  const sessions = day ? tracker.sessions.filter((item) => item.dayId === day.id) : [];
  const open = sessions.find((item) => !item.endedAt) ?? null;
  const ended = sessions.filter((item) => item.endedAt).length;

  return (
    <section className="paper-panel album-sheet tracker-section" aria-labelledby="tracker-today">
      <h2 id="tracker-today" className="tracker-heading">
        Hoy
      </h2>
      {day ? (
        <>
          <p className="tracker-note" role="status">
            Día de juego en curso · {formatDay(day.startedAt)}.{' '}
            {ended > 0 && `${ended} ${ended === 1 ? 'partida terminada' : 'partidas terminadas'}. `}
            {open &&
              `Jugando a ${gameName(tracker, open)} · partida ${open.number}, ${open.rounds} ${
                open.rounds === 1 ? 'ronda' : 'rondas'
              }.`}
          </p>
          <Link to="/partida" className="glass-btn primary-btn tracker-submit">
            {open ? 'Ir a la partida' : 'Elegir juego'}
          </Link>
        </>
      ) : (
        <>
          <p className="tracker-note">Ningún día de juego en curso.</p>
          <Link to="/partida" className="glass-btn primary-btn tracker-submit">
            Empezar día de juego
          </Link>
        </>
      )}
    </section>
  );
}

/** Los tres primeros de la clasificación general, con el enlace al ranking completo. */
function TrackerPodium({ tracker }: { tracker: Tracker }) {
  const podium = tracker.overall.filter((row) => row.sessionsWon > 0 && row.rank <= 3).slice(0, 3);
  if (podium.length === 0) return null;
  return (
    <section className="paper-panel album-sheet tracker-section" aria-labelledby="tracker-podium">
      <div className="tracker-section-head">
        <h2 id="tracker-podium" className="tracker-heading">
          Quién va ganando
        </h2>
        <Link to="/ranking" className="create-league-link">
          Ver ranking
        </Link>
      </div>
      <ol className="tracker-podium">
        {podium.map((row) => (
          <li key={row.playerId} className={row.rank === 1 ? 'is-leader' : undefined}>
            <span className="tracker-podium-rank">{row.rank}.º</span> <strong>{row.name}</strong>
            {row.playerId === tracker.myPlayerId && <span className="tracker-me"> (tú)</span>}
            <span className="tracker-podium-wins">
              {row.sessionsWon} {row.sessionsWon === 1 ? 'partida ganada' : 'partidas ganadas'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** El último día de juego cerrado: quién vino y quién ganó cada partida. */
function TrackerLastDay({ tracker }: { tracker: Tracker }) {
  const day = [...(tracker.days ?? [])]
    .filter((item) => item.closedAt && item.sessionIds.length > 0)
    .sort((a, b) => (b.playedOn ?? b.startedAt).localeCompare(a.playedOn ?? a.startedAt))[0];
  if (!day) return null;
  const nameOf = (playerId: number) =>
    tracker.players.find((player) => player.id === playerId)?.name;
  const sessions = tracker.sessions.filter((item) => day.sessionIds.includes(item.id));
  return (
    <section className="paper-panel album-sheet tracker-section" aria-labelledby="tracker-last-day">
      <div className="tracker-section-head">
        <h2 id="tracker-last-day" className="tracker-heading">
          Último día de juego
        </h2>
        <Link to="/historico" className="create-league-link">
          Ver histórico
        </Link>
      </div>
      <p className="tracker-history-date">
        {formatDay(day.playedOn ? `${day.playedOn}T12:00:00` : day.startedAt)}
      </p>
      <p className="tracker-note">
        Vinieron {day.playerIds.map(nameOf).filter(Boolean).join(', ')}
      </p>
      <ul className="tracker-last-day">
        {sessions.map((session) => (
          <li key={session.id}>
            {gameName(tracker, session)} · partida {session.number}: {winnerLabel(session)}
          </li>
        ))}
      </ul>
    </section>
  );
}
