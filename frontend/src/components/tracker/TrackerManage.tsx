import { useState, type FormEvent } from 'react';
import type { Tracker, TrackerGame, TrackerPlayer } from '../../services/endpoints/trackers';
import { copyWithToast, joinLink } from '../../utils/leagueInvite';
import { confirmAction } from '../../utils/confirmAction';

type Action = () => Promise<boolean>;

interface Props {
  tracker: Tracker;
  busy: boolean;
  onRenamePlayer: (playerId: number, name: string) => Promise<boolean>;
  onDeletePlayer: (playerId: number) => Promise<boolean>;
  onMergePlayer: (playerId: number, intoPlayerId: number) => Promise<boolean>;
  onEditGame: (gameId: number, game: { name: string; unit: string }) => Promise<boolean>;
  onDeleteGame: (gameId: number) => Promise<boolean>;
}

/** Un jugador ha jugado si está en alguna partida o tiene puntos en alguna ronda. */
const hasPlayed = (tracker: Tracker, playerId: number) =>
  tracker.sessions.some((session) => session.playerIds.includes(playerId)) ||
  tracker.rounds.some((round) => round.scores[String(playerId)] !== undefined);

/**
 * Jugadores y juegos de la liga: cambiar nombres, quitar a quien se apuntó por error, juntar dos
 * jugadores que eran la misma persona y pasar a un invitado el enlace con el que hereda su histórico.
 */
