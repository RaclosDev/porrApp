interface Props {
  shares: number[];
  onChange: (shares: number[]) => void;
  /** Puestos premiados como máximo; en juego no puede haber más que jugadores. */
  maxPlaces?: number;
  disabled?: boolean;
}

export function sharesTotal(shares: number[]) {
  return shares.reduce((sum, share) => sum + share, 0) || 0;
}

/** Campos del reparto de premios por puesto, con el total y los botones para añadir o quitar. */
export default function PokerPrizeShares({ shares, onChange, maxPlaces = 20, disabled }: Props) {
  const total = sharesTotal(shares);
  return (
    <>
      <div className="poker-fields poker-share-fields">
        {shares.map((value, index) => (
          <label key={index}>
            Puesto {index + 1} (%)
            <input
              type="number"
              className="glass-input"
              required
              inputMode="numeric"
              step="1"
              min={1}
              max={100}
              disabled={disabled}
              value={Number.isNaN(value) ? '' : value}
              onChange={(event) => {
                const share = Math.round(event.currentTarget.valueAsNumber);
                onChange(shares.map((old, i) => (i === index ? share : old)));
              }}
            />
          </label>
        ))}
      </div>
      <div className="poker-actions">
        <span className={total === 100 ? 'poker-total' : 'poker-total is-off'}>
          Reparto total {total} %{total < 100 && ` · falta un ${100 - total} %`}
          {total > 100 && ` · sobra un ${total - 100} %`}
        </span>
        <button
          type="button"
          className="glass-btn"
          disabled={disabled || shares.length >= Math.min(20, maxPlaces)}
          onClick={() => onChange([...shares, 1])}
        >
          Añadir premio
        </button>
        <button
          type="button"
          className="glass-btn"
          disabled={disabled || shares.length <= 1}
          onClick={() => onChange(shares.slice(0, -1))}
        >
          Quitar último premio
        </button>
      </div>
    </>
  );
}
