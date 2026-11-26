import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Flag, Maximize, Pause, Pencil, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type {
  BlindLevel,
  PokerAction,
  PokerCommandExtra,
  PokerPayout,
  PokerExtra,
  PokerSession,
} from '../../services/endpoints/poker';

type Entry = PokerSession['entries'][number];
import InfoTip from '../InfoTip';
import { BagIcon, BulletIcon, Purchases, SeatBadges, SkullIcon } from './PokerBadges';
import { PokerAvatar } from './PokerFaces';
import PokerCloseDialog, { type Standing } from './PokerCloseDialog';
import { DEFAULT_ROUNDING_CENTS } from './pokerPayouts';
import PokerPrizeShares, {
  draftFromSettings,
  draftPrizes,
  draftValid,
  prizeCommand,
  type PrizeDraft,
} from './PokerPrizeShares';
import { buyUntil, chips, clockAt, euros, timeLabel } from './pokerFormat';
import PokerMusicPanel from './PokerMusicPanel';
import PokerFreeTable from './PokerFreeTable';
import PokerTv, { AUDIO_DELAY, CRUPIER_ACTION } from './PokerTv';
import { usePokerAlerts } from './usePokerAlerts';

interface Props {
  /** Liga del torneo; con ella se activa la cola de música. */
  leagueId?: string | number;
  session: PokerSession;
  owner: boolean;
  busy: boolean;
  serverNow: number;
  receivedAt: number;
  onCommand: (action: PokerAction, playerId?: number, extra?: PokerCommandExtra) => Promise<void>;
  lastWinnerIds?: number[];
  /** Abre la edición del torneo en juego (ajustes y jugadores); solo para quien organiza. */
  onEdit?: () => void;
  /** Lo que va bajo la mesa en juego (como apuntar a alguien tarde); se oculta al finalizar. */
  children?: ReactNode;
}

function blinds(level: BlindLevel) {
  if (level.big === 0) return 'Descanso';
  const ante = level.ante ? ` · ante ${chips(level.ante)}` : '';
  return `${chips(level.small)} / ${chips(level.big)}${ante}`;
}

