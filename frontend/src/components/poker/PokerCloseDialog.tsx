import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import DialogBackdrop from '../DialogBackdrop';
import InfoTip from '../InfoTip';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { PactPoints, PokerPayout } from '../../services/endpoints/poker';
import { draftPrizes, draftValid, type PrizeDraft } from './PokerPrizeShares';
import { euros, fullPrizes } from './pokerFormat';
import { suggestPayouts, type MoneySplit } from './pokerPayouts';

/** Puesto final de un jugador; `tied` son los ids que comparten ese puesto (él incluido). */
export interface Standing {
  place: number;
  playerId: number;
  name: string;
  tied: number[];
  /** Fichas finales de los que siguen en la mesa cuando pactan. */
  chips?: number;
}

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  standings: Standing[];
  pot: number;
  initial: PrizeDraft;
  /** Redondeo del dinero sugerido, en céntimos. */
  step: number;
  pactPoints: PactPoints;
  /** Puntos por puesto elegidos al preparar el torneo; null, la escala de siempre. */
  prizePoints?: number[] | null;
  /** Si se contaron las fichas; sin contarlas no hay ICM y se sugiere a partes iguales. */
  counted: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (draft: PrizeDraft, payouts: PokerPayout[]) => void;
}

/** Lo que cuenta para cada uno en las estadísticas y la liga: su premio más su parte del sobrante. */
export function FullPrizesTip({
  rows,
  leftoverCents,
}: {
  rows: { playerId: number; name: string; prizeCents: number }[];
  leftoverCents: number;
}) {
  const prizes = fullPrizes({ results: rows, leftoverCents });
  const paid = rows.filter((row) => row.prizeCents > 0);
  if (leftoverCents <= 0 || paid.length === 0) return null;
  return (
    <InfoTip label="Cuánto cuenta para cada uno">
      Con el sobrante repartido, en las estadísticas y la liga cuenta:
      <span className="poker-full-prizes">
        {paid.map((row) => (
          <span key={row.playerId}>
            {row.name} <strong>{euros(prizes.get(row.playerId) ?? row.prizeCents)}</strong>
          </span>
        ))}
      </span>
    </InfoTip>
  );
}

const pointsLabel = (points: number) =>
  points.toLocaleString('es-ES', { maximumFractionDigits: 2 });

