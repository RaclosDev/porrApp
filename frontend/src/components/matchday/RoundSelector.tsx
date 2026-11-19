import { displayRoundLabel } from '../../utils/matchday';
import SelectMenu from '../SelectMenu';

interface RoundSelectorProps {
  rounds: string[];
  selected: string | null;
  /** Posición de la jornada elegida en `rounds`; -1 si no hay ninguna. */
  index: number;
  onSelect: (round: string) => void;
}

/** Selector de jornada con botones de anterior y siguiente. */
export default function RoundSelector({ rounds, selected, index, onSelect }: RoundSelectorProps) {
  return (
    <div className="md-round-bar">
      <button
        type="button"
        className="glass-btn md-round-step"
        onClick={() => onSelect(rounds[index - 1])}
        disabled={index <= 0}
        aria-label="Jornada anterior"
      >
        ‹
      </button>

      <SelectMenu
        className="md-round-select"
        label="Seleccionar jornada"
        value={selected || ''}
        onChange={onSelect}
        items={rounds.map((r) => ({ value: r, label: displayRoundLabel(r) }))}
      />

      <button
        type="button"
        className="glass-btn md-round-step"
        onClick={() => onSelect(rounds[index + 1])}
        disabled={index === -1 || index >= rounds.length - 1}
        aria-label="Jornada siguiente"
      >
        ›
      </button>
    </div>
  );
}
