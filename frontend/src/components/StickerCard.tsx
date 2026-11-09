import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UserAvatar } from './Avatar';
import { useLandingMotion } from './landing/motion';

export interface StickerLeader {
  rank: number;
  userId: number | null;
  name: string;
  avatarUrl: string | null;
  total: number;
}

interface StickerCardProps {
  leader: StickerLeader;
  /** El líder va en un cromo grande con borde dorado. */
  featured?: boolean;
  /** Texto bajo los puntos, por ejemplo el campeón que eligió. */
  caption?: string | null;
  className?: string;
  compact?: boolean;
  staticCard?: boolean;
  avatar?: ReactNode;
  children?: ReactNode;
}

/** Los puntos suben de 0 al total la primera vez que el cromo se ve. */
const COUNT_UP_MS = 1100;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const run = () => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
        setValue(Math.round(target * easeOut(progress)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === 'undefined') {
      run();
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        run();
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [enabled, target]);
  return [ref, value] as const;
}

/**
 * Cromo de un participante: avatar, nombre y puntos. Al pasar el ratón se inclina siguiendo
 * el puntero, como un cromo de verdad al moverlo bajo la luz.
 */
export default function StickerCard({
  leader,
  featured = false,
  caption = null,
  className = '',
  compact = false,
  staticCard = false,
  avatar,
  children,
}: StickerCardProps) {
  const { reduced } = useLandingMotion();
  const animateCard = !reduced && !staticCard;
  const [pointsRef, shownPoints] = useCountUp(leader.total, animateCard);

  /** El puntero (0–1 en cada eje) inclina el cromo y mueve el reflejo; el CSS suaviza el giro. */
  const tilt = (element: HTMLElement, x: number, y: number) => {
    element.style.setProperty('--rx', `${8 - 16 * y}deg`);
    element.style.setProperty('--ry', `${16 * x - 8}deg`);
    element.style.setProperty('--gx', `${x * 100}%`);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!animateCard) return;
    const rect = event.currentTarget.getBoundingClientRect();
    tilt(
      event.currentTarget,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  };
  const onPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (animateCard) tilt(event.currentTarget, 0.5, 0.5);
  };

  const size = compact ? (featured ? 64 : 44) : featured ? 96 : 56;

  return (
    <div
      className={`sticker ${featured ? 'sticker-featured' : ''} ${animateCard ? 'sticker-tilt' : ''} ${className}`}
      onPointerMove={staticCard ? undefined : onPointerMove}
      onPointerLeave={staticCard ? undefined : onPointerLeave}
    >
      <span className="sticker-rank" aria-label={`Puesto ${leader.rank}`}>
        {leader.rank}
      </span>
      {avatar ?? (
        <UserAvatar url={leader.avatarUrl} name={leader.name} userId={leader.userId} size={size} />
      )}
      <span
        title={leader.name}
        className={`poster-title max-w-full ${compact ? 'text-center break-words text-base' : `truncate ${featured ? 'text-3xl' : 'text-xl'}`}`}
      >
        {leader.name}
      </span>
      <span
        ref={pointsRef}
        className={`marker-ink ${featured ? 'text-2xl' : 'text-lg'}`}
        aria-label={`${leader.total} puntos`}
      >
        {shownPoints.toLocaleString('es-ES')} pts
      </span>
      {caption ? <span className="text-sm text-[#4b5563] text-center">{caption}</span> : null}
      {children}
      {animateCard ? <span aria-hidden="true" className="sticker-glare" /> : null}
    </div>
  );
}
