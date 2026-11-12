import { useEffect, useState } from 'react';
import type {
  BlindLevel,
  PokerAction,
  PokerExtra,
  PokerSession,
} from '../../services/endpoints/poker';
import { confirmAction } from '../../utils/confirmAction';
import { chips, clockAt, euros, timeLabel } from './pokerFormat';

interface Props {
  session: PokerSession;
  owner: boolean;
  busy: boolean;
  serverNow: number;
  receivedAt: number;
  onCommand: (action: PokerAction, playerId?: number) => Promise<void>;
}

function blinds(level: BlindLevel) {
  if (level.big === 0) return 'Descanso';
  const ante = level.ante ? ` · ante ${chips(level.ante)}` : '';
  return `${chips(level.small)} / ${chips(level.big)}${ante}`;
}

export default function PokerLive({
  session,
  owner,
  busy,
  serverNow,
  receivedAt,
  onCommand,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const { levels, rebuy, addOn, prizeShares, startingChips } = session.settings;
  const eliminated = new Set(session.eliminations);
  const active = session.entries.filter((entry) => !eliminated.has(entry.playerId));
  const winner = active.length === 1 ? active[0] : null;
  const lastOut = session.entries.find((entry) => entry.playerId === session.eliminations.at(-1));
  const hasExtras = session.entries.some((entry) => entry.rebuys || entry.addOns);
  const clock =
    session.clock && clockAt(session.clock, levels, serverNow + Math.max(0, now - receivedAt));
  const chipsInPlay = session.entries.reduce(
    (sum, entry) =>
      sum + startingChips + entry.rebuys * (rebuy?.chips ?? 0) + entry.addOns * (addOn?.chips ?? 0),
    0,
  );

  useEffect(() => {
    if (session.clock?.endsAt == null || winner) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [session.clock?.endsAt, winner]);

  function canBuy(extra: PokerExtra | null, used: number) {
    return Boolean(
      clock &&
      extra &&
      clock.remainingMs > 0 &&
      clock.level < extra.throughLevel &&
      used < extra.limit,
    );
  }

  async function close() {
    if (
      winner &&
      (await confirmAction({
        title: '¿Cerrar el torneo?',
        message: `${winner.name} quedará en primer puesto. Los resultados y premios se guardarán en el histórico.`,
        confirmLabel: 'Cerrar y guardar',
      }))
    ) {
      await onCommand('CLOSE');
    }
  }

  return (
    <>
      <section className="poker-felt" aria-labelledby="poker-table-title">
        <h2 id="poker-table-title" className="poster-title">
          {winner ? 'Torneo listo para cerrar' : 'Torneo en juego'}
        </h2>
        {winner ? (
          <div className="poker-winner">
            <span>Primer puesto</span>
            <strong>{winner.name}</strong>
            {session.prizes[0] > 0 && <span>{euros(session.prizes[0])} de premio</span>}
            {owner && (
              <div className="poker-actions poker-clock-actions">
                <button
                  type="button"
                  className="glass-btn primary-btn"
                  disabled={busy}
                  onClick={() => void close()}
                >
                  Cerrar torneo
                </button>
              </div>
            )}
          </div>
        ) : (
          clock && (
            <>
              <div className="poker-clock">
                <p className="poker-level" aria-live="polite">
                  <span>Nivel {clock.level + 1}</span>
                  <strong>{blinds(levels[clock.level])}</strong>
                </p>
                <span role="timer" aria-label="Tiempo restante del nivel">
                  {timeLabel(clock.remainingMs)}
                </span>
                <div className="poker-progress" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, (clock.remainingMs / (levels[clock.level].minutes * 60_000)) * 100)}%`,
                    }}
                  />
                </div>
                <p>
                  {clock.remainingMs === 0
                    ? 'Último nivel completado'
                    : clock.endsAt === null
                      ? 'Reloj en pausa'
                      : 'Tiempo restante'}
                </p>
              </div>
              {levels[clock.level + 1] && (
                <p className="poker-next">Siguiente · {blinds(levels[clock.level + 1])}</p>
              )}
              {owner && (
                <div className="poker-actions poker-clock-actions">
                  <button
                    type="button"
                    className={clock.endsAt === null ? 'glass-btn primary-btn' : 'glass-btn'}
                    disabled={busy || clock.remainingMs === 0}
                    onClick={() => void onCommand(clock.endsAt === null ? 'RESUME' : 'PAUSE')}
                  >
                    {clock.endsAt === null ? 'Reanudar' : 'Pausar'}
                  </button>
                  <button
                    type="button"
                    className="glass-btn"
                    disabled={busy || clock.level + 1 >= levels.length}
                    onClick={() => void onCommand('NEXT_LEVEL')}
                  >
                    Siguiente nivel
                  </button>
                </div>
              )}
            </>
          )
        )}
        <dl className="poker-felt-metrics">
          <div>
            <dt>En mesa</dt>
            <dd>
              {active.length} / {session.entries.length}
            </dd>
          </div>
          <div>
            <dt>Media de fichas</dt>
            <dd>{chips(Math.round(chipsInPlay / active.length))}</dd>
          </div>
          <div>
            <dt>Bote</dt>
            <dd>{euros(session.potCents)}</dd>
          </div>
        </dl>
      </section>

      <div className="poker-live-grid">
        <section className="paper-panel album-sheet poker-panel">
          <h2>Jugadores</h2>
          <ul className="poker-active-list">
            {active.map((entry) => (
              <li key={entry.playerId}>
                <div>
                  <strong>{entry.name}</strong>
                  {(entry.rebuys > 0 || entry.addOns > 0) && (
                    <p className="poker-note">
                      Recompras {entry.rebuys} · Extras {entry.addOns}
                    </p>
                  )}
                </div>
                {owner && !winner && (
                  <div className="poker-actions">
                    {canBuy(rebuy, entry.rebuys) && (
                      <button
                        type="button"
                        className="glass-btn"
                        disabled={busy}
                        aria-label={`Recompra de ${entry.name}`}
                        onClick={() => void onCommand('REBUY', entry.playerId)}
                      >
                        Recompra
                      </button>
                    )}
                    {canBuy(addOn, entry.addOns) && (
                      <button
                        type="button"
                        className="glass-btn"
                        disabled={busy}
                        aria-label={`Extra de fichas para ${entry.name}`}
                        onClick={() => void onCommand('ADD_ON', entry.playerId)}
                      >
                        Extra
                      </button>
                    )}
                    <button
                      type="button"
                      className="glass-btn poker-out-btn"
                      disabled={busy}
                      aria-label={`Eliminar a ${entry.name}`}
                      onClick={() => void onCommand('ELIMINATE', entry.playerId)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {lastOut && (
            <details className="poker-details">
              <summary>Eliminados ({session.eliminations.length})</summary>
              <div className="poker-detail-content">
                <ul className="poker-places">
                  {[...session.eliminations].reverse().map((id, index) => (
                    <li key={id}>
                      <span>{active.length + index + 1}.º</span>
                      {session.entries.find((entry) => entry.playerId === id)?.name}
                    </li>
                  ))}
                </ul>
                {owner && (
                  <button
                    type="button"
                    className="glass-btn"
                    disabled={busy}
                    onClick={() => void onCommand('UNDO_ELIMINATION')}
                  >
                    Deshacer eliminación de {lastOut.name}
                  </button>
                )}
              </div>
            </details>
          )}
          {owner && hasExtras && (
            <details className="poker-details">
              <summary>Corregir recompras y extras</summary>
              <ul className="poker-active-list poker-detail-content">
                {session.entries
                  .filter((entry) => entry.rebuys || entry.addOns)
                  .map((entry) => (
                    <li key={entry.playerId}>
                      <strong>{entry.name}</strong>
                      <div className="poker-actions">
                        {entry.rebuys > 0 && (
                          <button
                            type="button"
                            className="glass-btn"
                            disabled={busy}
                            onClick={() => void onCommand('UNDO_REBUY', entry.playerId)}
                          >
                            Quitar recompra ({entry.rebuys})
                          </button>
                        )}
                        {entry.addOns > 0 && (
                          <button
                            type="button"
                            className="glass-btn"
                            disabled={busy}
                            onClick={() => void onCommand('UNDO_ADD_ON', entry.playerId)}
                          >
                            Quitar extra ({entry.addOns})
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>

        <section className="paper-panel album-sheet poker-panel">
          <h2>Premios</h2>
          <p className="poker-pot">
            {euros(session.potCents)} <span>de bote</span>
          </p>
          <ol className="poker-prizes">
            {session.prizes.map((prize, index) => {
              const place = index + 1;
              const player =
                place === 1
                  ? winner
                  : session.entries.find(
                      (entry) =>
                        entry.playerId === session.eliminations[session.entries.length - place],
                    );
              return (
                <li key={index}>
                  <span>
                    {place}.º {player?.name ?? `${prizeShares[index]} %`}
                  </span>
                  <strong>{euros(prize)}</strong>
                </li>
              );
            })}
          </ol>
          {(rebuy || addOn) && (
            <ul className="poker-extra-rules">
              {rebuy && (
                <li>
                  Recompra · {euros(rebuy.costCents)} por {chips(rebuy.chips)} fichas, hasta el
                  nivel {rebuy.throughLevel}.
                </li>
              )}
              {addOn && (
                <li>
                  Extra · {euros(addOn.costCents)} por {chips(addOn.chips)} fichas, hasta el nivel{' '}
                  {addOn.throughLevel}.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
