import { useEffect, useState } from 'react';
import type {
  BlindLevel,
  FinalStack,
  PokerAction,
  PokerExtra,
  PokerSession,
} from '../../services/endpoints/poker';
import { confirmAction } from '../../utils/confirmAction';
import { PokerAvatar } from './PokerFaces';
import { chips, clockAt, euros, timeLabel } from './pokerFormat';

interface Props {
  session: PokerSession;
  owner: boolean;
  busy: boolean;
  serverNow: number;
  receivedAt: number;
  onCommand: (action: PokerAction, playerId?: number, finalStacks?: FinalStack[]) => Promise<void>;
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [stacks, setStacks] = useState<Record<number, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const { levels, rebuy, addOn, prizeShares, startingChips } = session.settings;
  const eliminated = new Set(session.eliminations);
  const active = session.entries.filter((entry) => !eliminated.has(entry.playerId));
  const selectedPlayer = active.find((entry) => entry.playerId === selectedPlayerId);
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

  const emptyStacks = active.filter((entry) => !stacks[entry.playerId]?.trim());
  const enteredStacks = active
    .filter((entry) => stacks[entry.playerId]?.trim())
    .map((entry) => Number(stacks[entry.playerId]));
  const remainingChips = chipsInPlay - enteredStacks.reduce((sum, value) => sum + value, 0);
  const autoPlayerId =
    emptyStacks.length === 1 &&
    enteredStacks.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    remainingChips >= 0
      ? emptyStacks[0].playerId
      : null;
  const displayedStacks = { ...stacks };
  if (autoPlayerId !== null) displayedStacks[autoPlayerId] = String(remainingChips);

  const finalStacks = active.map((entry) => ({
    playerId: entry.playerId,
    chips: Number(displayedStacks[entry.playerId] ?? 0),
  }));
  const totalFinal = finalStacks.reduce((sum, stack) => sum + stack.chips, 0);
  const validStacks =
    active.every(
      (entry) =>
        displayedStacks[entry.playerId]?.trim() !== '' &&
        displayedStacks[entry.playerId] !== undefined,
    ) &&
    finalStacks.every((stack) => Number.isSafeInteger(stack.chips) && stack.chips >= 0) &&
    totalFinal === chipsInPlay;

