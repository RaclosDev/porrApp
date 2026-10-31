import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react';
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
}

/** Los puntos suben de 0 al total la primera vez que el cromo se ve. */
function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (!inView) return;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [enabled, inView, target]);
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
}: StickerCardProps) {
  const { reduced } = useLandingMotion();
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [8, -8]), {
    stiffness: 220,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-8, 8]), {
    stiffness: 220,
    damping: 20,
  });
  const glareX = useTransform(pointerX, [0, 1], ['0%', '100%']);
  const [pointsRef, shownPoints] = useCountUp(leader.total, !reduced);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  };
  const onPointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const size = compact ? (featured ? 64 : 44) : featured ? 96 : 56;

  return (
    <motion.div
      className={`sticker ${featured ? 'sticker-featured' : ''} ${className}`}
      style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="sticker-rank" aria-label={`Puesto ${leader.rank}`}>
        {leader.rank}
      </span>
      <UserAvatar url={leader.avatarUrl} name={leader.name} userId={leader.userId} size={size} />
      <span className={`poster-title truncate max-w-full ${featured ? 'text-3xl' : 'text-xl'}`}>
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
      {!reduced ? (
        <motion.span aria-hidden="true" className="sticker-glare" style={{ left: glareX }} />
      ) : null}
    </motion.div>
  );
}
