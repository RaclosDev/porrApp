import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import DialogBackdrop from '../DialogBackdrop';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import PokerPrizeShares, { draftPrizes, draftValid, type PrizeDraft } from './PokerPrizeShares';
import { euros } from './pokerFormat';

/** Puesto final de un jugador; `tied` son los ids que comparten ese puesto (él incluido). */
export interface Standing {
  place: number;
  playerId: number;
  name: string;
  tied: number[];
}

/** Lo que cobra cada jugador: los empatados suman los premios de sus puestos y los parten. */
function prizeLines(standings: Standing[], prizes: number[]) {
  return standings
    .map((row) => {
      const shared = prizes
        .slice(row.place - 1, row.place - 1 + row.tied.length)
        .reduce((sum, prize) => sum + prize, 0);
      const extraCent = row.tied.indexOf(row.playerId) < shared % row.tied.length ? 1 : 0;
      return { ...row, prize: Math.floor(shared / row.tied.length) + extraCent };
    })
    .filter((row) => row.prize > 0)
    .map((row) => `${row.place}.º ${row.name} · ${euros(row.prize)}`);
}

/** «1.º Laura» para cada puesto premiado; si hay empate, todos los que lo comparten. */
function placeLabels(standings: Standing[], count: number) {
  return Array.from({ length: count }, (_, index) => {
    const place = index + 1;
    const names = standings
      .filter((row) => row.place <= place && place < row.place + row.tied.length)
      .map((row) => row.name);
    return `${place}.º ${names.join(' / ') || 'puesto'}`;
  });
}

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  standings: Standing[];
  pot: number;
  initial: PrizeDraft;
  maxPlaces: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (draft: PrizeDraft) => void;
}

/** Confirmación del cierre del torneo con el reparto editable, por si hay un acuerdo de última hora. */
export default function PokerCloseDialog({
  title,
  message,
  confirmLabel,
  standings,
  pot,
  initial,
  maxPlaces,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(initial);
  const valid = draftValid(draft, pot);
  useDialogFocus(dialogRef, { onEscape: onCancel });

  return createPortal(
    <DialogBackdrop className="app-confirm-overlay" onDismiss={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="league-admin-confirm-dialog paper-panel poker-close-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poker-close-title"
        aria-describedby="poker-close-message"
      >
        <span className="league-admin-confirm-icon">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <h3 id="poker-close-title">{title}</h3>
        <p id="poker-close-message">{message}</p>
        <form
          className="poker-form"
          aria-label="Reparto de premios al cerrar"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onConfirm(draft);
          }}
        >
          <PokerPrizeShares
            draft={draft}
            onChange={setDraft}
            pot={pot}
            maxPlaces={maxPlaces}
            disabled={busy}
            placeLabels={placeLabels(standings, draft.values.length)}
          />
          {valid && (
            <ul className="app-confirm-details" aria-label="Premios que se guardarán">
              {prizeLines(standings, draftPrizes(draft, pot)).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <div className="league-admin-confirm-actions">
            <button type="button" className="league-admin-btn is-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="league-admin-btn is-danger" disabled={busy || !valid}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
