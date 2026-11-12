import { type ReactNode, useEffect, useState } from 'react';
import type {
  BlindLevel,
  FinalStack,
  PokerAction,
  PokerExtra,
  PokerSession,
} from '../../services/endpoints/poker';

type Entry = PokerSession['entries'][number];
import { confirmAction } from '../../utils/confirmAction';
import { BagIcon, BulletIcon, Purchases, SeatBadges, SkullIcon } from './PokerBadges';
import { PokerAvatar } from './PokerFaces';
import { chips, clockAt, euros, timeLabel } from './pokerFormat';

interface Props {
  session: PokerSession;
  owner: boolean;
  busy: boolean;
  serverNow: number;
  receivedAt: number;
  onCommand: (action: PokerAction, playerId?: number, finalStacks?: FinalStack[]) => Promise<void>;
  lastWinnerIds?: number[];
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
  lastWinnerIds = [],
}: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [stacks, setStacks] = useState<Record<number, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const { levels, rebuy, addOn, prizeShares, startingChips } = session.settings;
  const eliminated = new Set(session.eliminations);
  const active = session.entries.filter((entry) => !eliminated.has(entry.playerId));
  const selectedPlayer = session.entries.find((entry) => entry.playerId === selectedPlayerId);
  const winner = active.length === 1 ? active[0] : null;
  /** Primero quien sigue en juego; los eliminados al fondo, del último en caer al primero. */
  const players = [
    ...active,
    ...[...session.eliminations]
      .reverse()
      .map((id) => session.entries.find((entry) => entry.playerId === id))
      .filter((entry): entry is Entry => entry !== undefined),
  ];
  const corrections = session.entries.filter(
    (entry) => entry.rebuys || entry.addOns || eliminated.has(entry.playerId),
  );
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
      (extra.limit === null || used < extra.limit),
    );
  }

  /** Tiempo que queda para comprar ese extra: el resto del nivel y los siguientes hasta su corte. */
  function timeToBuy(extra: PokerExtra | null) {
    if (!clock || !extra || clock.remainingMs === 0 || clock.level >= extra.throughLevel) {
      return null;
    }
    return levels
      .slice(clock.level + 1, extra.throughLevel)
      .reduce((sum, level) => sum + level.minutes * 60_000, clock.remainingMs);
  }
  /** Recompra, add-on y eliminar (o quitar la eliminación); con `compact` solo se ven los iconos. */
  function playerActions(entry: Entry, compact = false) {
    const out = eliminated.has(entry.playerId);
    const button = (
      action: PokerAction,
      label: string,
      text: string,
      icon: ReactNode,
      className = 'glass-btn',
    ) => (
      <button
        type="button"
        className={compact ? `${className} poker-icon-btn` : className}
        disabled={busy}
        aria-label={label}
        title={label}
        onClick={() => void onCommand(action, entry.playerId)}
      >
        {icon}
        {!compact && text}
      </button>
    );
    return (
      <>
        {canBuy(rebuy, entry.rebuys) &&
          button('REBUY', `Recompra de ${entry.name}`, 'Recompra', <BulletIcon />)}
        {!out &&
          canBuy(addOn, entry.addOns) &&
          button('ADD_ON', `Add-on para ${entry.name}`, 'Add-on', <BagIcon />)}
        {out
          ? button(
              'UNDO_ELIMINATION',
              `Quitar la eliminación de ${entry.name}`,
              'Quitar eliminación',
              <span className="poker-undo-icon">↺</span>,
            )
          : button(
              'ELIMINATE',
              `Eliminar a ${entry.name}`,
              'Eliminar',
              <SkullIcon />,
              'glass-btn poker-out-btn',
            )}
      </>
    );
  }

  const rebuyLeft = timeToBuy(rebuy);
  const addOnLeft = timeToBuy(addOn);
  const buyTimers =
    rebuyLeft !== null && rebuyLeft === addOnLeft
      ? [{ key: 'both', label: 'Recompras y add-on', ms: rebuyLeft, icons: ['bullet', 'bag'] }]
      : [
          rebuyLeft !== null && {
            key: 'rebuy',
            label: 'Recompras',
            ms: rebuyLeft,
            icons: ['bullet'],
          },
          addOnLeft !== null && { key: 'addOn', label: 'Add-on', ms: addOnLeft, icons: ['bag'] },
        ].filter((timer) => timer !== false);

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
        {!winner && buyTimers.length > 0 && (
          <ul className="poker-buy-timers">
            {buyTimers.map((timer) => (
              <li
                key={timer.key}
                aria-label={`${timer.label}: quedan ${timeLabel(timer.ms)}`}
                title={`${timer.label}: quedan ${timeLabel(timer.ms)}`}
              >
                {timer.icons.includes('bullet') && <BulletIcon />}
                {timer.icons.includes('bag') && <BagIcon />}
                <span aria-hidden="true">{timeLabel(timer.ms)}</span>
              </li>
            ))}
          </ul>
        )}
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
                {owner ? (
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
                <SeatBadges
                  rebuys={entry.rebuys}
                  addOns={entry.addOns}
                  crowned={lastWinnerIds.includes(entry.playerId)}
                />
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
            <div className="poker-player">
              <PokerAvatar
                playerId={selectedPlayer.playerId}
                name={selectedPlayer.name}
                size={44}
              />
              <div>
                <strong className="poster-title">{selectedPlayer.name}</strong>
                <Purchases rebuys={selectedPlayer.rebuys} addOns={selectedPlayer.addOns} />
              </div>
            </div>
            <div className="poker-actions">
              {playerActions(selectedPlayer)}
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
                <span className="poker-player">
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={28} />
                  {entry.name}
                </span>
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
          <div className="poker-progress poker-finish-progress" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, ((Number.isFinite(totalFinal) ? totalFinal : 0) / chipsInPlay) * 100))}%`,
              }}
            />
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
            {players.map((entry) => (
              <li key={entry.playerId}>
                <div className="poker-player">
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={44} />
                  <div>
                    <strong>{entry.name}</strong>
                    {(entry.rebuys > 0 || entry.addOns > 0) && (
                      <Purchases rebuys={entry.rebuys} addOns={entry.addOns} />
                    )}
                  </div>
                </div>
                {owner && !winner && (
                  <div className="poker-actions">{playerActions(entry, true)}</div>
                )}
              </li>
            ))}
          </ul>
          {owner && corrections.length > 0 && (
            <details className="poker-details">
              <summary>Corregir</summary>
              <div className="poker-detail-content">
                <ul className="poker-active-list poker-corrections">
                  {corrections.map((entry) => (
                    <li key={entry.playerId}>
                      <span className="poker-player">
                        <PokerAvatar playerId={entry.playerId} name={entry.name} size={28} />
                        <strong>{entry.name}</strong>
                      </span>
                      <div className="poker-actions">
                        {entry.rebuys > 0 && (
                          <button
                            type="button"
                            className="glass-btn"
                            disabled={busy}
                            aria-label={`Quitar una recompra a ${entry.name} (${entry.rebuys})`}
                            onClick={() => void onCommand('UNDO_REBUY', entry.playerId)}
                          >
                            − <BulletIcon />×{entry.rebuys}
                          </button>
                        )}
                        {entry.addOns > 0 && (
                          <button
                            type="button"
                            className="glass-btn"
                            disabled={busy}
                            aria-label={`Quitar un add-on a ${entry.name} (${entry.addOns})`}
                            onClick={() => void onCommand('UNDO_ADD_ON', entry.playerId)}
                          >
                            − <BagIcon />×{entry.addOns}
                          </button>
                        )}
                        {eliminated.has(entry.playerId) && (
                          <button
                            type="button"
                            className="glass-btn"
                            disabled={busy}
                            aria-label={`Quitar la eliminación de ${entry.name}`}
                            onClick={() => void onCommand('UNDO_ELIMINATION', entry.playerId)}
                          >
                            − <SkullIcon />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </section>

        <section className="paper-panel album-sheet poker-panel">
          <h2>Premios</h2>
          <p className="poker-pot">
            <span>Bote</span>
            <strong>{euros(session.potCents)}</strong>
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
                <li key={index} className={`poker-prize is-place-${Math.min(place, 4)}`}>
                  <span className="poker-prize-place">{place}.º</span>
                  <span className="poker-prize-who">
                    {player ? (
                      <span className="poker-player">
                        <PokerAvatar playerId={player.playerId} name={player.name} size={28} />
                        {player.name}
                      </span>
                    ) : (
                      <span className="poker-note">Por decidir</span>
                    )}
                    <small>{prizeShares[index]} % del bote</small>
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
                  <BulletIcon />
                  <span>
                    <strong>Recompra</strong> {euros(rebuy.costCents)} → {chips(rebuy.chips)} fichas
                    <small>
                      Hasta el nivel {rebuy.throughLevel} ·{' '}
                      {rebuy.limit === null ? 'sin límite' : `máx. ${rebuy.limit} por jugador`}
                    </small>
                  </span>
                </li>
              )}
              {addOn && (
                <li>
                  <BagIcon />
                  <span>
                    <strong>Add-on</strong> {euros(addOn.costCents)} → {chips(addOn.chips)} fichas
                    <small>Hasta el nivel {addOn.throughLevel} · uno por jugador</small>
                  </span>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