/** Confirmación del cierre del torneo con el reparto editable, por si hay un acuerdo de última hora. */
export default function PokerCloseDialog({
  title,
  message,
  confirmLabel,
  standings,
  pot,
  initial,
  step,
  pactPoints,
  prizePoints,
  counted,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // El reparto por puesto se cambia en juego; aquí solo sirve de base para sugerir.
  const draft = initial;
  const placePrizes = draftValid(initial, pot) ? draftPrizes(initial, pot) : [];
  const pact = counted && standings.filter((row) => row.chips !== undefined).length > 1;
  const [money, setMoney] = useState<MoneySplit>(counted ? 'ICM' : 'EQUAL');
  const suggest = (nextDraft: PrizeDraft, nextMoney: MoneySplit) =>
    suggestPayouts(standings, draftPrizes(nextDraft, pot), {
      step,
      money: nextMoney,
      points: counted ? pactPoints : 'EQUAL',
      prizePoints,
    });
  const [payouts, setPayouts] = useState(() =>
    draftValid(initial, pot) ? suggest(initial, money) : [],
  );
  // Se ven los que siguen en la mesa y los que cobran algo; los demás, uno a uno si se acuerda darles algo.
  const [shown, setShown] = useState(() =>
    payouts.reduce(
      (last, row, index) =>
        row.prizeCents > 0 || row.points > 0 || standings[index]?.chips !== undefined
          ? index + 1
          : last,
      1,
    ),
  );
  // Una casilla vacía cuenta como 0.
  const filled = payouts.map((row) => ({
    ...row,
    prizeCents: Number.isNaN(row.prizeCents) ? 0 : row.prizeCents,
    points: Number.isNaN(row.points) ? 0 : row.points,
  }));
  const valid =
    draftValid(draft, pot) &&
    filled.length === standings.length &&
    filled.every(
      (row) =>
        Number.isSafeInteger(row.prizeCents) &&
        row.prizeCents >= 0 &&
        Number.isFinite(row.points) &&
        row.points >= 0 &&
        row.points <= 1000,
    );
  const handedOut = payouts.reduce((sum, row) => sum + (row.prizeCents || 0), 0);
  const leftover = pot - handedOut;
  const totalPoints = payouts.reduce((sum, row) => sum + (row.points || 0), 0);
  const names = new Map(standings.map((row) => [row.playerId, row.name]));
  const fullTip = (
    <FullPrizesTip
      rows={filled.map((row) => ({ ...row, name: names.get(row.playerId) ?? '' }))}
      leftoverCents={leftover}
    />
  );
  useDialogFocus(dialogRef, { onEscape: onCancel });

  function changeMoney(next: MoneySplit) {
    setMoney(next);
    if (draftValid(draft, pot)) setPayouts(suggest(draft, next));
  }

  function editPayout(playerId: number, change: Partial<PokerPayout>) {
    setPayouts((rows) =>
      rows.map((row) => (row.playerId === playerId ? { ...row, ...change } : row)),
    );
  }

  return createPortal(
    <DialogBackdrop className="app-confirm-overlay" onDismiss={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="league-admin-confirm-dialog paper-panel poker-close-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poker-close-title"
      >
        <div className="poker-close-head">
          <div className="poker-title-with-tip">
            <h3 id="poker-close-title">{title}</h3>
            <InfoTip label="Qué se guarda al cerrar">{message}</InfoTip>
          </div>
          {shown < payouts.length && (
            <button
              type="button"
              className="glass-btn poker-payout-more"
              disabled={busy}
              onClick={() => setShown(shown + 1)}
            >
              <Plus size={16} aria-hidden="true" />
              Añadir siguiente clasificado
            </button>
          )}
        </div>
        <form
          className="poker-form"
          aria-label="Reparto de premios al cerrar"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onConfirm(draft, filled);
          }}
        >
          <fieldset className="poker-payouts">
            <legend className="poker-title-with-tip">
              Lo que se lleva cada uno
              {placePrizes.length > 0 && (
                <InfoTip label="De dónde sale la sugerencia">
                  Sugerido con los premios por puesto:{' '}
                  {placePrizes.map((cents, index) => `${index + 1}.º ${euros(cents)}`).join(' · ')}.
                  Puedes cambiar el dinero y los puntos de cada uno.
                </InfoTip>
              )}
            </legend>
            {pact && (
              <div
                className="poker-prize-mode"
                role="group"
                aria-label="Sugerir el dinero del pacto"
              >
                {(
                  [
                    ['ICM', 'Según fichas (ICM)'],
                    ['EQUAL', 'A partes iguales'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={money === value ? 'is-active' : undefined}
                    aria-pressed={money === value}
                    disabled={busy}
                    onClick={() => changeMoney(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="poker-payout-row poker-payout-head" aria-hidden="true">
              <span />
              <span>€</span>
              <span>Puntos</span>
            </div>
            {payouts.slice(0, shown).map((row) => {
              const standing = standings.find((item) => item.playerId === row.playerId);
              const place = standing?.place ?? 0;
              const who = `${place}.º ${standing?.name ?? ''}`;
              return (
                <div key={row.playerId} className="poker-payout-row">
                  <span className="poker-payout-name">
                    <span
                      className={`poker-place-badge${place <= 3 ? ` is-podium-${place}` : ''}`}
                      aria-hidden="true"
                    >
                      {place}
                    </span>
                    <span className="sr-only">{place}.º </span>
                    <span className="poker-payout-player">{standing?.name}</span>
                  </span>
                  <label>
                    <input
                      type="number"
                      className="glass-input"
                      inputMode="decimal"
                      placeholder="0"
                      step="0.01"
                      min={0}
                      aria-label={`Dinero para ${who}`}
                      disabled={busy}
                      value={Number.isNaN(row.prizeCents) ? '' : row.prizeCents / 100}
                      onChange={(event) =>
                        editPayout(row.playerId, {
                          prizeCents: Math.round(event.currentTarget.valueAsNumber * 100),
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="number"
                      className="glass-input"
                      inputMode="decimal"
                      placeholder="0"
                      step="0.01"
                      min={0}
                      max={1000}
                      aria-label={`Puntos para ${who}`}
                      disabled={busy}
                      value={Number.isNaN(row.points) ? '' : row.points}
                      onChange={(event) =>
                        editPayout(row.playerId, {
                          points: Math.round(event.currentTarget.valueAsNumber * 100) / 100,
                        })
                      }
                    />
                  </label>
                </div>
              );
            })}
            {leftover > 0 && (
              <p className="poker-payout-note">
                El sobrante cuenta igual en las estadísticas y la liga.
                {fullTip}
              </p>
            )}
            <dl
              className={leftover < 0 ? 'poker-payout-summary is-off' : 'poker-payout-summary'}
              role="status"
              aria-live="polite"
            >
              <div>
                <dt>Bote</dt>
                <dd>{euros(pot)}</dd>
              </div>
              <div>
                <dt>Repartido</dt>
                <dd>{euros(handedOut)}</dd>
              </div>
              <div className="poker-payout-leftover">
                <dt>
                  {leftover < 0 ? 'Te pasas' : 'Sobran'}
                  {fullTip}
                </dt>
                <dd>{euros(Math.abs(leftover))}</dd>
              </div>
              <div>
                <dt>Puntos</dt>
                <dd>{pointsLabel(totalPoints)}</dd>
              </div>
            </dl>
          </fieldset>
          <div className="league-admin-confirm-actions">
            <button type="button" className="league-admin-btn is-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="league-admin-btn is-primary" disabled={busy || !valid}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