export default function PokerLive({
  leagueId,
  session,
  owner,
  busy,
  serverNow,
  receivedAt,
  onCommand,
  lastWinnerIds = [],
  onEdit,
  children,
}: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishRef = useRef<HTMLFormElement>(null);
  // En el móvil el formulario de fichas queda bajo el pliegue: se lleva a la vista al abrirlo.
  useEffect(() => {
    if (finishing) finishRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [finishing]);
  const [stacks, setStacks] = useState<Record<number, string>>({});
  const [prizeDraft, setPrizeDraft] = useState<PrizeDraft | null>(null);
  /** Cierre pendiente de confirmar: con las fichas de los que siguen o con un único ganador. */
  const [closing, setClosing] = useState<'stacks' | 'chop' | 'winner' | null>(null);
  // En las partidas caseras casi nunca se cuentan las fichas: por defecto se reparte sin contarlas.
  const [countChips, setCountChips] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tv, setTv] = useState(false);
  const { levels, rebuy, addOn, prizeShares, prizeAmounts, startingChips } = session.settings;
  const eliminated = new Set(session.eliminations);
  const active = session.entries.filter((entry) => !eliminated.has(entry.playerId));
  const selectedPlayer = session.entries.find((entry) => entry.playerId === selectedPlayerId);
  const winner = active.length === 1 ? active[0] : null;
  /** Los eliminados, del último en caer al primero, con el puesto en que acabaron. */
  const fallen = session.eliminations
    .map((id, index) => ({
      entry: session.entries.find((entry) => entry.playerId === id),
      place: session.entries.length - index,
    }))
    .filter((row): row is { entry: Entry; place: number } => row.entry !== undefined)
    .reverse();
  const corrections = session.entries.filter(
    (entry) => entry.rebuys || entry.addOns || eliminated.has(entry.playerId),
  );
  const clock =
    session.clock && clockAt(session.clock, levels, serverNow + Math.max(0, now - receivedAt));
  // Recién empezado, el reloj espera parado a que la mesa se siente: aún no se ha jugado nada.
  const waiting = Boolean(
    clock &&
    clock.endsAt === null &&
    clock.level === 0 &&
    levels[0] &&
    clock.remainingMs >= levels[0].minutes * 60_000,
  );
  const chipsInPlay = session.entries.reduce(
    (sum, entry) =>
      sum + startingChips + entry.rebuys * (rebuy?.chips ?? 0) + entry.addOns * (addOn?.chips ?? 0),
    0,
  );

  const averageChips = active.length ? Math.round(chipsInPlay / active.length) : 0;

  const { soundOn, toggleSound, alert } = usePokerAlerts({
    running: Boolean(clock && clock.endsAt !== null && !winner),
    level: clock ? clock.level : null,
    onBreak: clock ? levels[clock.level]?.big === 0 : false,
    remainingMs: clock ? clock.remainingMs : null,
    entries: session.entries,
    eliminations: session.eliminations,
    tv,
  });

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
      clock.level < buyUntil(levels, extra.throughLevel) &&
      (extra.limit === null || used < extra.limit),
    );
  }

  /** Tiempo que queda para comprar ese extra: el resto del nivel y los siguientes hasta su corte. */
  function timeToBuy(extra: PokerExtra | null) {
    const end = extra && buyUntil(levels, extra.throughLevel);
    if (!clock || !end || clock.remainingMs === 0 || clock.level >= end) return null;
    return levels
      .slice(clock.level + 1, end)
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
        onClick={() => {
          // Hecha la acción, el panel del jugador se cierra solo.
          setSelectedPlayerId(null);
          void onCommand(action, entry.playerId);
        }}
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

  /** Clasificación al cerrar: los que siguen por fichas (empates comparten puesto) y los eliminados por orden. */
  function standings(survivors: { entry: Entry; chips: number }[], pact: boolean): Standing[] {
    const rows: Standing[] = survivors.map(({ entry, chips: own }) => ({
      ...(pact && { chips: own }),
      place: 1 + survivors.filter((other) => other.chips > own).length,
      playerId: entry.playerId,
      name: entry.name,
      tied: survivors
        .filter((other) => other.chips === own)
        .map((other) => other.entry.playerId)
        .sort((a, b) => a - b),
    }));
    session.eliminations.forEach((playerId, index) => {
      const entry = session.entries.find((candidate) => candidate.playerId === playerId);
      if (entry) {
        rows.push({
          place: session.entries.length - index,
          playerId,
          name: entry.name,
          tied: [playerId],
        });
      }
    });
    return rows.sort((a, b) => a.place - b.place);
  }

  async function savePrizes() {
    if (!prizeDraft || !draftValid(prizeDraft, session.potCents)) return;
    await onCommand('SET_PRIZES', undefined, prizeCommand(prizeDraft));
    setPrizeDraft(null);
  }

  async function confirmClose(draft: PrizeDraft, payouts: PokerPayout[]) {
    const stacksClose = closing === 'stacks';
    setClosing(null);
    await onCommand('CLOSE', undefined, {
      ...(stacksClose && { finalStacks }),
      ...prizeCommand(draft),
      payouts,
    });
  }

  const closeDialog =
    closing === 'chop'
      ? {
          title: '¿Finalizar el torneo?',
          message:
            'Los que siguen en la mesa comparten el primer puesto y se reparten sus premios y puntos. Puedes ajustar el reparto antes de confirmar.',
          confirmLabel: 'Finalizar y guardar',
          counted: false,
          standings: standings(
            active.map((entry) => ({ entry, chips: 0 })),
            true,
          ),
        }
      : closing === 'stacks'
        ? {
            title: '¿Finalizar el torneo?',
            message:
              'Se guardarán las fichas y la clasificación final. Los empates compartirán puesto y los premios correspondientes. Puedes ajustar el reparto antes de confirmar.',
            confirmLabel: 'Finalizar y guardar',
            counted: true,
            standings: standings(
              active.map((entry, index) => ({ entry, chips: finalStacks[index].chips })),
              true,
            ),
          }
        : closing === 'winner' && winner
          ? {
              title: '¿Cerrar el torneo?',
              message: `${winner.name} quedará en primer puesto. Los resultados y premios se guardarán en el histórico. Puedes ajustar el reparto antes de confirmar.`,
              confirmLabel: 'Cerrar y guardar',
              counted: true,
              standings: standings([{ entry: winner, chips: 0 }], false),
            }
          : null;

  /** Al finalizar se aparta la mesa: el reloj queda en pausa y solo se ven los pasos del cierre. */
  const finishView = owner && finishing && !winner;

  function startFinishing() {
    setSelectedPlayerId(null);
    setFinishing(true);
    if (clock && clock.endsAt !== null) void onCommand('PAUSE');
  }

  return (
    <>
      {closeDialog && (
        <PokerCloseDialog
          {...closeDialog}
          pot={session.potCents}
          initial={draftFromSettings(session.settings)}
          step={session.settings.roundingCents ?? DEFAULT_ROUNDING_CENTS}
          pactPoints={session.settings.pactPoints ?? 'EQUAL'}
          prizePoints={session.settings.prizePoints}
          busy={busy}
          onCancel={() => setClosing(null)}
          onConfirm={(draft, payouts) => void confirmClose(draft, payouts)}
        />
      )}
      <PokerFreeTable
        className="poker-next-card poker-live-card"
        corner={
          owner && onEdit && !winner && !finishView ? (
            <button
              type="button"
              className="poker-corner-btn"
              aria-label="Editar el torneo"
              title="Editar el torneo"
              disabled={busy}
              onClick={onEdit}
            >
              <Pencil size={18} strokeWidth={2.25} aria-hidden="true" />
            </button>
          ) : undefined
        }
        heading={
          winner ? (
            'Torneo listo para cerrar'
          ) : finishView ? (
            'Finalizando el torneo'
          ) : clock ? (
            <>
              <span className="sr-only">Torneo en juego:</span>
              <span className="poker-wall-time" role="timer" aria-label="Tiempo restante del nivel">
                {timeLabel(clock.remainingMs)}
              </span>
              <span className="poker-wall-time-label">
                {clock.remainingMs === 0
                  ? 'Último nivel completado'
                  : waiting
                    ? 'Esperando a la mesa'
                    : clock.endsAt === null
                      ? 'Reloj en pausa'
                      : 'Tiempo restante'}
              </span>
            </>
          ) : (
            'Torneo en juego'
          )
        }
        title={null}
        sides={
          clock && !winner && !finishView
            ? [
                <dl key="level" className="poker-wall-metric">
                  <dt>Nivel {clock.level + 1}</dt>
                  <dd>{blinds(levels[clock.level])}</dd>
                  {levels[clock.level + 1] && (
                    <dd className="poker-wall-metric-next">{blinds(levels[clock.level + 1])}</dd>
                  )}
                </dl>,
                <dl key="seated" className="poker-wall-metric">
                  <dt>En mesa</dt>
                  <dd>
                    {active.length} / {session.entries.length}
                  </dd>
                </dl>,
              ]
            : undefined
        }
        asleep={Boolean(clock && !winner && levels[clock.level]?.big === 0)}
        cue={
          alert && !tv
            ? { id: alert.id, action: CRUPIER_ACTION[alert.kind], audioDelay: AUDIO_DELAY }
            : null
        }
      >
        {!winner && !finishView && buyTimers.length > 0 && (
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
                  onClick={() => setClosing('winner')}
                >
                  Cerrar torneo
                </button>
              </div>
            )}
          </div>
        ) : finishView ? (
          <ol className="poker-finish-steps" aria-label="Pasos para finalizar">
            <li className={closing ? 'is-done' : 'is-current'}>
              <strong>Reparto</strong>
            </li>
            <li className={closing ? 'is-current' : undefined}>
              <strong>Premios y puntos</strong>
            </li>
            <li>
              <strong>Pagos</strong>
            </li>
          </ol>
        ) : (
          clock && (
            <>
              <div className="poker-clock">
                <p className="sr-only" aria-live="polite">
                  Nivel {clock.level + 1}: {blinds(levels[clock.level])}
                </p>
                <div className="poker-progress" aria-hidden="true">
                  <span
                    style={{
                      transform: `scaleX(${Math.min(1, clock.remainingMs / (levels[clock.level].minutes * 60_000))})`,
                    }}
                  />
                </div>
              </div>
              {waiting &&
                (owner ? (
                  <div className="poker-actions poker-clock-start">
                    <button
                      type="button"
                      className="glass-btn primary-btn"
                      disabled={busy}
                      onClick={() => void onCommand('RESUME')}
                    >
                      <Play size={18} aria-hidden="true" />
                      Arrancar el reloj
                    </button>
                    <p>Cuando todo el mundo esté sentado. Hasta entonces no corre el tiempo.</p>
                  </div>
                ) : (
                  <p className="poker-clock-wait">El reloj arranca cuando la mesa esté lista.</p>
                ))}
              <div className="poker-clock-tools">
                <button
                  type="button"
                  className="poker-tool"
                  aria-pressed={soundOn}
                  aria-label={soundOn ? 'Sonido activado' : 'Sonido silenciado'}
                  title={soundOn ? 'Sonido activado' : 'Sonido silenciado'}
                  onClick={toggleSound}
                >
                  <span className="poker-tool-icon">
                    {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                  </span>
                  <span className="poker-tool-label" aria-hidden="true">
                    Sonido
                  </span>
                </button>
                <button
                  type="button"
                  className="poker-tool"
                  aria-haspopup="dialog"
                  onClick={() => setTv(true)}
                >
                  <span className="poker-tool-icon">
                    <Maximize aria-hidden="true" />
                  </span>
                  <span className="poker-tool-label">Pantalla completa</span>
                </button>
                {owner && (
                  <>
                    <button
                      type="button"
                      className={clock.endsAt === null ? 'poker-tool is-primary' : 'poker-tool'}
                      disabled={busy || clock.remainingMs === 0}
                      onClick={() => void onCommand(clock.endsAt === null ? 'RESUME' : 'PAUSE')}
                    >
                      <span className="poker-tool-icon">
                        {clock.endsAt === null ? (
                          <Play aria-hidden="true" />
                        ) : (
                          <Pause aria-hidden="true" />
                        )}
                      </span>
                      <span className="poker-tool-label">
                        {waiting ? 'Arrancar' : clock.endsAt === null ? 'Reanudar' : 'Pausar'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="poker-tool"
                      disabled={busy || clock.level + 1 >= levels.length}
                      onClick={() => void onCommand('NEXT_LEVEL')}
                    >
                      <span className="poker-tool-icon">
                        <SkipForward aria-hidden="true" />
                      </span>
                      <span className="poker-tool-label">Siguiente nivel</span>
                    </button>
                    <button
                      type="button"
                      className="poker-tool"
                      disabled={busy}
                      onClick={startFinishing}
                    >
                      <span className="poker-tool-icon">
                        <Flag aria-hidden="true" />
                      </span>
                      <span className="poker-tool-label">Finalizar torneo</span>
                    </button>
                  </>
                )}
              </div>
              {tv && (
                <PokerTv
                  clock={clock}
                  levels={levels}
                  playersLeft={active.length}
                  playersTotal={session.entries.length}
                  averageChips={averageChips}
                  potCents={session.potCents}
                  buyTimers={buyTimers}
                  leagueId={leagueId}
                  alert={alert}
                  onClose={() => setTv(false)}
                />
              )}
            </>
          )
        )}
        {!winner && !finishView && (
          <ul className="poker-seats" aria-label="Jugadores en la mesa">
            {session.entries.map((entry) => (
              <li key={entry.playerId} className={eliminated.has(entry.playerId) ? 'is-out' : ''}>
                <button
                  type="button"
                  className="poker-seat-button"
                  aria-label={`Acciones de ${entry.name}`}
                  aria-expanded={selectedPlayerId === entry.playerId}
                  aria-controls="poker-seat-actions"
                  disabled={busy}
                  onClick={() =>
                    setSelectedPlayerId(selectedPlayerId === entry.playerId ? null : entry.playerId)
                  }
                >
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={44} />
                </button>
                <SeatBadges
                  rebuys={entry.rebuys}
                  addOns={entry.addOns}
                  crowned={lastWinnerIds.includes(entry.playerId)}
                />
              </li>
            ))}
          </ul>
        )}
        {!winner && !finishView && selectedPlayer && (
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
          {(!clock || winner || finishView) && (
            <div>
              <dt>En mesa</dt>
              <dd>
                {active.length} / {session.entries.length}
              </dd>
            </div>
          )}
          <div>
            <dt>Media de fichas</dt>
            <dd>{chips(averageChips)}</dd>
          </div>
          <div>
            <dt>Bote</dt>
            <dd>{euros(session.potCents)}</dd>
          </div>
        </dl>
      </PokerFreeTable>

      {leagueId !== undefined && !finishView && <PokerMusicPanel leagueId={leagueId} />}

      {finishView && (
        <form
          ref={finishRef}
          className="paper-panel album-sheet poker-panel poker-form poker-finish"
          onSubmit={(event) => {
            event.preventDefault();
            if (!countChips) setClosing('chop');
            else if (validStacks) setClosing('stacks');
          }}
        >
          <h2 className="poker-title-with-tip">
            ¿Cómo repartís?
            <InfoTip label="Qué cambia si contáis las fichas">
              Sin contar, los que siguen comparten el primer puesto a partes iguales. Contando
              fichas, se ordenan de más a menos y se sugiere el reparto según las fichas (ICM).
            </InfoTip>
          </h2>
          <div className="poker-prize-mode" role="group" aria-label="Cómo repartís">
            {(
              [
                [false, 'Sin contar fichas'],
                [true, 'Contando fichas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                className={countChips === value ? 'is-active' : undefined}
                aria-pressed={countChips === value}
                disabled={busy}
                onClick={() => setCountChips(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!countChips && (
            <ul className="poker-finish-chop">
              {active.map((entry) => (
                <li key={entry.playerId} className="poker-player">
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={28} />
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
          {countChips && (
            <>
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
                    transform: `scaleX(${Math.min(1, Math.max(0, (Number.isFinite(totalFinal) ? totalFinal : 0) / chipsInPlay))})`,
                  }}
                />
              </div>
              <p role="status" className={validStacks ? 'poker-total' : 'poker-total is-off'}>
                Total: {chips(Number.isFinite(totalFinal) ? totalFinal : 0)} / {chips(chipsInPlay)}{' '}
                fichas
              </p>
            </>
          )}
          <div className="poker-actions">
            <button
              type="submit"
              className="glass-btn primary-btn"
              disabled={busy || (countChips && !validStacks)}
            >
              Revisar premios y finalizar
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

      {!finishView && (
        <div className="poker-live-grid">
          <section className="paper-panel album-sheet poker-panel">
            <header className="poker-roster-head">
              <h2>Jugadores</h2>
              <p className="poker-roster-count">
                <span>
                  <strong>{active.length}</strong> en mesa
                </span>
                {fallen.length > 0 && (
                  <span>
                    <strong>{fallen.length}</strong> fuera
                  </span>
                )}
              </p>
            </header>
            <ul className="poker-roster">
              {active.map((entry) => (
                <li key={entry.playerId}>
                  <PokerAvatar playerId={entry.playerId} name={entry.name} size={40} />
                  <div className="poker-roster-name">
                    <strong>{entry.name}</strong>
                    {(entry.rebuys > 0 || entry.addOns > 0) && (
                      <Purchases rebuys={entry.rebuys} addOns={entry.addOns} />
                    )}
                  </div>
                  {!winner && (
                    <div className="poker-roster-actions">{playerActions(entry, true)}</div>
                  )}
                </li>
              ))}
            </ul>
            {fallen.length > 0 && (
              <>
                <h3 className="poker-roster-subhead">Eliminados</h3>
                <ul className="poker-roster is-out">
                  {fallen.map(({ entry, place }) => (
                    <li key={entry.playerId}>
                      <span className="poker-roster-place">{place}.º</span>
                      <PokerAvatar playerId={entry.playerId} name={entry.name} size={32} />
                      <div className="poker-roster-name">
                        <strong>{entry.name}</strong>
                        {(entry.rebuys > 0 || entry.addOns > 0) && (
                          <Purchases rebuys={entry.rebuys} addOns={entry.addOns} />
                        )}
                      </div>
                      {!winner && (
                        <div className="poker-roster-actions">{playerActions(entry, true)}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {corrections.length > 0 && (
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
                      <small>
                        {prizeAmounts ? 'Cantidad fija' : `${prizeShares[index]} % del bote`}
                      </small>
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
                      <strong>Recompra</strong> {euros(rebuy.costCents)} → {chips(rebuy.chips)}{' '}
                      fichas
                      <small>
                        Hasta el nivel {rebuy.throughLevel}
                        {buyUntil(levels, rebuy.throughLevel) > rebuy.throughLevel &&
                          ' y el descanso'}{' '}
                        · {rebuy.limit === null ? 'sin límite' : `máx. ${rebuy.limit} por jugador`}
                      </small>
                    </span>
                  </li>
                )}
                {addOn && (
                  <li>
                    <BagIcon />
                    <span>
                      <strong>Add-on</strong> {euros(addOn.costCents)} → {chips(addOn.chips)} fichas
                      <small>
                        Hasta el nivel {addOn.throughLevel}
                        {buyUntil(levels, addOn.throughLevel) > addOn.throughLevel &&
                          ' y el descanso'}{' '}
                        · uno por jugador
                      </small>
                    </span>
                  </li>
                )}
              </ul>
            )}
            {owner &&
              (prizeDraft ? (
                <form
                  className="poker-form poker-prize-editor"
                  aria-label="Cambiar el reparto de premios"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void savePrizes();
                  }}
                >
                  <PokerPrizeShares
                    draft={prizeDraft}
                    onChange={setPrizeDraft}
                    pot={session.potCents}
                    maxPlaces={session.entries.length}
                    disabled={busy}
                  />
                  {draftValid(prizeDraft, session.potCents) && (
                    <p className="poker-note">
                      Quedaría:{' '}
                      {draftPrizes(prizeDraft, session.potCents)
                        .map((prize, index) => `${index + 1}.º ${euros(prize)}`)
                        .join(' · ')}
                    </p>
                  )}
                  <div className="poker-actions">
                    <button
                      type="submit"
                      className="glass-btn primary-btn"
                      disabled={busy || !draftValid(prizeDraft, session.potCents)}
                    >
                      Guardar reparto
                    </button>
                    <button
                      type="button"
                      className="glass-btn"
                      disabled={busy}
                      onClick={() => setPrizeDraft(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="poker-link-btn poker-prize-edit"
                  disabled={busy}
                  onClick={() => setPrizeDraft(draftFromSettings(session.settings))}
                >
                  Cambiar reparto
                </button>
              ))}
          </section>
        </div>
      )}
      {!finishView && children}
    </>
  );
}