export default function TrackerManage({
  tracker,
  busy,
  onRenamePlayer,
  onDeletePlayer,
  onMergePlayer,
  onEditGame,
  onDeleteGame,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const canEditPlayer = (player: TrackerPlayer) =>
    tracker.owner || player.id === tracker.myPlayerId;
  const games = tracker.games ?? [];
  if (!tracker.owner && tracker.myPlayerId == null) return null;

  const done = (action: Action) => async () => {
    if (await action()) setEditing(null);
  };

  return (
    <section className="paper-panel album-sheet tracker-section" aria-labelledby="tracker-manage">
      <h2 id="tracker-manage" className="tracker-heading">
        Jugadores y juegos
      </h2>
      <ul className="tracker-manage-list" aria-label="Jugadores">
        {tracker.players.map((player) => {
          const key = `player-${player.id}`;
          const claimed = tracker.claimedPlayerIds.includes(player.id);
          return (
            <li key={player.id}>
              <div className="tracker-manage-row">
                <span>
                  <strong>{player.name}</strong>
                  {player.id === tracker.myPlayerId && <span className="tracker-me"> (tú)</span>}
                  {!claimed && <span className="tracker-manage-tag"> · sin cuenta</span>}
                </span>
                {canEditPlayer(player) && (
                  <button
                    type="button"
                    className="create-league-link"
                    aria-expanded={editing === key}
                    aria-label={`Editar a ${player.name}`}
                    onClick={() => setEditing(editing === key ? null : key)}
                  >
                    {editing === key ? 'Cerrar' : 'Editar'}
                  </button>
                )}
              </div>
              {editing === key && (
                <PlayerEditor
                  tracker={tracker}
                  player={player}
                  claimed={claimed}
                  busy={busy}
                  onRename={(name) => done(() => onRenamePlayer(player.id, name))()}
                  onDelete={() => done(() => onDeletePlayer(player.id))()}
                  onMerge={(into) => done(() => onMergePlayer(player.id, into))()}
                />
              )}
            </li>
          );
        })}
      </ul>
      {tracker.owner && games.length > 0 && (
        <>
          <h3 className="tracker-subheading">Juegos</h3>
          <ul className="tracker-manage-list" aria-label="Juegos">
            {games.map((game) => {
              const key = `game-${game.id}`;
              return (
                <li key={game.id}>
                  <div className="tracker-manage-row">
                    <span>
                      <strong>{game.name}</strong>
                      <span className="tracker-manage-tag">
                        {' '}
                        · {game.sessions} {game.sessions === 1 ? 'partida' : 'partidas'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="create-league-link"
                      aria-expanded={editing === key}
                      aria-label={`Editar ${game.name}`}
                      onClick={() => setEditing(editing === key ? null : key)}
                    >
                      {editing === key ? 'Cerrar' : 'Editar'}
                    </button>
                  </div>
                  {editing === key && (
                    <GameEditor
                      game={game}
                      deletable={game.rounds === 0}
                      busy={busy}
                      onSave={(draft) => done(() => onEditGame(game.id, draft))()}
                      onDelete={() => done(() => onDeleteGame(game.id))()}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function PlayerEditor({
  tracker,
  player,
  claimed,
  busy,
  onRename,
  onDelete,
  onMerge,
}: {
  tracker: Tracker;
  player: TrackerPlayer;
  claimed: boolean;
  busy: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onMerge: (intoPlayerId: number) => Promise<void>;
}) {
  const [name, setName] = useState(player.name);
  const others = tracker.players.filter(
    (other) => other.id !== player.id && !(claimed && tracker.claimedPlayerIds.includes(other.id)),
  );
  const [into, setInto] = useState<number | ''>('');
  const inputId = `tracker-player-name-${player.id}`;
  const mergeId = `tracker-player-merge-${player.id}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && name.trim() !== player.name) void onRename(name.trim());
  };

  const remove = async () => {
    const confirmed = await confirmAction({
      title: `¿Quitar a ${player.name}?`,
      message: 'Desaparece de la liga. Solo se puede porque aún no ha jugado ninguna partida.',
      confirmLabel: 'Quitar jugador',
    });
    if (confirmed) await onDelete();
  };

  const merge = async () => {
    const target = tracker.players.find((other) => other.id === into);
    if (!target) return;
    const confirmed = await confirmAction({
      title: `¿Juntar a ${player.name} con ${target.name}?`,
      message: `Las partidas y rondas de ${player.name} pasan a ${target.name} y ${player.name} desaparece. No se puede deshacer.`,
      confirmLabel: 'Juntar',
    });
    if (confirmed) await onMerge(target.id);
  };

  return (
    <div className="tracker-manage-editor">
      <form className="tracker-add-player" onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="sr-only">
          Nombre de {player.name}
        </label>
        <input
          id={inputId}
          className="glass-input"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="glass-btn create-league-small-btn" disabled={busy}>
          Guardar
        </button>
      </form>
      {!claimed && (
        <p className="tracker-note">
          ¿Es alguien que se ha bajado la app?{' '}
          <button
            type="button"
            className="create-league-link"
            onClick={() =>
              void copyWithToast(
                `${joinLink(tracker.joinCode)}?jugador=${player.id}`,
                `Enlace copiado: quien entre con él será ${player.name}`,
              )
            }
          >
            Copiar su enlace «este eres tú»
          </button>
        </p>
      )}
      {tracker.owner && others.length > 0 && (
        <div className="tracker-add-player">
          <label htmlFor={mergeId} className="sr-only">
            Juntar a {player.name} con
          </label>
          <select
            id={mergeId}
            className="glass-input tracker-select"
            value={into}
            onChange={(event) => setInto(event.target.value ? Number(event.target.value) : '')}
          >
            <option value="">Es la misma persona que…</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="glass-btn create-league-small-btn"
            disabled={busy || into === ''}
            onClick={() => void merge()}
          >
            Juntar
          </button>
        </div>
      )}
      {tracker.owner && !claimed && !hasPlayed(tracker, player.id) && (
        <button
          type="button"
          className="create-league-link"
          disabled={busy}
          onClick={() => void remove()}
        >
          Quitar a {player.name}
        </button>
      )}
    </div>
  );
}

function GameEditor({
  game,
  deletable,
  busy,
  onSave,
  onDelete,
}: {
  game: TrackerGame;
  deletable: boolean;
  busy: boolean;
  onSave: (draft: { name: string; unit: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(game.name);
  const [unit, setUnit] = useState(game.unit);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) void onSave({ name: name.trim(), unit: unit.trim() });
  };

  const remove = async () => {
    const confirmed = await confirmAction({
      title: `¿Borrar ${game.name}?`,
      message: 'Aún no tiene partidas, así que no se pierde nada.',
      confirmLabel: 'Borrar juego',
    });
    if (confirmed) await onDelete();
  };

  return (
    <div className="tracker-manage-editor">
      <form className="tracker-add-player" onSubmit={submit} noValidate>
        <label htmlFor={`tracker-game-name-${game.id}`} className="sr-only">
          Nombre del juego
        </label>
        <input
          id={`tracker-game-name-${game.id}`}
          className="glass-input"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor={`tracker-game-unit-${game.id}`} className="sr-only">
          Qué se cuenta
        </label>
        <input
          id={`tracker-game-unit-${game.id}`}
          className="glass-input tracker-manage-unit"
          value={unit}
          maxLength={20}
          placeholder="puntos"
          onChange={(event) => setUnit(event.target.value)}
        />
        <button type="submit" className="glass-btn create-league-small-btn" disabled={busy}>
          Guardar
        </button>
      </form>
      {deletable && (
        <button
          type="button"
          className="create-league-link"
          disabled={busy}
          onClick={() => void remove()}
        >
          Borrar {game.name}
        </button>
      )}
    </div>
  );
}
