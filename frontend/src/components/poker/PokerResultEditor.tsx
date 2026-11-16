import { useState, type FormEvent } from 'react';
import SheetDialog from '../SheetDialog';
import type { PokerResultEdit, PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';

interface Props {
  session: PokerSession;
  busy: boolean;
  onSave: (date: string, standings: PokerResultEdit[]) => Promise<boolean>;
  onClose: () => void;
}

/** Corrige un torneo cerrado: fecha, orden final y recompras o add-ons de cada jugador. */
export default function PokerResultEditor({ session, busy, onSave, onClose }: Props) {
  const { rebuy, addOn } = session.settings;
  const [date, setDate] = useState(session.date);
  const [rows, setRows] = useState(() =>
    session.results.map((result) => ({
      playerId: result.playerId,
      name: result.name,
      rebuys: result.rebuys,
      addOns: result.addOns,
    })),
  );

  function move(index: number, step: -1 | 1) {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setRows(next);
  }

  function patch(index: number, change: Partial<(typeof rows)[number]>) {
    setRows(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await onSave(
      date,
      rows.map(({ playerId, rebuys, addOns }) => ({ playerId, rebuys, addOns })),
    );
    if (saved) onClose();
  }

  const counter = (
    label: string,
    name: string,
    value: number,
    limit: number | null,
    set: (n: number) => void,
  ) => (
    <label className="poker-edit-count">
      <span aria-hidden="true">{label}</span>
      <input
        aria-label={`${label} de ${name}`}
        type="number"
        className="glass-input"
        min={0}
        max={limit ?? 99}
        value={value}
        onChange={(event) => set(Math.max(0, Math.trunc(Number(event.target.value) || 0)))}
      />
    </label>
  );

  return (
    <SheetDialog
      title="Editar torneo"
      subtitle="Ordena a los jugadores del 1.º al último. Los premios se recalculan al guardar."
      onClose={onClose}
    >
      <form
        className="sheet-dialog-body poker-result-editor"
        onSubmit={(event) => void submit(event)}
      >
        <label className="poker-edit-date">
          Fecha
          <input
            type="date"
            className="glass-input"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <ol className="poker-edit-list" aria-label="Clasificación final">
          {rows.map((row, index) => (
            <li key={row.playerId}>
              <span className="poker-edit-place">{index + 1}.º</span>
              <span className="poker-player">
                <PokerAvatar playerId={row.playerId} name={row.name} size={28} />
                <strong>{row.name}</strong>
              </span>
              <span className="poker-edit-move">
                <button
                  type="button"
                  className="glass-btn poker-icon-btn"
                  aria-label={`Subir a ${row.name}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="glass-btn poker-icon-btn"
                  aria-label={`Bajar a ${row.name}`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </span>
              {rebuy &&
                counter('Recompras', row.name, row.rebuys, rebuy.limit, (rebuys) =>
                  patch(index, { rebuys }),
                )}
              {addOn &&
                counter('Add-ons', row.name, row.addOns, addOn.limit, (addOns) =>
                  patch(index, { addOns }),
                )}
            </li>
          ))}
        </ol>
        <div className="poker-actions">
          <button type="submit" className="glass-btn primary-btn" disabled={busy}>
            Guardar cambios
          </button>
          <button type="button" className="glass-btn" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </SheetDialog>
  );
}
