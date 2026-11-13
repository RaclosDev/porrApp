import type { PokerCommandExtra, PokerSettings } from '../../services/endpoints/poker';
import { euros } from './pokerFormat';

type PrizeMode = 'percent' | 'amount';

/** Reparto en edición: porcentajes por puesto o cantidades fijas en céntimos. */
export interface PrizeDraft {
  mode: PrizeMode;
  values: number[];
}

export function sharesTotal(shares: number[]) {
  return shares.reduce((sum, share) => sum + share, 0) || 0;
}

/** Mismo cálculo que el servidor: los céntimos que sobran van al primer puesto. */
function splitPot(pot: number, shares: number[]) {
  const prizes = shares.map((share) => Math.floor((pot * share) / 100));
  if (prizes.length > 0) prizes[0] += pot - prizes.reduce((sum, prize) => sum + prize, 0);
  return prizes;
}

export function draftFromSettings({ prizeAmounts, prizeShares }: PokerSettings): PrizeDraft {
  return prizeAmounts
    ? { mode: 'amount', values: [...prizeAmounts] }
    : { mode: 'percent', values: [...prizeShares] };
}

/** Si el reparto se puede guardar: porcentajes que suman 100 o cantidades que caben en el bote. */
export function draftValid({ mode, values }: PrizeDraft, pot: number) {
  if (values.length === 0 || !values.every((value) => Number.isInteger(value) && value >= 1)) {
    return false;
  }
  return mode === 'percent' ? sharesTotal(values) === 100 : sharesTotal(values) <= pot;
}

/**
 * Premio de cada puesto, como lo calcula el servidor. Con cantidades fijas, lo que sobra del bote
 * se suma al primer puesto (igual que los céntimos de los porcentajes): el bote se reparte entero.
 */
export function draftPrizes(draft: PrizeDraft, pot: number) {
  if (draft.mode === 'percent') return splitPot(pot, draft.values);
  const prizes = [...draft.values];
  const rest = pot - sharesTotal(prizes);
  if (prizes.length > 0 && rest > 0) prizes[0] += rest;
  return prizes;
}

export function prizeCommand(draft: PrizeDraft): PokerCommandExtra {
  return draft.mode === 'percent' ? { prizeShares: draft.values } : { prizeAmounts: draft.values };
}

/** Pasa el reparto al otro modo conservando, en lo posible, lo que recibe cada puesto. */
function switchMode(draft: PrizeDraft, mode: PrizeMode, pot: number): PrizeDraft {
  if (draft.mode === mode) return draft;
  if (mode === 'amount') {
    const values =
      sharesTotal(draft.values) === 100
        ? splitPot(pot, draft.values)
        : draft.values.map((share) => Math.floor((pot * (share || 0)) / 100));
    return { mode, values: values.map((value) => Math.max(1, value)) };
  }
  // Si las cantidades superan el bote, se conserva al menos la proporción entre puestos.
  const base = Math.max(pot, sharesTotal(draft.values));
  const values = draft.values.map((value) =>
    base > 0 ? Math.max(1, Math.round(((value || 0) * 100) / base)) : 1,
  );
  values[0] = Math.max(1, values[0] + 100 - sharesTotal(values));
  return { mode, values };
}

interface Props {
  draft: PrizeDraft;
  onChange: (draft: PrizeDraft) => void;
  /** Puestos premiados como máximo; en juego no puede haber más que jugadores. */
  maxPlaces?: number;
  disabled?: boolean;
  /** Bote en céntimos. Con él se puede repartir también en cantidades fijas (€). */
  pot?: number;
  /** Etiqueta de cada puesto, p. ej. «1.º Laura»; por defecto, «Puesto 1». */
  placeLabels?: string[];
}

/** Campos del reparto de premios por puesto, con el total y los botones para añadir o quitar. */
export default function PokerPrizeShares({
  draft,
  onChange,
  maxPlaces = 20,
  disabled,
  pot,
  placeLabels,
}: Props) {
  const { mode, values } = draft;
  const amounts = mode === 'amount';
  const total = sharesTotal(values);
  const setValues = (next: number[]) => onChange({ mode, values: next });
  let summary: string;
  let off: boolean;
  if (amounts) {
    const rest = (pot ?? 0) - total;
    off = !(rest >= 0);
    summary = `Reparto total ${euros(total)} de ${euros(pot ?? 0)}`;
    if (rest < 0) summary += ` · supera el bote en ${euros(-rest)}`;
    else if (rest > 0) summary += ` · sobran ${euros(rest)}, que se suman al 1.º puesto`;
  } else {
    off = total !== 100;
    summary = `Reparto total ${total} %`;
    if (total < 100) summary += ` · falta un ${100 - total} %`;
    if (total > 100) summary += ` · se pasa un ${total - 100} %`;
  }
  return (
    <>
      {pot !== undefined && (
        <div className="poker-prize-mode" role="group" aria-label="Repartir el bote en">
          {(
            [
              ['percent', 'Porcentaje (%)'],
              ['amount', 'Cantidad (€)'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={mode === value ? 'is-active' : undefined}
              aria-pressed={mode === value}
              disabled={disabled}
              onClick={() => onChange(switchMode(draft, value, pot))}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="poker-fields poker-share-fields">
        {values.map((value, index) => (
          <label key={index}>
            {placeLabels?.[index] ?? `Puesto ${index + 1}`} ({amounts ? '€' : '%'})
            <input
              type="number"
              className="glass-input"
              required
              inputMode={amounts ? 'decimal' : 'numeric'}
              step={amounts ? '0.01' : '1'}
              min={amounts ? 0.01 : 1}
              max={amounts ? undefined : 100}
              disabled={disabled}
              value={Number.isNaN(value) ? '' : amounts ? value / 100 : value}
              onChange={(event) => {
                const number = event.currentTarget.valueAsNumber;
                const next = Math.round(amounts ? number * 100 : number);
                setValues(values.map((old, i) => (i === index ? next : old)));
              }}
            />
          </label>
        ))}
      </div>
      <div className="poker-actions">
        <span className={off ? 'poker-total is-off' : 'poker-total'}>{summary}</span>
        <button
          type="button"
          className="glass-btn"
          disabled={disabled || values.length >= Math.min(20, maxPlaces)}
          onClick={() => setValues([...values, amounts ? 100 : 1])}
        >
          Añadir premio
        </button>
        <button
          type="button"
          className="glass-btn"
          disabled={disabled || values.length <= 1}
          onClick={() => setValues(values.slice(0, -1))}
        >
          Quitar premio
        </button>
      </div>
    </>
  );
}
