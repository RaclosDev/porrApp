import { useEffect, useRef, useState } from 'react';
import type { BlindClock, BlindLevel } from '../../services/endpoints/poker';
import { BagIcon, BulletIcon } from './PokerBadges';
import { chips, euros, timeLabel } from './pokerFormat';
import PokerTvQueue from './PokerTvQueue';

interface Props {
  clock: BlindClock;
  levels: BlindLevel[];
  playersLeft: number;
  playersTotal: number;
  potCents: number;
  buyTimers: { key: string; label: string; ms: number; icons?: string[] }[];
  /** Con la liga suena la cola de canciones pedidas desde los móviles. */
  leagueId?: string | number;
  onClose: () => void;
}

function blindsText(level: BlindLevel) {
  return level.big === 0 ? 'Descanso' : `${chips(level.small)} / ${chips(level.big)}`;
}

/** Reloj a pantalla completa para verlo de lejos (móvil apoyado o proyectado en una tele). */
export default function PokerTv({
  clock,
  levels,
  playersLeft,
  playersTotal,
  potCents,
  buyTimers,
  leagueId,
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
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  return (
    <div className="poker-tv" role="dialog" aria-modal="true" aria-label="Reloj del torneo">
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
      <p className="poker-tv-level">Nivel {clock.level + 1}</p>
      <p className="poker-tv-time" role="timer" aria-label="Tiempo restante del nivel">
        {timeLabel(clock.remainingMs)}
      </p>
      {paused && clock.remainingMs > 0 && <p className="poker-tv-paused">Reloj en pausa</p>}
      <p className="poker-tv-blinds">{blindsText(level)}</p>
      {level.big > 0 && level.ante > 0 && <p className="poker-tv-ante">Ante {chips(level.ante)}</p>}
      {next && <p className="poker-tv-next">Siguiente · {blindsText(next)}</p>}
      <ul className="poker-tv-facts">
        <li>
          <strong>
            {playersLeft}/{playersTotal}
          </strong>
          <span>jugadores</span>
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
              {timer.label}
            </span>
          </li>
        ))}
      </ul>
      {leagueId !== undefined && <PokerTvQueue leagueId={leagueId} tv={tv} />}
    </div>
  );
}
