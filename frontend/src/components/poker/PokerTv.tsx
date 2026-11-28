import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BlindClock, BlindLevel } from '../../services/endpoints/poker';
import { BagIcon, BulletIcon } from './PokerBadges';
import type { CrupierAction } from './crupier/crupierEngine';
import { chips, euros, levelHeading, timeLabel } from './pokerFormat';
import PokerFreeTable from './PokerFreeTable';
import PokerTvQueue from './PokerTvQueue';
import { PokerAvatar } from './PokerFaces';
import { POKER_DUCK_FADE_MS, type PokerSoundKind } from './pokerSound';
import type { PokerAlert } from './usePokerAlerts';

interface Props {
  clock: BlindClock;
  levels: BlindLevel[];
  playersLeft: number;
  playersTotal: number;
  /** Fichas en juego entre los jugadores que siguen en la mesa. */
  averageChips: number;
  potCents: number;
  buyTimers: { key: string; label: string; ms: number; icons?: string[] }[];
  /** Con la liga suena la cola de canciones pedidas desde los móviles. */
  leagueId?: string | number;
  /** Aviso que se está anunciando: sale en grande en el centro unos segundos. */
  alert?: PokerAlert | null;
  onClose: () => void;
}

/** Lo que hace el crupier con cada aviso, al compás de su sonido. */
export const CRUPIER_ACTION: Record<PokerSoundKind, CrupierAction> = {
  level: 'campana',
  break: 'pausa',
  warning: 'aviso',
  rebuy: 'revolver',
  addOn: 'caja',
  out: 'eliminado',
};
/** El sonido del aviso arranca este rato después de que aparezca (ver `playPokerSound`). */
export const AUDIO_DELAY = (POKER_DUCK_FADE_MS + 20) / 1000;

function blindsText(level: BlindLevel) {
  return level.big === 0 ? 'Descanso' : `${chips(level.small)} / ${chips(level.big)}`;
}

function alertText(alert: PokerAlert, level: BlindLevel, next: BlindLevel | undefined) {
  switch (alert.kind) {
    case 'rebuy':
      return { title: alert.name, text: 'ha hecho una recompra' };
    case 'addOn':
      return { title: alert.name, text: 'ha hecho un add-on' };
    case 'out':
      return { title: alert.name, text: 'queda fuera del torneo' };
    case 'level':
      return { title: 'Suben las ciegas', text: blindsText(level) };
    case 'break':
      return { title: 'Descanso', text: next ? `Después · ${blindsText(next)}` : undefined };
    default:
      return { title: 'Último minuto', text: next ? `Siguiente · ${blindsText(next)}` : undefined };
  }
}

function TvAlert({
  alert,
  level,
  next,
}: {
  alert: PokerAlert;
  level: BlindLevel;
  next: BlindLevel | undefined;
}) {
  const { title, text } = alertText(alert, level, next);
  return (
    <div className={`poker-tv-alert is-${alert.kind}`} role="status">
      {alert.playerId !== undefined && alert.name ? (
        <PokerAvatar playerId={alert.playerId} name={alert.name} size={104} />
      ) : (
        <span className="poker-tv-alert-icon" aria-hidden="true">
          {alert.kind === 'break' ? '☕' : alert.kind === 'warning' ? '⏱' : '🔔'}
        </span>
      )}
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

/** Reloj a pantalla completa para verlo de lejos (móvil apoyado o proyectado en una tele). */
export default function PokerTv({
  clock,
  levels,
  playersLeft,
  playersTotal,
  averageChips,
  potCents,
  buyTimers,
  leagueId,
  alert,
  onClose,
}: Props) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const level = levels[clock.level];
  const next = levels[clock.level + 1];
  const paused = clock.endsAt === null;
  const [tv, setTv] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    // Si el usuario sale del modo pantalla completa del navegador, se cierra también esta vista.
    const onFullscreen = () => {
      if (!document.fullscreenElement) closeRef.current();
    };
    // Sin scroll de la página de fondo (ni su barra a la derecha) mientras el reloj está abierto.
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  return createPortal(
    <div className="poker poker-tv" role="dialog" aria-modal="true" aria-label="Reloj del torneo">
      {leagueId !== undefined && (
        <button
          type="button"
          className="poker-tv-toggle"
          aria-pressed={tv}
          title="Es la pantalla donde suena la música de la mesa"
          onClick={() => setTv(!tv)}
        >
          TV {tv ? 'activada' : 'apagada'}
        </button>
      )}
      <button type="button" className="poker-tv-close" onClick={onClose}>
        Cerrar
      </button>
      <PokerFreeTable
        className="poker-tv-scene"
        title={null}
        heading={
          <>
            <span
              className="poker-wall-time poker-tv-time"
              role="timer"
              aria-label="Tiempo restante del nivel"
            >
              {timeLabel(clock.remainingMs)}
            </span>
            <span className="poker-wall-time-label">
              {paused && clock.remainingMs > 0 ? 'Reloj en pausa' : 'Tiempo restante'}
            </span>
          </>
        }
        sides={[
          <dl key="level" className="poker-wall-metric">
            <dt>{levelHeading(levels, clock.level)}</dt>
            <dd>{blindsText(level)}</dd>
            {next && <dd className="poker-wall-metric-next">{blindsText(next)}</dd>}
          </dl>,
          <dl key="seated" className="poker-wall-metric">
            <dt>En mesa</dt>
            <dd>
              {playersLeft} / {playersTotal}
            </dd>
          </dl>,
        ]}
        asleep={level.big === 0}
        cue={
          alert
            ? { id: alert.id, action: CRUPIER_ACTION[alert.kind], audioDelay: AUDIO_DELAY }
            : null
        }
      >
        <div className="poker-progress poker-tv-progress" aria-hidden="true">
          <span
            style={{
              transform: `scaleX(${Math.min(1, clock.remainingMs / (level.minutes * 60_000))})`,
            }}
          />
        </div>
        {level.big > 0 && level.ante > 0 && (
          <p className="poker-tv-ante">Ante {chips(level.ante)}</p>
        )}
        <ul className="poker-tv-facts">
          <li>
            <strong>{chips(averageChips)}</strong>
            <span>media de fichas</span>
          </li>
          <li>
            <strong>{euros(potCents)}</strong>
            <span>bote</span>
          </li>
          {buyTimers.map((timer) => (
            <li key={timer.key}>
              <strong>{timeLabel(timer.ms)}</strong>
              <span className="poker-tv-fact-label">
                {timer.icons?.includes('bullet') && <BulletIcon />}
                {timer.icons?.includes('bag') && <BagIcon />}
                {/* Es lo que queda para poder comprar, no la hora: «tiempo de recompras». */}
                tiempo de {timer.label.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </PokerFreeTable>
      {leagueId !== undefined && tv && <PokerTvQueue leagueId={leagueId} />}
      {alert && <TvAlert key={alert.id} alert={alert} level={level} next={next} />}
    </div>,
    document.body,
  );
}
