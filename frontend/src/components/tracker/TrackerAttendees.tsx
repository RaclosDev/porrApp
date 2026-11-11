import type { TrackerPlayer } from '../../services/endpoints/trackers';
import TrackerAddPlayer from './TrackerAddPlayer';

interface Props {
  /** Texto del grupo de botones, para lectores de pantalla. */
  label: string;
  players: TrackerPlayer[];
  selected: number[];
  locked?: number[];
  busy: boolean;
  onToggle: (playerId: number) => void;
  onAddPlayer: (name: string) => Promise<boolean>;
}

/** Quién está en la mesa: un toque marca o desmarca a cada jugador; quien falte se añade aquí mismo. */
export default function TrackerAttendees({
  label,
  players,
  selected,
  locked = [],
  busy,
  onToggle,
  onAddPlayer,
}: Props) {
  return (
    <div className="tracker-attendees">
      {players.length === 0 ? (
        <p className="tracker-note">Todavía no hay jugadores: añade a quienes vais a jugar.</p>
      ) : (
        <div className="tracker-chips" role="group" aria-label={label}>
          {players.map((player) => {
            const on = selected.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                className={`tracker-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                disabled={busy || locked.includes(player.id)}
                onClick={() => onToggle(player.id)}
              >
                <span aria-hidden="true">{on ? '✓' : '+'}</span> {player.name}
              </button>
            );
          })}
        </div>
      )}
      <TrackerAddPlayer busy={busy} onAddPlayer={onAddPlayer} label="Nombre del jugador nuevo" />
    </div>
  );
}
