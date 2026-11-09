import { useId } from 'react';
import type { ScorerCandidate } from '../../types/api';
import { suggestPlayers } from '../../utils/scorerPicks';

interface ScorerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Jugadores de la competición; sin ellos se escribe el nombre a mano. */
  players: ScorerCandidate[];
  disabled?: boolean;
  className?: string;
}

/**
 * Campo del pichichi: propone jugadores de la competición mientras se escribe, pero deja escribir
 * cualquier nombre (el servidor lo empareja con el jugador real sin fijarse en tildes ni mayúsculas).
 */
export default function ScorerInput({
  value,
  onChange,
  players,
  disabled = false,
  className = 'glass-input flex-1 min-w-50',
}: ScorerInputProps) {
  const listId = useId();
  const options = players.length > 0 ? suggestPlayers(players, value, 12) : [];
  return (
    <>
      <input
        type="text"
        placeholder="Pichichi"
        aria-label="Pichichi"
        value={value}
        maxLength={120}
        disabled={disabled}
        autoComplete="off"
        list={options.length > 0 ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((player) => (
            <option
              key={`${player.playerId}:${player.name}`}
              value={player.name}
              label={player.team}
            />
          ))}
        </datalist>
      )}
    </>
  );
}
