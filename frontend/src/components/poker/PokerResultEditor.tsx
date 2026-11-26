import { useState, type FormEvent } from 'react';
import SheetDialog from '../SheetDialog';
import type { PokerResultsEdit, PokerSession } from '../../services/endpoints/poker';
import { PokerAvatar } from './PokerFaces';
import { euros } from './pokerFormat';

interface Props {
  session: PokerSession;
  busy: boolean;
  onSave: (changes: PokerResultsEdit) => Promise<boolean>;
  onClose: () => void;
}

/** Céntimos a texto de euros para un campo numérico (sin ceros de más). */
const eurosInput = (cents: number) => String(cents / 100);
/** Lo escrito en un campo de euros, en céntimos; vacío o inválido cuenta como 0. */
const cents = (text: string) =>
  Math.max(0, Math.round((Number(text.replace(',', '.')) || 0) * 100));
const pointsValue = (text: string) =>
  Math.max(0, Math.round((Number(text.replace(',', '.')) || 0) * 100) / 100);

/**
 * Corrige todo un torneo cerrado: fecha, precios, orden final, recompras y add-ons, y el premio y los
 * puntos de cada puesto. El bote y lo que sobra se recalculan mientras se escribe.
 */
export default function PokerResultEditor({ session, busy, onSave, onClose }: Props) {
  const { rebuy, addOn } = session.settings;
  const [date, setDate] = useState(session.date);
  const [buyIn, setBuyIn] = useState(eurosInput(session.settings.buyInCents));
  const [rebuyCost, setRebuyCost] = useState(eurosInput(rebuy?.costCents ?? 0));
  const [addOnCost, setAddOnCost] = useState(eurosInput(addOn?.costCents ?? 0));
  const [rows, setRows] = useState(() =>
    session.results.map((result) => ({
      playerId: result.playerId,
      name: result.name,
      rebuys: result.rebuys,
      addOns: result.addOns,
    })),
  );
  // El premio y los puntos van con el puesto, no con el jugador: al reordenar se quedan en su sitio.
  const [places, setPlaces] = useState(() =>
    session.results.map((result) => ({
      prize: eurosInput(result.prizeCents),
      points: String(result.points ?? 0),
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

  function patchPlace(index: number, change: Partial<(typeof places)[number]>) {
    setPlaces(
      places.map((place, position) => (position === index ? { ...place, ...change } : place)),
    );
  }

  const pot = rows.reduce(
    (sum, row) =>
      sum + cents(buyIn) + row.rebuys * cents(rebuyCost) + row.addOns * cents(addOnCost),
    0,
  );
  const shared = places.reduce((sum, place) => sum + cents(place.prize), 0);
  const leftover = pot - shared;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await onSave({
      date,
      buyInCents: cents(buyIn),
      rebuyCostCents: rebuy ? cents(rebuyCost) : undefined,
      addOnCostCents: addOn ? cents(addOnCost) : undefined,
      standings: rows.map(({ playerId, rebuys, addOns }, index) => ({
        playerId,
        rebuys,
        addOns,
        prizeCents: cents(places[index].prize),
        points: pointsValue(places[index].points),
      })),
    });
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
        inputMode="numeric"
        className="glass-input"
        min={0}
        max={limit ?? 99}
        value={value}
        onChange={(event) => set(Math.max(0, Math.trunc(Number(event.target.value) || 0)))}
      />
    </label>
  );

  const money = (label: string, value: string, set: (text: string) => void, aria?: string) => (
    <label className="poker-edit-count">
      <span aria-hidden={aria ? true : undefined}>{label}</span>
      <input
        aria-label={aria}
        type="number"
        inputMode="decimal"
        className="glass-input"
        min={0}
        step={0.01}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );

  return (
    <SheetDialog
      title="Editar torneo"
      subtitle="Todo se puede corregir: el bote y lo que sobra se recalculan al momento."
      onClose={onClose}
    >
      <form
        className="sheet-dialog-body poker-result-editor"
        onSubmit={(event) => void submit(event)}
      >
        <fieldset className="poker-edit-basics">
          <legend>Torneo</legend>
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
          {money('Entrada (€)', buyIn, setBuyIn)}
          {rebuy && money('Recompra (€)', rebuyCost, setRebuyCost)}
          {addOn && money('Add-on (€)', addOnCost, setAddOnCost)}
        </fieldset>
        <dl className="poker-edit-totals" aria-live="polite">
          <div>
            <dt>Bote</dt>
            <dd>{euros(pot)}</dd>
          </div>
          <div>
            <dt>Repartido</dt>
            <dd>{euros(shared)}</dd>
          </div>
          <div className={leftover < 0 ? 'is-over' : undefined}>
            <dt>{leftover < 0 ? 'Se pasa' : 'Sobra'}</dt>
            <dd>{euros(Math.abs(leftover))}</dd>
          </div>
        </dl>
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
              <span className="poker-edit-fields">
                {money(
                  'Premio (€)',
                  places[index].prize,
                  (prize) => patchPlace(index, { prize }),
                  `Premio del ${index + 1}.º`,
                )}
                <label className="poker-edit-count">
                  <span aria-hidden="true">Puntos</span>
                  <input
                    aria-label={`Puntos del ${index + 1}.º`}
                    type="number"
                    inputMode="decimal"
                    className="glass-input"
                    min={0}
                    max={1000}
                    step={0.01}
                    value={places[index].points}
                    onChange={(event) => patchPlace(index, { points: event.target.value })}
                  />
                </label>
                {rebuy &&
                  counter('Recompras', row.name, row.rebuys, rebuy.limit, (rebuys) =>
                    patch(index, { rebuys }),
                  )}
                {addOn &&
                  counter('Add-ons', row.name, row.addOns, addOn.limit, (addOns) =>
                    patch(index, { addOns }),
                  )}
              </span>
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
