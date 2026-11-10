import { useState, type FormEvent } from 'react';
import type { TrackerPlayer } from '../../services/endpoints/trackers';

interface Props {
  /** Texto del grupo de botones, para lectores de pantalla. */
  label: string;
  players: TrackerPlayer[];
  selected: number[];
  busy: boolean;
  onToggle: (playerId: number) => void;
  onAddPlayer: (name: string) => Promise<boolean>;
}

/** Quién está en la mesa: un toque marca o desmarca a cada jugador; quien falte se añade aquí mismo. */
export default function TrackerAttendees({
  label,
  players,
  selected,
  busy,
  onToggle,
  onAddPlayer,
}: Props) {
  const [name, setName] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (await onAddPlayer(name.trim())) setName('');
  };

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
                disabled={busy}
                onClick={() => onToggle(player.id)}
              >
                <span aria-hidden="true">{on ? '✓' : '+'}</span> {player.name}
              </button>
            );
          })}
        </div>
      )}
      <form className="tracker-add-player" onSubmit={submit}>
        <label htmlFor="tracker-new-player" className="sr-only">
          Nombre del jugador nuevo
        </label>
        <input
          id="tracker-new-player"
          className="glass-input"
          maxLength={40}
          autoComplete="off"
          placeholder="Añadir jugador"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="glass-btn create-league-small-btn"
          disabled={busy || !name.trim()}
        >
          Añadir
        </button>
      </form>
    </div>
  );
}