  async function finish() {
    if (!validStacks) return;
    if (
      await confirmAction({
        title: '¿Finalizar el torneo?',
        message:
          'Se guardarán las fichas y la clasificación final. Los empates compartirán puesto y los premios correspondientes.',
        confirmLabel: 'Finalizar y guardar',
      })
    )
      await onCommand('CLOSE', undefined, finalStacks);
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
            <div className="sticker sticker-featured">
              <span className="sticker-rank">1.º</span>
              <PokerAvatar playerId={winner.playerId} name={winner.name} size={96} />
              <strong className="poster-title">{winner.name}</strong>
              <span className="marker-ink">
                {session.prizes[0] > 0 ? `${euros(session.prizes[0])} de premio` : 'Primer puesto'}
              </span>
            </div>
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
                  <button
                    type="button"
                    className="glass-btn"
                    disabled={busy}
                    onClick={() => setFinishing(true)}
                  >
                    Finalizar torneo
                  </button>
                </div>
              )}
            </>
          )
        )}
        {!winner && (
          <ul className="poker-seats" aria-label="Jugadores en la mesa">
            {session.entries.map((entry) => (
              <li key={entry.playerId} className={eliminated.has(entry.playerId) ? 'is-out' : ''}>
                {owner && !eliminated.has(entry.playerId) ? (
                  <button
                    type="button"
                    className="poker-seat-button"
                    aria-label={`Acciones de ${entry.name}`}
                    aria-expanded={selectedPlayerId === entry.playerId}
                    aria-controls="poker-seat-actions"
                    disabled={busy}
                    onClick={() =>
                      setSelectedPlayerId(
                        selectedPlayerId === entry.playerId ? null : entry.playerId,
                      )
                    }
                  >
                    <PokerAvatar playerId={entry.playerId} name={entry.name} size={44} />
                  </button>
                ) : (
                  <span
                    aria-label={`${entry.name}${eliminated.has(entry.playerId) ? ' (eliminado)' : ''}`}
                  >
                    <PokerAvatar playerId={entry.playerId} name={entry.name} size={44} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {owner && !winner && selectedPlayer && (
          <section
            id="poker-seat-actions"
            className="poker-seat-actions"
            aria-label={`Acciones de ${selectedPlayer.name}`}
          >
            <strong>{selectedPlayer.name}</strong>
            <div className="poker-actions">
              {canBuy(rebuy, selectedPlayer.rebuys) && (
                <button
                  type="button"
                  className="glass-btn"
                  disabled={busy}
                  onClick={() => void onCommand('REBUY', selectedPlayer.playerId)}
                >
                  Recompra
                </button>
              )}
              {canBuy(addOn, selectedPlayer.addOns) && (
                <button
                  type="button"
                  className="glass-btn"
                  disabled={busy}
                  onClick={() => void onCommand('ADD_ON', selectedPlayer.playerId)}
                >
                  Add-on
                </button>
              )}
              <button
                type="button"
                className="glass-btn"
                disabled={busy}
                onClick={() => void onCommand('ELIMINATE', selectedPlayer.playerId)}
              >
                Eliminar
              </button>
              <button type="button" className="glass-btn" onClick={() => setSelectedPlayerId(null)}>
                Cerrar
              </button>
            </div>
          </section>
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

      {owner && finishing && !winner && (
        <form
          className="paper-panel album-sheet poker-panel poker-form poker-finish"
          onSubmit={(event) => {
            event.preventDefault();
            void finish();
          }}
        >
          <h2>Fichas al finalizar</h2>
          <p>
            Indica las fichas de cada jugador. La clasificación se ordenará de mayor a menor; los
            empates compartirán puesto y premios.
          </p>
          <div className="poker-fields poker-finish-fields">
            {active.map((entry) => (
              <label key={entry.playerId}>
                Fichas de {entry.name}
                <input
                  type="number"
                  className="glass-input"
                  inputMode="numeric"
                  placeholder="0"
                  min="0"
                  max={chipsInPlay}
                  step="1"
                  required
                  disabled={busy}
                  aria-label={`Fichas de ${entry.name}`}
                  value={displayedStacks[entry.playerId] ?? ''}
                  onChange={(event) =>
                    setStacks({ ...stacks, [entry.playerId]: event.target.value })
                  }
                />
                {entry.playerId === autoPlayerId && (
                  <small>Calculado con las fichas restantes</small>
                )}
              </label>
            ))}
          </div>
          <p role="status" className={validStacks ? 'poker-total' : 'poker-total is-off'}>
            Total: {chips(Number.isFinite(totalFinal) ? totalFinal : 0)} / {chips(chipsInPlay)}{' '}
            fichas
          </p>
          <div className="poker-actions">
            <button type="submit" className="glass-btn primary-btn" disabled={busy || !validStacks}>
              Finalizar y guardar
            </button>
            <button
              type="button"
              className="glass-btn"
              disabled={busy}
              onClick={() => setFinishing(false)}
            >
              Volver a la mesa
            </button>
          </div>
        </form>
      )}

      <div className="poker-live-grid">
        <section className="paper-panel album-sheet poker-panel">
          <h2>Jugadores</h2>
          <ul className="poker-active-list">
            {active.map((entry) => (
              <li key={entry.playerId}>
                <div className="poker-player">
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={44} />
                  <div>
                    <strong>{entry.name}</strong>
                    {(entry.rebuys > 0 || entry.addOns > 0) && (
                      <p className="poker-note">
                        Recompras {entry.rebuys} · Extras {entry.addOns}
                      </p>
                    )}
                  </div>
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
                  {[...session.eliminations].reverse().map((id, index) => {
                    const name = session.entries.find((entry) => entry.playerId === id)?.name ?? '';
                    return (
                      <li key={id}>
                        <span>{active.length + index + 1}.º</span>
                        <PokerAvatar playerId={id} name={name} size={28} />
                        {name}
                      </li>
                    );
                  })}
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
                  <span className="poker-player">
                    {player && (
                      <PokerAvatar playerId={player.playerId} name={player.name} size={28} />
                    )}
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
